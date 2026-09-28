'use client';

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import s from '@/app/ui.module.css';
import { type Locale, formatCurrency, formatDate, formatNumber, t } from '@/lib/i18n';
import {
  type AskEvent, type Change, type Source, type Step, changesSince, remember, sourceKey,
} from '@/lib/evidence';

type Health = 'probing' | 'live' | 'offline';

type Answer = {
  role: 'assistant';
  question: string;
  steps: Step[];
  content?: string;
  sources?: Source[];
  changes?: Record<string, Change[]>;
  error?: 'unreachable' | 'not_configured';
};
type Turn = { role: 'user'; content: string } | Answer;

/** A request from outside the dock, e.g. the order card's button. `id` makes
 *  asking the same question twice still count as a new request. */
export type AskRequest = { question: string; id: number };

const KIND: Record<string, string> = {
  'Sales Order': 'kindSalesOrder', 'Sales Invoice': 'kindSalesInvoice', Bin: 'kindBin', Item: 'kindItem',
};

/** ERP order statuses in the customer's words. Anything unmapped shows as it
 *  is stored rather than vanishing. */
const STATUS: Record<string, string> = {
  'To Deliver and Bill': 'stInProgress', 'To Deliver': 'stInProgress', 'To Bill': 'stDelivered',
  Completed: 'stCompleted', Closed: 'stCompleted', Cancelled: 'stCancelled', 'On Hold': 'stOnHold',
  Draft: 'stDraft',
};

const status = (locale: Locale, value: string | number) =>
  STATUS[String(value)] ? t(locale, `erpAsk.${STATUS[String(value)]}`) : String(value);

