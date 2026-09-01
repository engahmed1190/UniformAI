'use client';

import { GarmentSvg, logoGarmentIndex } from './garments';
import { type Concept, LABELS, conceptPrice } from '@/lib/spec';

export function ConceptCard({
  concept,
  logoText,
  employees,
  selected,
  onSelect,
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
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        textAlign: 'left', cursor: 'pointer', background: '#fff', font: 'inherit',
        border: selected ? '2px solid #1b2a4a' : '1px solid #dcdfe4',
        borderRadius: 10, padding: 16, display: 'block', width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong style={{ fontSize: 15 }}>{concept.name}</strong>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {concept.logo.position === 'none' ? 'no logo' : `${concept.logo.method}, ${concept.logo.position.replace('_', ' ')}`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, background: '#f7f8fa', borderRadius: 6, padding: 8 }}>
        {concept.garments.map((g, i) => (
          <div key={i} style={{ flex: 1 }}>
            <GarmentSvg garment={g} logo={concept.logo} logoText={logoText} showLogo={i === logoAt} />
          </div>
        ))}
      </div>
      <table style={{ width: '100%', fontSize: 12, marginTop: 10, borderCollapse: 'collapse' }}>
        <tbody>
          {concept.garments.map((g, i) => (
            <tr key={i}>
              <td style={{ padding: '2px 0' }}>{LABELS[g.type]}</td>
              <td style={{ color: '#6b7280' }}>{g.fabric}</td>
              <td style={{ textAlign: 'right' }}>{g.unitPrice} EGP</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ borderTop: '1px solid #eceef1', marginTop: 8, paddingTop: 8, fontSize: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Per employee</span><strong>{per.toLocaleString()} EGP</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
          <span>× {employees} employees</span>
          <span>{(per * employees).toLocaleString()} EGP</span>
        </div>
      </div>
    </button>
  );
}
