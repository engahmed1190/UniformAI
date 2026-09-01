'use client';

import { Check } from './check';
import s from '@/app/ui.module.css';
import { GarmentSvg, logoGarmentIndex } from './garments';
import { type Concept, LABELS, conceptPrice } from '@/lib/spec';

const money = (n: number) => `EGP ${Math.round(n).toLocaleString()}`;

export function ConceptCard({
  concept, logoText, employees, selected, onSelect,
}: {
  concept: Concept;
  logoText: string;
  employees: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const per = conceptPrice(concept);
  const logoAt = logoGarmentIndex(concept.garments);
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={s.kit}>
      <span className={s.kitPreview}>
        {selected && <span className={s.kitCheck}><Check /></span>}
        {concept.garments.map((g, i) => (
          <GarmentSvg key={i} garment={g} logo={concept.logo} logoText={logoText} showLogo={i === logoAt} />
        ))}
      </span>
      <span className={s.kitBody}>
        <span className={s.kitName}>{concept.name}</span>
        <span className={s.kitMeta}>{concept.garments.map((g) => LABELS[g.type]).join(' · ')}</span>
        <span className={s.kitFoot}>
          <span className={s.kitPer}>{money(per * employees)} for {employees}</span>
          <span className={s.kitPrice}>{money(per)}</span>
        </span>
      </span>
    </button>
  );
}
