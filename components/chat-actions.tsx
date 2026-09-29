'use client';

// The few things the conversation asks the customer to fill in or look at:
// a number of people, a quotation, an order's progress, invoices, and the size run.

import { useState } from 'react';
import s from '@/app/ui.module.css';
import { type Locale, formatCurrency, formatDay, formatNumber, t } from '@/lib/i18n';
import type { Order } from '@/lib/order';
import type { QuoteView } from '@/lib/quote-view';
import { type Button, planTurn } from '@/lib/journey';
import type { InvoicesCardView, OrderCardView } from '@/lib/cards';
import { type GarmentCut, type GarmentSize, type SizeAllocation, SIZES } from '@/lib/spec';
import { cutsOf, proposedSplit, runTotal } from '@/lib/size-run';
import { splitCodes } from '@/lib/rich';

/** A sentence with its document numbers and amounts kept whole. */
export function Rich({ text }: { text: string }) {
  return <>{splitCodes(text).map((p, i) => (p.code ? <bdi key={i} className={s.evNum}>{p.text}</bdi> : p.text))}</>;
}

/** The number of people; the recommendation follows it live, and the one
 *  button requests the quotation. */
export function PeopleForm({ locale, kit, initial = 20, onRequest }: {
  locale: Locale; kit: string; initial?: number; onRequest: (b: Button) => void;
}) {
  const [people, setPeople] = useState(initial);
  // The last valid number, so a cleared field keeps the last recommendation.
  const [valid, setValid] = useState(initial);
  const ok = Number.isInteger(people) && people >= 1 && people <= 500;
  const plan = planTurn(locale, kit, valid);
  const request = plan.buttons[0];
  return (
    <form className={s.evPanel} onSubmit={(e) => { e.preventDefault(); if (ok) onRequest(request); }}>
      <input type="number" min={1} max={500} inputMode="numeric" value={people} autoFocus
        aria-label={t(locale, 'journey.people')}
        onChange={(e) => {
          const n = Math.floor(Number(e.target.value));
          setPeople(n);
          if (Number.isInteger(n) && n >= 1 && n <= 500) setValid(n);
        }} />
      <p className={s.evRunLeft}><Rich text={plan.say} /></p>
      <button type="submit" className={s.evPrimary} disabled={!ok}><Rich text={request.label} /></button>
    </form>
  );
}

export function QuoteCard({ view, locale }: { view: QuoteView; locale: Locale }) {
  const money = (n: number) => formatCurrency(locale, n);
  const what = (l: QuoteView['lines'][number]) =>
    l.kind === 'garment' ? t(locale, `garments.${l.garment}`)
      : l.kind === 'branding' ? t(locale, l.method === 'print' ? 'branding.printedLogo' : 'branding.embroideredLogo')
        : t(locale, 'journey.quote.other');
  return (
    <section className={s.evCard} aria-label={t(locale, 'journey.quote.title', { id: view.name })}>
      <div className={s.evTop}>
        <span className={s.evKind}>{t(locale, 'erpAsk.kindQuotation')}</span>
        <span className={s.evId}>{view.name}</span>
      </div>
      <ul className={s.evLines}>
        {view.lines.map((l, i) => (
          <li key={i}>
            <span>{what(l)}</span>
            <span><Rich text={t(locale, 'journey.quote.each', { qty: formatNumber(locale, l.qty), rate: money(l.rate) })} /></span>
          </li>
        ))}
      </ul>
      {view.discountPct > 0 && <p>{t(locale, 'journey.quote.discount', { pct: view.discountPct })}</p>}
      <p className={s.evTotal}><span>{t(locale, 'journey.quote.total')}</span><b className={s.evNum}>{money(view.total)}</b></p>
      {view.validTill && <p>{t(locale, 'journey.quote.valid', { date: formatDay(locale, view.validTill) })}</p>}
    </section>
  );
}

