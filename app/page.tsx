'use client';

import { useState } from 'react';
import { ConceptCard } from '@/components/concept';
import { selectConcepts } from '@/lib/concepts';
import {
  type Concept, PARTS, LABELS, setPart, setLogo, conceptPrice,
  type LogoPosition, type LogoMethod,
} from '@/lib/spec';

const LOGO_POSITIONS: LogoPosition[] = ['left_chest', 'right_chest', 'sleeve', 'back', 'none'];

export default function Page() {
  const [industry, setIndustry] = useState('Luxury real estate');
  const [employees, setEmployees] = useState(180);
  const [logoText, setLogoText] = useState('ACME');
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [sel, setSel] = useState(0);

  function generate() {
    setConcepts(selectConcepts({ industry }));
    setSel(0);
  }

  // Edits replace one concept in the list with a patched copy.
  function patch(fn: (c: Concept) => Concept) {
    setConcepts((cs) => cs && cs.map((c, i) => (i === sel ? fn(c) : c)));
  }

  const active = concepts?.[sel];
  const total = concepts?.reduce((s, c) => s + conceptPrice(c) * employees, 0) ?? 0;

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif', color: '#111827' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>AI Uniform Studio</h1>
      <p style={{ color: '#6b7280', fontSize: 13, marginTop: 0 }}>
        Concepts are structured specs, not pictures — every edit maps to a real colour on a real garment.
      </p>

      <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end',
        background: '#f7f8fa', padding: 16, borderRadius: 10, margin: '16px 0' }}>
        <Field label="Industry">
          <input value={industry} onChange={(e) => setIndustry(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Employees">
          <input type="number" min={1} value={employees}
            onChange={(e) => setEmployees(Math.max(1, +e.target.value || 1))}
            style={{ ...inputStyle, width: 100 }} />
        </Field>
        <Field label="Logo text">
          <input value={logoText} onChange={(e) => setLogoText(e.target.value)} style={{ ...inputStyle, width: 120 }} />
        </Field>
        <button onClick={generate} style={btnStyle}>Generate concepts</button>
      </section>

      {!concepts && (
        <p style={{ color: '#6b7280', fontSize: 14 }}>
          Enter a brief and generate. Try “facilities management” for an industrial kit.
        </p>
      )}

      {concepts && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            {concepts.map((c, i) => (
              <ConceptCard key={c.id} concept={c} logoText={logoText} employees={employees}
                selected={i === sel} onSelect={() => setSel(i)} />
            ))}
          </div>

          <div style={{ marginTop: 16, padding: 14, background: '#1b2a4a', color: '#fff', borderRadius: 10,
            display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
            <span>Estimated company uniform budget</span>
            <strong>{total.toLocaleString()} EGP</strong>
          </div>

          {active && (
            <section style={{ marginTop: 20, border: '1px solid #dcdfe4', borderRadius: 10, padding: 16 }}>
              <h2 style={{ fontSize: 15, marginTop: 0 }}>Editing: {active.name}</h2>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {active.garments.map((g, gi) => (
                  <div key={gi}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{LABELS[g.type]}</div>
                    {PARTS[g.type].map((part) => (
                      <label key={part} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
                        <input type="color" value={g.parts[part]}
                          onChange={(e) => patch((c) => setPart(c, gi, part, e.target.value))}
                          style={{ width: 34, height: 24, padding: 0, border: '1px solid #dcdfe4', borderRadius: 4 }} />
                        <span style={{ width: 60 }}>{part}</span>
                        <code style={{ color: '#6b7280' }}>{g.parts[part]}</code>
                      </label>
                    ))}
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Logo</div>
                  <select value={active.logo.position} style={inputStyle}
                    onChange={(e) => patch((c) => setLogo(c, { position: e.target.value as LogoPosition }))}>
                    {LOGO_POSITIONS.map((p) => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
                  </select>
                  <select value={active.logo.method} style={{ ...inputStyle, marginTop: 6 }}
                    onChange={(e) => patch((c) => setLogo(c, { method: e.target.value as LogoMethod }))}>
                    <option value="embroidery">embroidery (+35)</option>
                    <option value="print">print (+18)</option>
                  </select>
                </div>
              </div>
              <details style={{ marginTop: 14 }}>
                <summary style={{ fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>
                  Concept spec — this is what becomes an ERPNext item
                </summary>
                <pre style={{ fontSize: 11, background: '#f7f8fa', padding: 10, borderRadius: 6, overflowX: 'auto' }}>
                  {JSON.stringify(active, null, 2)}
                </pre>
              </details>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600 }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '7px 9px', border: '1px solid #dcdfe4', borderRadius: 6, font: 'inherit', fontSize: 13,
};
const btnStyle: React.CSSProperties = {
  padding: '8px 16px', background: '#1b2a4a', color: '#fff', border: 0, borderRadius: 6,
  font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
