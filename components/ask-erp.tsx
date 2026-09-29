'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import s from '@/app/ui.module.css';
import { type Locale, countOf, formatCurrency, formatDay, formatNumber, t } from '@/lib/i18n';
import { type Intent, answer } from '@/lib/answers';
import { MAX_CARDS, type Change, type Source, type Step, changesSince, remember, sourceKey } from '@/lib/evidence';
import { CONCEPTS } from '@/lib/concepts';
import { type Order, fromJson } from '@/lib/order';
import type { QuoteView } from '@/lib/quote-view';
import type { Invoice } from '@/lib/invoices';
import type { Card } from '@/lib/cards';
import {
  type Act, type Button, type Turn as JourneyTurn, approveTurn, approvedTurn, caseTurn, failTurn,
  holdsWrite, invoicesTurn, menuTurn, moreTurn, movedTurn, newsTurn, noOrderTurn, orderTurn, quoteSentTurn, quoteShownTurn, refusedId,
  sizesSentTurn, teamTurn,
} from '@/lib/journey';
import { type News, type Seen, UPDATE_MS, newsSince, withOrder } from '@/lib/updates';
import { typingMs } from '@/lib/pace';
import { InvoicesCard, OrderCard, PeopleForm, QuoteCard, Rich, SizeRunCard } from './chat-actions';

type Health = 'probing' | 'live' | 'offline';
type Params = Record<string, string>;
type Option = { item: string; colours: string[]; sizes: string[] };

type Answer = {
  role: 'assistant';
  intent: Intent;
  params: Params;
  steps: Step[];
  rows?: unknown[];
  sources?: Source[];
  changes?: Record<string, Change[]>;
  error?: 'unreachable' | 'not_configured';
};
/** `prompt` is the assistant asking which garment, colour or size. */
type Turn = { role: 'user'; content: string } | { role: 'prompt'; content: string } | Answer
  | { role: 'quote'; view: QuoteView } | { role: 'card'; card: Card };

/** Where the guided flow is, which decides the buttons on offer. A journey
 *  `turn` carries its own buttons; `home` means it already is the menu. */
type Stage =
  | { k: 'turn'; buttons: Button[]; home?: boolean }
  | { k: 'people'; kit: string }
  | { k: 'sizes'; order: Order }
  | { k: 'garment'; intent: 'stock' | 'price'; from?: number }
  | { k: 'colour'; item: string }
  | { k: 'size'; item: string; colour: string }
  | { k: 'orders'; ids: string[] }
  | { k: 'stock' }
  | { k: 'price' };

/** A request from outside the dock: the order card's button opens the dock on
 *  that order's details. `id` makes asking twice still count as a new request. */
export type AskRequest = { orderId: string; id: number };

const KIND: Record<string, string> = {
  'Sales Order': 'kindSalesOrder', Quotation: 'kindQuotation', 'Sales Invoice': 'kindSalesInvoice',
  Bin: 'kindBin', Item: 'kindItem',
};

const isOrderDoc = (doctype: string) => doctype === 'Sales Order' || doctype === 'Quotation';

/** An order card's fact is the app's own workflow state, in the words the
 *  Orders screen uses. */
const status = (locale: Locale, value: string | number) => t(locale, `orders.state.${value}`);

/** One record the answer was read from. The quantity leads because it is
 *  what a stock question is about, and it is the value that visibly moves
 *  when ERPNext is edited mid-demo. */
