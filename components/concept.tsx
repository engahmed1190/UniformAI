'use client';

import { Check } from './check';
import s from '@/app/ui.module.css';
import { GarmentSvg, logoGarmentIndex } from './garments';
import { type Concept, conceptPrice, cutsOf } from '@/lib/spec';
import { type Locale, counted, kitName, t } from '@/lib/i18n';

export function ConceptCard({
  concept, logoText, employees, selected, onSelect, locale, money,
}: {
  concept: Concept;
  logoText: string;
  employees: number;
  selected: boolean;
  onSelect: () => void;
  locale: Locale;
  money: (n: number) => string;
}) {
  const per = conceptPrice(concept);
  const logoAt = logoGarmentIndex(concept.garments);
  const cuts = cutsOf(concept);
  const cutKey = cuts.includes('men') && cuts.includes('women') ? 'mixed' : cuts[0];
  const fits = [...new Set(concept.garments.map((g) => g.fit ?? 'regular'))]
    .map((fit) => t(locale, `fits.${fit}`)).join(' / ');
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={s.kit}>
      <span className={s.kitPreview}>
        {selected && <span className={s.kitCheck}><Check /></span>}
        {concept.garments.map((g, i) => (
          <GarmentSvg key={i} garment={g} logo={concept.logo} logoText={logoText} showLogo={i === logoAt} />
        ))}
      </span>
      <span className={s.kitBody}>
        <span className={s.kitName}>{kitName(locale, concept.id)}</span>
        <span className={s.kitMeta}>{concept.garments.map((g) => t(locale, `garments.${g.type}`)).join(' · ')}</span>
        <span className={s.kitMeta}>{t(locale, 'kits.specLine', {
          cuts: t(locale, `cuts.${cutKey}`), fit: fits,
        })}</span>
        <span className={s.kitFoot}>
          <span className={s.kitPer}>{t(locale, 'kits.forPeople', { price: money(per * employees), count: counted(locale, 'person', employees) })}</span>
          <span className={s.kitPrice}>{money(per)}</span>
        </span>
      </span>
    </button>
  );
}