function stepText(locale: Locale, step: Step): string {
  const i = step.input;
  const what = [i.item, i.colour, i.size].filter((v) => typeof v === 'string' && v).join(' ');
  if (step.tool === 'find_orders') {
    return typeof i.order_id === 'string' && i.order_id
      ? t(locale, 'erpAsk.stepOrder', { id: i.order_id })
      : t(locale, 'erpAsk.stepOrders');
  }
  if (step.tool === 'check_stock') return t(locale, 'erpAsk.stepStock', { what });
  return t(locale, 'erpAsk.stepPrice', { what });
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
  const isOrder = source.doctype === 'Sales Order';
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

function Trail({ steps, writing, locale }: { steps: Step[]; writing: boolean; locale: Locale }) {
  if (!steps.length && !writing) return null;
  return (
    <ol className={s.evTrail}>
      {steps.map((step) => (
        <li key={step.id} className={s[`evStep_${step.state}`]}>
          <span className={s.evDot} aria-hidden="true" />
          <span dir="auto">{stepText(locale, step)}</span>
          <small>{stepMeta(locale, step)}</small>
        </li>
      ))}
      {writing && (
        <li className={s.evStep_running}>
          <span className={s.evDot} aria-hidden="true" />
          <span>{t(locale, 'erpAsk.thinking')}</span>
        </li>
      )}
    </ol>
  );
}

function Reply({ turn, busy, locale, onRetry, onOpenOrder }: {
  turn: Answer; busy: boolean; locale: Locale; onRetry: () => void; onOpenOrder?: (id: string) => void;
}) {
  const running = turn.steps.some((x) => x.state === 'running');
  const writing = busy && !turn.content && !turn.error && !running;
  const sources = turn.sources ?? [];
  return (
    <div className={s.evReply}>
      <Trail steps={turn.steps} writing={writing} locale={locale} />

      {turn.error && (
        <div className={s.evError} role="alert">
          <p>{t(locale, turn.error === 'not_configured' ? 'erpAsk.errorConfig' : 'erpAsk.errorUnreachable')}</p>
          <button type="button" onClick={onRetry} disabled={busy}>{t(locale, 'erpAsk.retry')}</button>
        </div>
      )}

      {turn.content && <p className={s.evAnswer} dir="auto">{turn.content}</p>}

      {turn.content && (sources.length ? (
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
          <b>{t(locale, 'erpAsk.noRecord')}</b>
          <span>{t(locale, 'erpAsk.noRecordNote')}</span>
        </div>
      ))}
    </div>
  );
}

export function AskErp({ locale, request, onOpenOrder }: {
  locale: Locale;
  request?: AskRequest | null;
  /** Opens an order the assistant cited on the Orders screen. */
  onOpenOrder?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<Health>('probing');
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // The last value shown for every record, across the whole conversation.
  const seen = useRef(new Map<string, Source>());

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
  }, [turns, busy]);

  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  const patchLast = (fn: (a: Answer) => Answer) => setTurns((all) => {
    const last = all[all.length - 1];
    return last?.role === 'assistant' ? [...all.slice(0, -1), fn(last)] : all;
  });

  const send = useCallback(async (question: string, retry = false) => {
    const clean = question.trim();
    if (!clean || busy) return;
    // Only answered turns go back as history. A failed turn's error text is
    // not something the model said, and replaying it confuses the next answer.
    const history = turns
      .filter((x) => x.role === 'user' || (x.content && !x.error))
      .slice(-6)
      .map((x) => ({ role: x.role, content: x.content ?? '' }));
    setTurns((all) => [
      ...(retry ? all.slice(0, -2) : all),
      { role: 'user', content: clean },
      { role: 'assistant', question: clean, steps: [] },
    ]);
    setDraft('');
    setBusy(true);
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: clean, history, locale }),
      });
      if (!response.ok || !response.body) throw new Error('request failed');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let settled = false;
      for (;;) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as AskEvent;
          if (event.type === 'step') {
            patchLast((a) => ({
              ...a,
              steps: a.steps.some((x) => x.id === event.step.id)
                ? a.steps.map((x) => (x.id === event.step.id ? event.step : x))
                : [...a.steps, event.step],
            }));
          } else if (event.type === 'answer') {
            settled = true;
            const changes = Object.fromEntries(changesSince(seen.current, event.sources));
            remember(seen.current, event.sources);
            patchLast((a) => ({ ...a, content: event.answer, sources: event.sources, changes }));
          } else {
            settled = true;
            patchLast((a) => ({ ...a, error: event.error === 'not_configured' ? 'not_configured' : 'unreachable' }));
          }
        }
        if (done) break;
      }
      if (!settled) throw new Error('stream ended early');
    } catch {
      patchLast((a) => ({ ...a, error: 'unreachable' }));
    } finally {
      setBusy(false);
    }
  }, [busy, turns, locale]);

  // A question handed in from the order card: open, then ask it.
  const handled = useRef<number | null>(null);
  useEffect(() => {
    if (!request || handled.current === request.id) return;
    handled.current = request.id;
    setOpen(true);
    void send(request.question);
  }, [request, send]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  const online = health === 'live' ? t(locale, 'erpAsk.live')
    : health === 'offline' ? t(locale, 'erpAsk.offline') : t(locale, 'erpAsk.probing');
  const suggestions = ['q1', 'q2', 'q3', 'q4'].map((k) => t(locale, `erpAsk.${k}`));

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
            <p className={s.evTry}>{t(locale, 'erpAsk.tryOne')}</p>
            <ul className={s.evSuggest}>
              {suggestions.map((q) => (
                <li key={q}><button type="button" onClick={() => void send(q)} disabled={busy}>{q}</button></li>
              ))}
            </ul>
          </div>
        )}
        {turns.map((turn, index) => turn.role === 'user' ? (
          <p key={index} className={`${s.msg} ${s.msgYou} ${s.evQuestion}`} dir="auto">{turn.content}</p>
        ) : (
          <Reply key={index} turn={turn} locale={locale} busy={busy && index === turns.length - 1}
            onRetry={() => void send(turn.question, true)} onOpenOrder={onOpenOrder} />
        ))}
      </div>

      <div className={`${s.dockFoot} ${s.evCompose}`}>
        {turns.length > 0 && (
          <div className={s.askChips}>
            {suggestions.map((q) => (
              <button key={q} type="button" onClick={() => void send(q)} disabled={busy}>{q}</button>
            ))}
          </div>
        )}
        <form className={s.askForm} onSubmit={submit}>
          <input ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500}
            dir="auto" placeholder={t(locale, 'erpAsk.placeholder')} aria-label={t(locale, 'erpAsk.placeholder')} />
          <button className={s.askSend} type="submit" disabled={!draft.trim() || busy}
            aria-label={t(locale, 'erpAsk.send')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M8 13V4M4.5 7.5 8 4l3.5 3.5" />
            </svg>
          </button>
        </form>
      </div>
    </aside>
  );
}