function RecordCard({ source, changes, locale, onOpenOrder }: {
  source: Source; changes?: Change[]; locale: Locale; onOpenOrder?: (id: string) => void;
}) {
  const isOrder = isOrderDoc(source.doctype);
  const qtyChange = changes?.find((c) => c.field === 'qty');
  const otherChange = changes?.find((c) => c.field !== 'qty');
  const kind = KIND[source.doctype] ? t(locale, `erpAsk.${KIND[source.doctype]}`) : source.doctype;
  return (
    <li className={`${s.evCard} ${changes ? s.evChanged : ''}`}>
      <div className={s.evTop}>
        <span className={s.evKind}>{kind}</span>
        {/* Order and invoice numbers are codes, so they get the code face;
            an item name is words. */}
        <span className={source.qty === undefined ? s.evId : s.evName} dir="auto">{source.title}</span>
      </div>

      {source.qty !== undefined ? (
        <div className={s.evQty}>
          {qtyChange && (
            <>
              <s className={s.evWas}>{formatNumber(locale, Number(qtyChange.from))}</s>
              <span className={s.evArrow} aria-hidden="true">{locale === 'ar' ? '←' : '→'}</span>
            </>
          )}
          <b>{t(locale, 'erpAsk.pieces', { count: formatNumber(locale, source.qty) })}</b>
          <span className={s.evWhere} dir="auto">{source.detail}</span>
        </div>
      ) : (
        <div className={s.evFact}>
          <b dir="auto">{isOrder ? status(locale, source.detail) : source.detail}</b>
          {source.rate !== undefined && (
            <span>{t(locale, 'erpAsk.perPiece', { price: formatCurrency(locale, source.rate) })}</span>
          )}
          {source.date && (
            <span>{t(locale, source.doctype === 'Sales Invoice' ? 'erpAsk.invoiced' : 'erpAsk.delivery',
              { date: formatDay(locale, source.date) })}</span>
          )}
        </div>
      )}

      {changes && (
        <p className={s.evNote}>
          {t(locale, 'erpAsk.updated')}
          {otherChange && <> {t(locale, 'erpAsk.was')} <s dir="auto">{otherChange.field === 'detail' && isOrder
            ? status(locale, otherChange.from) : String(otherChange.from)}</s></>}
        </p>
      )}

      <div className={s.evFoot}>
        {isOrder && onOpenOrder && (
          <button type="button" className={s.evOpen} onClick={() => onOpenOrder(source.name)}>
            {t(locale, 'erpAsk.showOrder')}
          </button>
        )}
      </div>
    </li>
  );
}

function Reply({ turn, busy, locale, onRetry, onOpenOrder }: {
  turn: Answer; busy: boolean; locale: Locale; onRetry: () => void; onOpenOrder?: (id: string) => void;
}) {
  const sources = turn.sources ?? [];
  // Built here, not stored, so a language switch rewrites the answer too.
  const content = turn.rows && turn.intent !== 'options' ? answer(locale, turn.intent, turn.rows) : '';
  return (
    <div className={s.evReply}>
      {turn.error && (
        <div className={s.evError} role="alert">
          <p>{t(locale, turn.error === 'not_configured' ? 'erpAsk.errorConfig' : 'erpAsk.errorUnreachable')}</p>
          <button type="button" onClick={onRetry} disabled={busy}>{t(locale, 'erpAsk.retry')}</button>
        </div>
      )}

      {content && <p className={s.evAnswer} dir="auto"><Rich text={content} /></p>}

      {content && (sources.length ? (
        <section className={s.evSources} aria-label={t(locale, 'erpAsk.evidence')}>
          {/* The answer counts every order; the cards stop at MAX_CARDS. */}
          {turn.intent === 'orders' && (turn.rows?.length ?? 0) > sources.length && (
            <h3>{t(locale, 'erpAsk.evidenceSome', { shown: sources.length, count: turn.rows!.length })}</h3>
          )}
          <ul>
            {sources.map((src) => (
              <RecordCard key={sourceKey(src)} source={src} locale={locale} onOpenOrder={onOpenOrder}
                changes={turn.changes?.[sourceKey(src)]} />
            ))}
          </ul>
        </section>
      ) : (
        <div className={s.evEmpty}>
          <span>{t(locale, 'erpAsk.noRecordNote')}</span>
        </div>
      ))}
    </div>
  );
}

const pending = (intent: Intent, params: Params): Step =>
  ({ id: 'pending', tool: intent, input: params, state: 'running' });