export function OrderCard({ view, live, onAct }: { view: OrderCardView; live: boolean; onAct: (b: Button) => void }) {
  return (
    <section className={s.evCard} aria-label={`${view.title} ${view.id}`}>
      <div className={s.evTop}>
        <span className={s.evName} dir="auto">{view.title}</span>
        <bdi className={s.evId}>{view.id}</bdi>
      </div>
      <p className={s.evMeta}><Rich text={view.meta} /></p>
      {/* Seven segments, no labels under them: the one line below names the
          current step. Each segment keeps its name for hover and screen readers. */}
      <ol className={s.evSteps}>
        {view.steps.map((step) => (
          <li key={step.key} title={step.label} aria-current={step.state === 'now' ? 'step' : undefined}
            className={step.state === 'done' ? s.evStepDone : step.state === 'now' ? s.evStepNow : undefined}>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
      {view.progress && <p className={s.evProgress}>{view.progress}</p>}
      <p className={s.evNext}>{view.next}{view.date && <> · {view.date}</>}</p>
      {view.action && (
        <button type="button" className={s.evPrimary} disabled={!live} onClick={() => onAct(view.action!)}><Rich text={view.action.label} /></button>
      )}
    </section>
  );
}

export function InvoicesCard({ view, live, onAct }: { view: InvoicesCardView; live: boolean; onAct: (b: Button) => void }) {
  return (
    <section className={s.evCard} aria-label={view.outstanding}>
      <div className={s.evTop}><b className={s.evBig}><Rich text={view.outstanding} /></b><span>{view.open}</span></div>
      {view.rows.length > 0 && (
        <ul className={s.evLines}>
          {view.rows.map((r) => (
            <li key={r.id}>
              <bdi className={s.evId}>{r.id}</bdi>
              <bdi className={s.evNum}>{r.amount}</bdi>
              <span className={`${s.evChip} ${s[`evChip_${r.status}`]}`}>{r.label}</span>
              <small>{r.note}</small>
            </li>
          ))}
        </ul>
      )}
      {view.paid && <p className={s.evMeta}>{view.paid}</p>}
      {view.action && (
        <button type="button" className={s.evPrimary} disabled={!live} onClick={() => onAct(view.action!)}><Rich text={view.action.label} /></button>
      )}
    </section>
  );
}

/** Opens on the proposed split; the customer adjusts or simply sends. */
export function SizeRunCard({ order, locale, onSend }: { order: Order; locale: Locale; onSend: (run: SizeAllocation) => void }) {
  const cuts = cutsOf(order.concept);
  const [proposed] = useState(() => proposedSplit(cuts, order.sets));
  const [run, setRun] = useState<SizeAllocation>(proposed);
  const done = runTotal(run);
  // By value: a size typed back to its proposed number is not a change.
  const changed = cuts.some((cut) => SIZES.some((z) => (run[cut]?.[z] ?? 0) !== (proposed[cut]?.[z] ?? 0)));
  const set = (cut: GarmentCut, size: GarmentSize, n: number) =>
    setRun((r) => ({ ...r, [cut]: { ...r[cut], [size]: Math.max(0, Math.floor(n) || 0) } }));
  return (
    <div className={s.evPanel}>
      {cuts.map((cut) => (
        <fieldset key={cut} className={s.evRun}>
          <legend>{t(locale, `journey.cut.${cut}`)}</legend>
          {SIZES.map((size) => (
            <label key={size}>
              <span>{size}</span>
              <input type="number" min={0} max={order.sets} inputMode="numeric"
                value={run[cut]?.[size] ?? 0} onChange={(e) => set(cut, size, Number(e.target.value))} />
            </label>
          ))}
        </fieldset>
      ))}
      <p className={s.evRunLeft} aria-live="polite">
        {done > order.sets
          ? t(locale, 'journey.sizesOver', { done, over: done - order.sets })
          : t(locale, 'journey.sizesLeft', { done, left: order.sets - done })}
      </p>
      <div className={s.evRow}>
        {changed && <button type="button" onClick={() => setRun(proposed)}>{t(locale, 'journey.btnSplit')}</button>}
        <button type="button" className={s.evPrimary} disabled={done !== order.sets} onClick={() => onSend(run)}>
          {t(locale, 'journey.btnSendRun')}
        </button>
      </div>
    </div>
  );
}
