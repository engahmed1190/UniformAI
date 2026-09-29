'use client';

// The few things the conversation asks the customer to fill in or look at:
// a number of people, a quotation, invoices, and the size run.

import { useState } from 'react';
import s from '@/app/ui.module.css';
import { type Locale, formatCurrency, formatDate, formatNumber, t } from '@/lib/i18n';
import type { Order } from '@/lib/order';
import type { QuoteView } from '@/lib/quote-view';
import type { Invoice } from '@/lib/invoices';
import { type GarmentCut, type GarmentSize, type SizeAllocation, SIZES } from '@/lib/spec';
import { cutsOf, proposedSplit, runTotal } from '@/lib/size-run';

const day = (locale: Locale, iso: string) => formatDate(locale, new Date(`${iso}T12:00:00`));

export function PeopleForm({ locale, onSubmit }: { locale: Locale; onSubmit: (people: number) => void }) {
  const [people, setPeople] = useState(20);
  const ok = Number.isInteger(people) && people >= 1 && people <= 500;
  return (
    <form className={s.evPanel} onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit(people); }}>
      <input type="number" min={1} max={500} inputMode="numeric" value={people} autoFocus
        aria-label={t(locale, 'journey.people')} onChange={(e) => setPeople(Math.floor(Number(e.target.value)))} />
      <button type="submit" className={s.evPrimary} disabled={!ok}>{t(locale, 'journey.btnContinue')}</button>
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
            <span>{t(locale, 'journey.quote.each', { qty: formatNumber(locale, l.qty), rate: money(l.rate) })}</span>
          </li>
        ))}
      </ul>
      {view.discountPct > 0 && <p>{t(locale, 'journey.quote.discount', { pct: view.discountPct })}</p>}
      <p className={s.evTotal}><span>{t(locale, 'journey.quote.total')}</span><b>{money(view.total)}</b></p>
      {view.validTill && <p>{t(locale, 'journey.quote.valid', { date: day(locale, view.validTill) })}</p>}
    </section>
  );
}

export function InvoiceList({ rows, locale }: { rows: Invoice[]; locale: Locale }) {
  if (!rows.length) return null;
  return (
    <ul className={s.evLines}>
      {rows.slice(0, 6).map((r) => (
        <li key={r.name}>
          <span className={s.evId}>{r.name}</span>
          <span>{formatCurrency(locale, r.total)}</span>
          <span className={`${s.evChip} ${s[`evChip_${r.status}`]}`}>{t(locale, `journey.inv.${r.status}`)}</span>
          <small>{t(locale, 'journey.invDue', { date: day(locale, r.due) })}</small>
        </li>
      ))}
    </ul>
  );
}

export function SizeRunForm({ order, initial, locale, onReview }: {
  order: Order; initial?: SizeAllocation; locale: Locale; onReview: (run: SizeAllocation) => void;
}) {
  const cuts = cutsOf(order.concept);
  const [run, setRun] = useState<SizeAllocation>(initial ?? {});
  const done = runTotal(run);
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
        <button type="button" onClick={() => setRun(proposedSplit(cuts, order.sets))}>
          {t(locale, 'journey.btnSplit')}
        </button>
        <button type="button" className={s.evPrimary} disabled={done !== order.sets} onClick={() => onReview(run)}>
          {t(locale, 'journey.btnReviewRun')}
        </button>
      </div>
    </div>
  );
}