export function AskErp({ locale, request, onOpenOrder, onChanged, raised }: {
  locale: Locale;
  request?: AskRequest | null;
  /** Shows an order on the Orders screen. */
  onOpenOrder?: (id: string) => void;
  /** Something was written: the page reloads its orders. */
  onChanged?: () => void;
  /** Lift the launcher above a fixed action bar. */
  raised?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [stage, setStage] = useState<Stage>({ k: 'turn', buttons: [], home: true });
  const [garments, setGarments] = useState<Option[]>([]);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<Health>('probing');
  const log = useRef<HTMLDivElement>(null);
  // The last value shown for every record, across the whole conversation.
  const seen = useRef(new Map<string, Source>());
  // Which read the garment buttons are for, and the last stock check, which
  // "Check again" repeats.
  const purpose = useRef<'stock' | 'price'>('stock');
  const lastStock = useRef<Params | null>(null);

  // Checked on mount and on every open, so a dropped connection shows on the
  // launcher before anyone asks a question in front of the client.
  useEffect(() => {
    let live = true;
    setHealth('probing');
    fetch('/api/ask', { cache: 'no-store' })
      .then((r) => r.json() as Promise<{ ok: boolean }>)
      .then((h) => { if (live) setHealth(h.ok ? 'live' : 'offline'); })
      .catch(() => { if (live) setHealth('offline'); });
    return () => { live = false; };
  }, [open]);

  const reduced = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Each new reply opens on its first line; a short one shows whole, with its
  // buttons. `anchor` is the first turn added since the last run, past the
  // customer's own words when a reply came with them (a read adds both).
  const shown = useRef(0);
  const anchor = useRef(0);
  useEffect(() => {
    const box = log.current;
    if (!box) return;
    if (turns.length < shown.current) { shown.current = 0; anchor.current = 0; }
    if (turns.length > shown.current) {
      const said = turns.findIndex((x, i) => i >= shown.current && x.role !== 'user');
      anchor.current = said >= 0 ? said : shown.current;
      shown.current = turns.length;
    }
    const el = box.querySelector<HTMLElement>(`[data-turn="${anchor.current}"]`);
    const end = box.scrollHeight - box.clientHeight;
    // A read still running has nothing on screen yet: show the typing dots.
    const top = el?.getClientRects().length ? box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top - 8 : end;
    box.scrollTo({ top: Math.min(top, end), behavior: reduced() ? 'auto' : 'smooth' });
  }, [turns, busy, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchLast = (fn: (a: Answer) => Answer) => setTurns((all) => {
    const last = all[all.length - 1];
    return last && last.role === 'assistant' ? [...all.slice(0, -1), fn(last)] : all;
  });

  /** Wait out the rest of a person's pause; time already spent fetching counts. */
  const beat = async (text: string, started: number) => {
    const wait = typingMs(text, reduced()) - (Date.now() - started);
    if (wait > 0) await new Promise((done) => setTimeout(done, wait));
  };

  const promptFor = (next: Stage): string | null =>
    next.k === 'garment' ? t(locale, garments.length ? 'erpAsk.pickGarment' : 'erpAsk.pickNone')
        : next.k === 'colour' ? t(locale, 'erpAsk.pickColour')
          : next.k === 'size' ? t(locale, 'erpAsk.pickSize') : null;

  /** The buttons change with the flow; the question they answer is a message. */
  const go = (next: Stage, tapped?: string) => {
    const prompt = promptFor(next);
    setTurns((all) => [
      ...all,
      ...(tapped ? [{ role: 'user' as const, content: tapped }] : []),
      ...(prompt ? [{ role: 'prompt' as const, content: prompt }] : []),
    ]);
    setStage(next);
  };

  // React state disables the controls after render; this ref closes the
  // same-tick double-click window before any write request can start.
  const actionLock = useRef(false);
  // Bumped by a language switch: a reply typed in the old language is dropped.
  const langEpoch = useRef(0);

  /** One button, one read. `tapped` is what the customer's tap says in the
   *  chat; a retry replaces the failed answer instead of adding a new one. */
  const read = useCallback(async (intent: Intent, params: Params, tapped?: string, retry = false) => {
    if (busy) return;
    setTurns((all) => [
      ...(retry ? all.slice(0, -1) : all),
      ...(tapped ? [{ role: 'user' as const, content: tapped }] : []),
      { role: 'assistant', intent, params, steps: [pending(intent, params)] },
    ]);
    setBusy(true);
    const started = Date.now();
    const lang = langEpoch.current;
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, params }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw Object.assign(new Error('request failed'), { code: body.error });
      }
      const data = await response.json() as { rows: unknown[]; sources: Source[]; step: Step };
      const changes = Object.fromEntries(changesSince(seen.current, data.sources));
      remember(seen.current, data.sources);
      await beat('', started);
      if (langEpoch.current !== lang) return;
      patchLast((a) => ({ ...a, steps: [data.step], rows: data.rows, sources: data.sources, changes }));
      if (intent === 'orders') setStage({ k: 'orders', ids: (data.rows as { id: string }[]).slice(0, MAX_CARDS).map((r) => r.id) });
      else if (intent === 'stock') setStage({ k: 'stock' });
      else if (intent === 'price') setStage({ k: 'price' });
      else {
        const list = data.rows as Option[];
        setGarments(list);
        const next: Stage = { k: 'garment', intent: purpose.current };
        setTurns((all) => [...all, {
          role: 'prompt',
          content: t(locale, list.length ? 'erpAsk.pickGarment' : 'erpAsk.pickNone'),
        }]);
        setStage(next);
      }
    } catch (error) {
      if (langEpoch.current !== lang) return;
      const code = (error as { code?: string }).code;
      patchLast((a) => ({
        ...a, steps: a.steps.map((x) => ({ ...x, state: 'error' as const })),
        error: code === 'not_configured' ? 'not_configured' : 'unreachable',
      }));
      setStage({ k: 'turn', buttons: [] });
    } finally {
      setBusy(false);
    }
  }, [busy, locale]);


  /** A journey turn: its sentence in the log, its buttons as the choices. */
  const say = (turn: JourneyTurn, home = false) => {
    // Pending news is told first, in the same breath as the reply.
    const told = news.current.splice(0);
    setTurns((all) => [
      ...all,
      ...(told.length ? [{ role: 'prompt' as const, content: newsTurn(locale, told).say }] : []),
      { role: 'prompt', content: turn.say },
      ...(turn.card ? [{ role: 'card' as const, card: turn.card }] : []),
    ]);
    setStage({ k: 'turn', buttons: turn.buttons, home });
  };
  const echo = (content?: string) => { if (content) setTurns((all) => [...all, { role: 'user', content }]); };
  async function api<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(path, body === undefined ? { cache: 'no-store' } : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) throw Object.assign(new Error(String(res.status)), { status: res.status });
    return res.json() as Promise<T>;
  }
  // Set when the chat read the orders, so Home reloads its own once the
  // sheet closes (one request, not one per read).
  const readOrders = useRef(false);
  // What the chat last saw of the account, and the changes the customer has
  // not been told yet. Kept for the page's life; a reload starts afresh.
  const known = useRef<Seen | null>(null);
  const news = useRef<News[]>([]);
  const [unread, setUnread] = useState(false);
  // Counts the dock's own locked acts (every write among them). A background
  // read that started before one and resolves after it is stale: learning it
  // would announce the customer's own change as news, or roll back what a
  // newer read already learned.
  const epoch = useRef(0);
  const learn = (orders: Order[], invoices?: Invoice[]) => {
    const next = newsSince(known.current, orders, invoices);
    known.current = next.seen;
    news.current.push(...next.news);
  };
  const readAccount = () => Promise.all([
    api<Order[]>('/api/orders').then((all) => all.map(fromJson)),
    // Invoices failing must not sink the orders: they are learned next time.
    api<Invoice[]>('/api/invoices').catch(() => undefined),
  ]);
  const myOrders = async () => {
    const orders = (await api<Order[]>('/api/orders')).map(fromJson);
    readOrders.current = true;
    learn(orders);
    return orders;
  };
  const myAccount = async () => {
    const [orders, invoices] = await readAccount();
    readOrders.current = true;
    learn(orders, invoices);
    return { orders, invoices };
  };
  /** The customer's own write is not news. */
  const own = (o: Order) => { if (known.current) known.current = withOrder(known.current, o); };
  const findIn = (orders: Order[], id: string) => orders.find((o) => [o.id, o.quote, o.salesOrder].includes(id));

  /** What a button does. Pure turns answer at once; the rest read or write
   *  first. `tapped` is the button's label, echoed as the customer's words. */
  const act = async (a: Act, tapped?: string) => {
    if (busy || actionLock.current) return;
    // A language switch while this reply is being typed restarts the chat in
    // the new language; this reply, in the old one, is then dropped.
    const lang = langEpoch.current;
    const stale = () => langEpoch.current !== lang;
    if (a.k === 'orders') return void read('orders', {}, tapped);
    if (a.k === 'stock' || a.k === 'price') { purpose.current = a.k; return void read('options', {}, tapped); }
    echo(tapped);
    // Every reply, even one that needs no data, runs under the lock and
    // `busy`: nothing can be tapped while the account manager is typing.
    actionLock.current = true;
    epoch.current += 1;
    setBusy(true);
    const started = Date.now();
    const reply = async (turn: JourneyTurn, home = false) => {
      await beat(turn.say, started);
      if (stale()) throw STALE;
      say(turn, home);
    };
    const ask = async (content: string) => {
      await beat(content, started);
      if (stale()) throw STALE;
      setTurns((all) => [...all, { role: 'prompt', content }]);
    };
    try {
      if (a.k === 'new') await reply(teamTurn(locale));
      else if (a.k === 'approve') await reply(approveTurn(locale, a.quote, a.total));
      else if (a.k === 'people') {
        await ask(t(locale, 'journey.people'));
        setStage({ k: 'people', kit: a.kit });
      } else if (a.k === 'more') {
        await reply(moreTurn(locale, await myOrders(), a.from));
      } else if (a.k === 'menu') {
        await reply(menuTurn(locale, (await myAccount()).orders, new Date().getHours(), turns.length > 0), true);
      } else if (a.k === 'order' || a.k === 'show') {
        const { orders, invoices } = await myAccount();
        const o = findIn(orders, a.id);
        if (a.k === 'show' && o) onOpenOrder?.(o.id);
        await reply(o ? orderTurn(locale, o, invoices ?? []) : noOrderTurn(locale));
      } else if (a.k === 'viewQuote') {
        const view = await api<QuoteView>(`/api/quotes/${encodeURIComponent(a.quote)}`);
        const o = findIn(await myOrders(), a.quote);
        await beat('', started);
        if (stale()) throw STALE;
        setTurns((all) => [...all, { role: 'quote', view }]);
        say(o ? quoteShownTurn(locale, o) : noOrderTurn(locale));
      } else if (a.k === 'invoices') {
        await reply(invoicesTurn(locale, await api<Invoice[]>('/api/invoices')));
      } else if (a.k === 'sizes') {
        const { orders, invoices } = await myAccount();
        const o = findIn(orders, a.order);
        if (!o || o.state !== 'collecting_sizes') await reply(o ? orderTurn(locale, o, invoices ?? []) : noOrderTurn(locale));
        else {
          await ask(t(locale, 'journey.sizesAsk', { id: a.order, sets: countOf(locale, 'set', o.sets) }));
          setStage({ k: 'sizes', order: o });
        }
      } else if (a.k === 'requestQuote') {
        const concept = CONCEPTS.find((c) => c.id === a.kit) ?? CONCEPTS[0];
        const o = fromJson(await api<Order>('/api/quotes', {
          concept, staff: a.people, sets: a.sets, grades: [], sizePlan: { mode: 'collect_later', allocation: {} },
        }));
        own(o);
        onChanged?.();
        await reply(quoteSentTurn(locale, o));
      } else if (a.k === 'approveNow') {
        const o = fromJson(await api<Order>(`/api/quotes/${encodeURIComponent(a.quote)}/approve`, {}));
        own(o);
        onChanged?.();
        await reply(approvedTurn(locale, o));
      } else if (a.k === 'sendSizes') {
        const o = fromJson(await api<Order>(`/api/orders/${encodeURIComponent(a.order)}/sizes`, { allocation: a.run }));
        own(o);
        onChanged?.();
        await reply(sizesSentTurn(locale, o));
      } else if (a.k === 'sendContact') {
        const c = await api<{ name: string }>('/api/contact', { topic: a.topic, ...(a.doc ? { document: a.doc } : {}) });
        await reply(caseTurn(locale, c.name, a.doc));
      }
    } catch (error) {
      if (stale()) return;
      // Refused (already approved, sizes already in, gone): not an outage.
      // Say where things stand instead of offering the same write again.
      const status = (error as { status?: number }).status;
      const id = refusedId(a);
      if (id && (status === 409 || status === 404)) {
        try {
          const { orders, invoices } = await myAccount();
          return await reply(movedTurn(locale, findIn(orders, id), invoices ?? []));
        } catch { if (stale()) return; /* the re-read failed too: that is an outage */ }
      }
      // A failed menu is the menu: its Try again is the only way on.
      say(failTurn(locale, a), a.k === 'menu');
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
  // Effects below always call the latest act.
  const actRef = useRef(act);
  actRef.current = act;

  // The latest open, stage and busy, for a read that resolves after a re-render.
  const now = useRef({ open, stage, busy });
  now.current = { open, stage, busy };

  /** Look again; tell the news now (open, on a button turn), later (mid-form),
   *  or with the launcher's dot (closed). */
  const reading = useRef(false);
  const refresh = async () => {
    // One look at a time: focus and visibilitychange fire together, and an
    // older answer landing last would roll `known` back and repeat news.
    if (busy || actionLock.current || reading.current || !known.current) return;
    const started = epoch.current;
    reading.current = true;
    let read: Awaited<ReturnType<typeof readAccount>>;
    try { read = await readAccount(); } catch { return; } finally { reading.current = false; }
    // An act ran while this read was in flight: drop it, never learn it.
    if (epoch.current !== started || actionLock.current || now.current.busy) return;
    readOrders.current = true;
    learn(...read);
    if (!news.current.length) return;
    if (!now.current.open) return setUnread(true);
    // Mid-form (people, sizes, a stock pick) or on a confirmation that holds
    // a write (Yes, approve; Send the size run), the news waits for the next
    // reply rather than replacing what the customer is about to send.
    const { stage: at } = now.current;
    if (at.k !== 'turn' || holdsWrite(at.buttons)) return;
    const told = news.current.splice(0);
    const turn = newsTurn(locale, told);
    // The news is typed like any reply; `reading` keeps a second look out and
    // the lock keeps every tap out until it has landed.
    const lang = langEpoch.current;
    reading.current = true;
    actionLock.current = true;
    setBusy(true);
    try {
      await beat(turn.say, Date.now());
      // A language switch mid-pause: the new greeting tells it instead.
      if (langEpoch.current !== lang) news.current.unshift(...told);
      else say(turn);
    } finally {
      reading.current = false;
      actionLock.current = false;
      setBusy(false);
    }
  };
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // A baseline when the page loads, so news can light the launcher before
  // the chat was ever opened. Dropped if the dock read first.
  useEffect(() => {
    const started = epoch.current;
    void readAccount().then((read) => { if (epoch.current === started && !known.current) learn(...read); }, () => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Coming back to the window (the presenter ran a team step) looks again.
  useEffect(() => {
    const look = () => void refreshRef.current();
    const visible = () => { if (document.visibilityState === 'visible') look(); };
    addEventListener('focus', look);
    document.addEventListener('visibilitychange', visible);
    return () => { removeEventListener('focus', look); document.removeEventListener('visibilitychange', visible); };
  }, []);

  // Open: clear the dot, catch up, and keep looking while open.
  useEffect(() => {
    if (!open) return;
    setUnread(false);
    if (turns.length) void refreshRef.current();
    const timer = setInterval(() => void refreshRef.current(), UPDATE_MS);
    return () => clearInterval(timer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // The order card's button: open the dock straight on that order's details.
  const handled = useRef<number | null>(null);
  useEffect(() => {
    if (!request || busy || handled.current === request.id) return;
    handled.current = request.id;
    setOpen(true);
    void actRef.current({ k: 'order', id: request.orderId }, t(locale, 'erpAsk.btnDetails', { id: request.orderId }));
  }, [request, busy, locale]);

  // First open, or a fresh start: the account manager greets and offers
  // what is waiting.
  // `busy` too: a reply dropped by a language switch leaves the log empty
  // once it lets go.
  useEffect(() => {
    if (open && !turns.length && !busy) void actRef.current({ k: 'menu' });
  }, [open, turns.length, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  // A language switch restarts the conversation in the new language: the
  // log holds sentences and labels already written in the old one.
  useEffect(() => {
    // Bumped first: the first greeting, still being typed into an empty log,
    // is in the old language too.
    langEpoch.current += 1;
    if (!turns.length) return;
    setTurns([]);
    seen.current.clear();
    setGarments([]);
    setStage({ k: 'turn', buttons: [], home: true });
  }, [locale]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus lands in the sheet when it opens and back on the launcher when it
  // closes; Home catches up on what the chat read.
  const closeButton = useRef<HTMLButtonElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) closeButton.current?.focus();
    else if (wasOpen.current) {
      launcher.current?.focus();
      if (readOrders.current) { readOrders.current = false; onChanged?.(); }
    }
    wasOpen.current = open;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes wherever focus is (a tapped button unmounts, and focus
  // falls to the page).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open]);

  // After each answer, focus its first input (a form) or its first choice.
  const choiceList = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!open || busy) return;
    (log.current?.querySelector('input') ?? choiceList.current?.querySelector('button'))?.focus({ preventScroll: true });
  }, [stage, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const online = health === 'live' ? t(locale, 'erpAsk.live')
    : health === 'offline' ? t(locale, 'erpAsk.offline') : t(locale, 'erpAsk.probing');

  const toMenu: Choice = { label: t(locale, 'journey.btnMenu'), tap: () => void act({ k: 'menu' }, t(locale, 'journey.btnMenu')) };
  const fromButtons = (bs: Button[]): Choice[] =>
    bs.map((b) => ({ label: b.label, primary: b.primary, tap: () => void act(b.act, b.label) }));
  const garment = garments.find((g) => stage.k === 'colour' || stage.k === 'size' ? g.item === stage.item : false);

  const choices: Choice[] = stage.k === 'turn' ? [...fromButtons(stage.buttons), ...(stage.home ? [] : [toMenu])]
    : stage.k === 'people' || stage.k === 'sizes' ? [toMenu]
    // Three garments at a time, then "More garments": at most four choices.
    : stage.k === 'garment' ? [
      ...garments.slice(stage.from ?? 0, (stage.from ?? 0) + 3).map((g) => ({
        label: g.item,
        tap: () => {
          if (stage.intent === 'price') void read('price', { item: g.item }, g.item);
          else go({ k: 'colour', item: g.item }, g.item);
        },
      })),
      // Past the last three it goes round to the first again.
      ...(garments.length > 3 ? [{
        label: t(locale, 'journey.btnMoreGarments'),
        tap: () => go({ ...stage, from: (stage.from ?? 0) + 3 < garments.length ? (stage.from ?? 0) + 3 : 0 },
          t(locale, 'journey.btnMoreGarments')),
      }] : []),
      toMenu,
    ]
      : stage.k === 'colour' ? [
        ...(garment?.colours ?? []).map((c) => ({ label: c, tap: () => go({ k: 'size', item: stage.item, colour: c }, c) })),
        toMenu,
      ]
        : stage.k === 'size' ? [
          ...(garment?.sizes ?? []).map((z) => ({
            label: z,
            tap: () => {
              lastStock.current = { item: stage.item, colour: stage.colour, size: z };
              void read('stock', lastStock.current, z);
            },
          })),
          toMenu,
        ]
          : stage.k === 'orders' ? [
            ...stage.ids.slice(0, 3).map((id) => ({
              label: t(locale, 'erpAsk.btnDetails', { id }),
              tap: () => void act({ k: 'order', id }, t(locale, 'erpAsk.btnDetails', { id })),
            })),
            toMenu,
          ]
              : stage.k === 'stock' ? [
                {
                  label: t(locale, 'erpAsk.btnAgain'),
                  tap: () => { if (lastStock.current) void read('stock', lastStock.current, t(locale, 'erpAsk.btnAgain')); },
                },
                {
                  label: t(locale, 'erpAsk.btnAnother'),
                  tap: () => void act({ k: 'stock' }, t(locale, 'erpAsk.btnAnother')),
                },
                toMenu,
              ]
                : [toMenu];

  if (!open) {
    return (
      <button type="button" ref={launcher} className={`${s.evLauncher} ${raised ? s.evLauncherRaised : ''}`} onClick={() => setOpen(true)}
        aria-haspopup="dialog" title={online} aria-label={unread ? `${t(locale, 'erpAsk.launcher')} · ${t(locale, 'erpAsk.news')}` : undefined}>
        <span className={`${s.evLive} ${s[`evLive_${health}`]}`} aria-hidden="true" />
        {t(locale, 'erpAsk.launcher')}
        {unread && <span className={s.evUnread} aria-hidden="true" />}
      </button>
    );
  }

  return (
    <aside className={s.evSheet} role="dialog" aria-label={t(locale, 'erpAsk.title')}>
      <header className={s.evHead}>
        <div>
          <h2>{t(locale, 'erpAsk.title')}</h2>
          <p className={s.evStatus}>
            <span className={`${s.evLive} ${s[`evLive_${health}`]}`} aria-hidden="true" />
            <span dir="auto">{online}</span>
          </p>
        </div>
        <button type="button" ref={closeButton} className={s.dockClose} onClick={() => setOpen(false)}
          aria-label={t(locale, 'erpAsk.close')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="m4 4 8 8m0-8-8 8" />
          </svg>
        </button>
      </header>

      <div className={s.evBody} ref={log} aria-live="polite">
        {/* Each turn is a scroll anchor: a new reply opens on its first line. */}
        {turns.map((turn, index) => (
          <div key={index} data-turn={index} className={s.evTurn}>
            {turn.role === 'user' ? (
              <p className={`${s.msg} ${s.msgYou} ${s.evQuestion}`} dir="auto"><Rich text={turn.content} /></p>
            ) : turn.role === 'prompt' ? (
              <p className={s.evAnswer} dir="auto"><Rich text={turn.content} /></p>
            ) : turn.role === 'quote' ? (
              <QuoteCard view={turn.view} locale={locale} />
            ) : turn.role === 'card' ? (
              // Live only while it is the last thing said: an older card further
              // up the log never offers a second Approve.
              turn.card.k === 'order'
                ? <OrderCard view={turn.card.view} live={!busy && index === turns.length - 1} onAct={(b) => void act(b.act, b.label)} />
                : <InvoicesCard view={turn.card.view} live={!busy && index === turns.length - 1} onAct={(b) => void act(b.act, b.label)} />
            ) : (
              <Reply turn={turn} locale={locale} busy={busy && index === turns.length - 1}
                onRetry={() => void read(turn.intent, turn.params, undefined, true)} onOpenOrder={onOpenOrder} />
            )}
          </div>
        ))}
        {!busy && stage.k === 'people' && (
          <PeopleForm key={stage.kit} locale={locale} kit={stage.kit} onRequest={(b) => void act(b.act, b.label)} />
        )}
        {!busy && stage.k === 'sizes' && (
          <SizeRunCard key={stage.order.id} order={stage.order} locale={locale}
            onSend={(run) => void act({ k: 'sendSizes', order: stage.order.salesOrder ?? stage.order.id, run }, t(locale, 'journey.btnSendRun'))} />
        )}
        {busy && (
          <p className={s.evTyping} role="status">
            <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
            <span className={s.srOnly}>{t(locale, 'erpAsk.typing')}</span>
          </p>
        )}
        {!busy && (
          <ul ref={choiceList} className={`${s.evSuggest} ${s.evChoices}`} aria-label={t(locale, 'erpAsk.next')}>
            {choices.map((c, i) => (
              <li key={i}><button type="button" className={c.primary ? s.evPrimary : undefined} onClick={c.tap}><Rich text={c.label} /></button></li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

type Choice = { label: string; tap: () => void; primary?: boolean };

/** Thrown by a reply whose language was switched away mid-pause. */
const STALE = new Error('stale');
