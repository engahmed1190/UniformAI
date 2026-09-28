'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import s from '@/app/ui.module.css';
import { type Locale, formatCurrency, formatDate, formatNumber, t } from '@/lib/i18n';
import { type Intent, answer } from '@/lib/answers';
import { type Change, type Source, type Step, changesSince, remember, sourceKey } from '@/lib/evidence';

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
type Turn = { role: 'user'; content: string } | { role: 'prompt'; content: string } | Answer;

/** Where the guided flow is, which decides the buttons on offer. */
type Stage =
  | { k: 'menu' }
  | { k: 'garment'; intent: 'stock' | 'price' }
  | { k: 'colour'; item: string }
  | { k: 'size'; item: string; colour: string }
  | { k: 'orders'; ids: string[] }
  | { k: 'order'; id: string }
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

function stepText(locale: Locale, step: Step): string {
  const i = step.input;
  const what = [i.item, i.colour, i.size].filter((v) => typeof v === 'string' && v).join(' ');
  if (step.tool === 'orders') return t(locale, 'erpAsk.stepOrders');
  if (step.tool === 'order') return t(locale, 'erpAsk.stepOrder', { id: String(i.id ?? '') });
  if (step.tool === 'stock') return t(locale, 'erpAsk.stepStock', { what });
  if (step.tool === 'price') return t(locale, 'erpAsk.stepPrice', { what });
  return t(locale, 'erpAsk.stepOptions');
}

function stepMeta(locale: Locale, step: Step): string {
  if (step.state === 'error') return t(locale, 'erpAsk.stepFailed');
  if (step.state !== 'done') return '';
  if (!step.rows) return t(locale, 'erpAsk.stepNone');
  return t(locale, 'erpAsk.stepFound', { count: step.rows, secs: ((step.ms ?? 0) / 1000).toFixed(1) });
}

const clock = (locale: Locale, iso: string) => new Intl.DateTimeFormat(
  locale === 'ar' ? 'ar-EG' : 'en-GB',
  { hour: '2-digit', minute: '2-digit', second: '2-digit', numberingSystem: 'latn' } as Intl.DateTimeFormatOptions,
).format(new Date(iso));

const day = (locale: Locale, iso?: string) => (iso ? formatDate(locale, new Date(`${iso}T12:00:00`)) : '');

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
              { date: day(locale, source.date) })}</span>
          )}
        </div>
      )}

      {changes && (
        <p className={s.evNote}>
          {t(locale, 'erpAsk.updated')}
          {otherChange && <> <s dir="auto">{otherChange.field === 'detail' && isOrder
            ? status(locale, otherChange.from) : String(otherChange.from)}</s></>}
        </p>
      )}

      <div className={s.evFoot}>
        <time dateTime={source.readAt}>{t(locale, 'erpAsk.checkedAt', { time: clock(locale, source.readAt) })}</time>
        {isOrder && onOpenOrder && (
          <button type="button" className={s.evOpen} onClick={() => onOpenOrder(source.name)}>
            {t(locale, 'erpAsk.showOrder')}
          </button>
        )}
      </div>
    </li>
  );
}

function Trail({ steps, locale }: { steps: Step[]; locale: Locale }) {
  if (!steps.length) return null;
  return (
    <ol className={s.evTrail}>
      {steps.map((step) => (
        <li key={step.id} className={s[`evStep_${step.state}`]}>
          <span className={s.evDot} aria-hidden="true" />
          <span dir="auto">{stepText(locale, step)}</span>
          <small>{stepMeta(locale, step)}</small>
        </li>
      ))}
    </ol>
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
      <Trail steps={turn.steps} locale={locale} />

      {turn.error && (
        <div className={s.evError} role="alert">
          <p>{t(locale, turn.error === 'not_configured' ? 'erpAsk.errorConfig' : 'erpAsk.errorUnreachable')}</p>
          <button type="button" onClick={onRetry} disabled={busy}>{t(locale, 'erpAsk.retry')}</button>
        </div>
      )}

      {content && <p className={s.evAnswer} dir="auto">{content}</p>}

      {content && (sources.length ? (
        <section className={s.evSources} aria-label={t(locale, 'erpAsk.evidence')}>
          <h3>{sources.length === 1
            ? t(locale, 'erpAsk.evidenceOne')
            : t(locale, 'erpAsk.evidenceMany', { count: sources.length })}</h3>
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

export function AskErp({ locale, request, onOpenOrder }: {
  locale: Locale;
  request?: AskRequest | null;
  /** Opens an order the assistant cited on the Orders screen. */
  onOpenOrder?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [stage, setStage] = useState<Stage>({ k: 'menu' });
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

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy, stage]);

  const patchLast = (fn: (a: Answer) => Answer) => setTurns((all) => {
    const last = all[all.length - 1];
    return last && last.role === 'assistant' ? [...all.slice(0, -1), fn(last)] : all;
  });

  const promptFor = (next: Stage): string | null =>
    next.k === 'menu' ? t(locale, 'erpAsk.introTitle')
      : next.k === 'garment' ? t(locale, garments.length ? 'erpAsk.pickGarment' : 'erpAsk.pickNone')
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
      patchLast((a) => ({ ...a, steps: [data.step], rows: data.rows, sources: data.sources, changes }));
      if (intent === 'orders') setStage({ k: 'orders', ids: (data.rows as { id: string }[]).map((r) => r.id) });
      else if (intent === 'order') setStage({ k: 'order', id: params.id });
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
      const code = (error as { code?: string }).code;
      patchLast((a) => ({
        ...a, steps: a.steps.map((x) => ({ ...x, state: 'error' as const })),
        error: code === 'not_configured' ? 'not_configured' : 'unreachable',
      }));
      setStage({ k: 'menu' });
    } finally {
      setBusy(false);
    }
  }, [busy, locale]);

  // The order card's button: open the dock straight on that order's details.
  const handled = useRef<number | null>(null);
  useEffect(() => {
    if (!request || busy || handled.current === request.id) return;
    handled.current = request.id;
    setOpen(true);
    void read('order', { id: request.orderId }, t(locale, 'erpAsk.btnDetails', { id: request.orderId }));
  }, [request, busy, read, locale]);

  const online = health === 'live' ? t(locale, 'erpAsk.live')
    : health === 'offline' ? t(locale, 'erpAsk.offline') : t(locale, 'erpAsk.probing');

  const menu = (): Choice[] => [
    { label: t(locale, 'erpAsk.btnOrders'), tap: () => void read('orders', {}, t(locale, 'erpAsk.btnOrders')) },
    { label: t(locale, 'erpAsk.btnStock'), tap: () => { purpose.current = 'stock'; void read('options', {}, t(locale, 'erpAsk.btnStock')); } },
    { label: t(locale, 'erpAsk.btnPrice'), tap: () => { purpose.current = 'price'; void read('options', {}, t(locale, 'erpAsk.btnPrice')); } },
  ];
  const toMenu: Choice = { label: t(locale, 'erpAsk.btnMenu'), tap: () => go({ k: 'menu' }, t(locale, 'erpAsk.btnMenu')) };
  const garment = garments.find((g) => stage.k === 'colour' || stage.k === 'size' ? g.item === stage.item : false);

  const choices: Choice[] = stage.k === 'menu' ? menu()
    : stage.k === 'garment' ? [
      ...garments.map((g) => ({
        label: g.item,
        tap: () => {
          if (stage.intent === 'price') void read('price', { item: g.item }, g.item);
          else go({ k: 'colour', item: g.item }, g.item);
        },
      })),
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
            ...stage.ids.map((id) => ({
              label: t(locale, 'erpAsk.btnDetails', { id }),
              tap: () => void read('order', { id }, t(locale, 'erpAsk.btnDetails', { id })),
            })),
            toMenu,
          ]
            : stage.k === 'order' ? [
              ...(onOpenOrder ? [{ label: t(locale, 'erpAsk.showOrder'), tap: () => onOpenOrder(stage.id) }] : []),
              toMenu,
            ]
              : stage.k === 'stock' ? [
                {
                  label: t(locale, 'erpAsk.btnAgain'),
                  tap: () => { if (lastStock.current) void read('stock', lastStock.current, t(locale, 'erpAsk.btnAgain')); },
                },
                {
                  label: t(locale, 'erpAsk.btnAnother'),
                  tap: () => { purpose.current = 'stock'; void read('options', {}, t(locale, 'erpAsk.btnAnother')); },
                },
                toMenu,
              ]
                : [toMenu];

  if (!open) {
    return (
      <button type="button" className={s.evLauncher} onClick={() => setOpen(true)}
        aria-haspopup="dialog" title={online}>
        <span className={`${s.evLive} ${s[`evLive_${health}`]}`} aria-hidden="true" />
        {t(locale, 'erpAsk.launcher')}
      </button>
    );
  }

  return (
    <aside className={s.evSheet} role="dialog" aria-label={t(locale, 'erpAsk.title')}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      <header className={s.evHead}>
        <div>
          <h2>{t(locale, 'erpAsk.title')}</h2>
          <p className={s.evStatus}>
            <span className={`${s.evLive} ${s[`evLive_${health}`]}`} aria-hidden="true" />
            <span dir="auto">{online}</span>
          </p>
        </div>
        <button type="button" className={s.dockClose} onClick={() => setOpen(false)}
          aria-label={t(locale, 'erpAsk.close')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="m4 4 8 8m0-8-8 8" />
          </svg>
        </button>
      </header>

      <div className={s.evBody} ref={log} aria-live="polite">
        {!turns.length && (
          <div className={s.evIntro}>
            <h3>{t(locale, 'erpAsk.introTitle')}</h3>
            <p>{t(locale, 'erpAsk.intro')}</p>
          </div>
        )}
        {turns.map((turn, index) => turn.role === 'user' ? (
          <p key={index} className={`${s.msg} ${s.msgYou} ${s.evQuestion}`} dir="auto">{turn.content}</p>
        ) : turn.role === 'prompt' ? (
          <p key={index} className={s.evAnswer} dir="auto">{turn.content}</p>
        ) : (
          <Reply key={index} turn={turn} locale={locale} busy={busy && index === turns.length - 1}
            onRetry={() => void read(turn.intent, turn.params, undefined, true)} onOpenOrder={onOpenOrder} />
        ))}
        {!busy && (
          <ul className={`${s.evSuggest} ${s.evChoices}`} aria-label={t(locale, 'erpAsk.next')}>
            {choices.map((c) => (
              <li key={c.label}><button type="button" onClick={c.tap}>{c.label}</button></li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

type Choice = { label: string; tap: () => void };
