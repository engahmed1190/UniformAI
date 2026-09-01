'use client';

import { useMemo, useRef, useState } from 'react';
import s from '@/app/ui.module.css';
import { GarmentSvg, logoGarmentIndex } from './garments';
import { SWATCHES, colourName, refine } from '@/lib/refine';
import { stepAdvice } from '@/lib/manager';
import { ManagerNote } from './manager';
import {
  type Concept, type LogoMethod, type LogoPosition,
  LABELS, PARTS, setLogo, setPart,
} from '@/lib/spec';

type Msg = { who: 'you' | 'app'; text: string; patch?: string };

const money = (n: number) => `EGP ${Math.round(n).toLocaleString()}`;

const STEPS = ['Garments', 'Colours', 'Branding', 'Quantity'] as const;

export const FABRICS = [
  { name: 'Cotton pique', note: '220 GSM · breathable everyday knit', delta: 0 },
  { name: 'Combed cotton', note: '240 GSM · softer hand, holds colour', delta: 45 },
  { name: 'Performance knit', note: 'Moisture wicking · best for heat', delta: 90 },
];

const LOGO_METHODS: { id: LogoMethod; name: string; note: string; price: number }[] = [
  { id: 'embroidery', name: 'Embroidery', note: 'Stitched. Hard wearing, premium finish.', price: 35 },
  { id: 'print', name: 'Screen print', note: 'Printed. Lower cost, best on flat knits.', price: 18 },
];

const PLACEMENTS: { id: LogoPosition; name: string; note: string }[] = [
  { id: 'left_chest', name: 'Left chest', note: 'The default for corporate wear.' },
  { id: 'right_chest', name: 'Right chest', note: 'Use when a name badge sits left.' },
  { id: 'sleeve', name: 'Sleeve', note: 'Subtle. Good for client-facing teams.' },
  { id: 'back', name: 'Back', note: 'High visibility across a floor or site.' },
  { id: 'none', name: 'No logo', note: 'Plain garments, no branding cost.' },
];

export function Configurator({
  concept, onChange, logoText, staff, onStaffChange,
  fabric, onFabricChange, spare, onSpareChange, perPerson, sets,
  brief, onSave,
}: {
  concept: Concept;
  onChange: (c: Concept) => void;
  logoText: string;
  staff: number;
  onStaffChange: (n: number) => void;
  fabric: number;
  onFabricChange: (i: number) => void;
  spare: number;
  onSpareChange: (n: number) => void;
  /** Computed by the page, so the price bar and the quote always agree. */
  perPerson: number;
  sets: number;
  /** The customer's own words, so advice can refer back to them. */
  brief: string;
  onSave: () => void;
}) {
  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState(0); // garment being coloured
  const [log, setLog] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const logEnd = useRef<HTMLDivElement>(null);

  const topIdx = logoGarmentIndex(concept.garments);
  const per = perPerson;

  // Only the colour step makes individual garments selectable.
  const picking = step === 1;

  const parts = useMemo(
    () => PARTS[concept.garments[focus]?.type] ?? [],
    [concept, focus],
  );

  function submitAsk(text: string) {
    const q = text.trim();
    if (!q) return;
    setDraft('');
    const applied = refine(concept, q);
    const next: Msg[] = [{ who: 'you', text: q }];
    if (applied) {
      onChange(applied.concept);
      next.push({ who: 'app', text: applied.note, patch: applied.patch });
    } else {
      next.push({
        who: 'app',
        text: 'I can change a colour, a part of a garment, or where the logo sits. Try “make the trouser navy”.',
      });
    }
    setLog((l) => [...l, ...next]);
    requestAnimationFrame(() => logEnd.current?.scrollIntoView({ block: 'nearest' }));
  }

  return (
    <div className={s.config}>
        {/* Preview stays put while the steps change beside it. */}
        <div className={s.stage}>
          <div className={s.stageTop}>
            <div>
              <div className={s.stageTitle}>{concept.name}</div>
              <div className={s.stageSub}>
                {concept.garments.map((g) => LABELS[g.type]).join(' · ')}
              </div>
            </div>
            <span className={s.pill}>{FABRICS[fabric].name}</span>
          </div>

          <div className={s.stageArea}>
            {concept.garments.map((g, i) =>
              picking ? (
                <button
                  key={i}
                  type="button"
                  className={s.garmentBtn}
                  aria-pressed={i === focus}
                  aria-label={`Colour the ${LABELS[g.type]}`}
                  onClick={() => setFocus(i)}
                >
                  <GarmentSvg garment={g} logo={concept.logo} logoText={logoText} showLogo={i === topIdx} />
                </button>
              ) : (
                <div key={i}>
                  <GarmentSvg garment={g} logo={concept.logo} logoText={logoText} showLogo={i === topIdx} />
                </div>
              ),
            )}
          </div>

          <div className={s.stageFoot}>
            <span>
              {concept.logo.position === 'back'
                ? 'Showing the back, where the logo goes'
                : picking
                  ? 'Select a garment to recolour it'
                  : 'Preview updates as you choose'}
            </span>
            <span className={s.mono}>{money(per)} / person</span>
          </div>
        </div>

        <div className={s.steps}>
          <div className={s.trail}>
            {STEPS.map((name, i) => (
              <button
                key={name}
                type="button"
                className={`${s.trailStep} ${i < step ? s.trailDone : ''} ${i === step ? s.trailCurrent : ''}`}
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}: ${name}`}
              >
                <span className={s.trailBar} />
                <span className={s.trailNum}>{i < step ? '✓' : i + 1}</span>
                <span className={s.trailName}>{name}</span>
              </button>
            ))}
          </div>

          <div className={s.panel}>
            {step === 0 && (
              <>
                <div className={s.panelHead}>
                  <h3>Fabric</h3>
                  <p>This kit includes {concept.garments.map((g) => LABELS[g.type]).join(', ')}.</p>
                </div>
                <div className={s.optList}>
                  {FABRICS.map((f, i) => (
                    <button
                      key={f.name}
                      type="button"
                      className={s.opt}
                      aria-pressed={i === fabric}
                      onClick={() => onFabricChange(i)}
                    >
                      <span className={s.optMark}>{i === fabric ? <Tick /> : null}</span>
                      <span className={s.optText}>
                        <span className={s.optName}>{f.name}</span>
                        <span className={s.optNote}>{f.note}</span>
                      </span>
                      <span className={s.optPrice}>{f.delta ? `+${f.delta}` : 'Included'}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className={s.panelHead}>
                  <h3>Colours</h3>
                  <p>Editing the {LABELS[concept.garments[focus].type].toLowerCase()}. Pick another garment in the preview to switch.</p>
                </div>
                {parts.map((part) => (
                  <div className={s.partBlock} key={part}>
                    <div className={s.partName}>{part}</div>
                    <div className={s.partCurrent}>
                      {colourName(concept.garments[focus].parts[part])}
                    </div>
                    <div className={s.swatches}>
                      {SWATCHES.map(([hex, name]) => (
                        <button
                          key={hex}
                          type="button"
                          className={s.swatch}
                          aria-pressed={concept.garments[focus].parts[part]?.toLowerCase() === hex.toLowerCase()}
                          onClick={() => onChange(setPart(concept, focus, part, hex))}
                        >
                          <span className={s.swatchChip} style={{ background: hex }} />
                          <span className={s.swatchName}>{name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            {step === 2 && (
              <>
                <div className={s.panelHead}>
                  <h3>Branding</h3>
                  <p>Charged once per person, whatever the kit contains.</p>
                </div>
                <div className={s.optList}>
                  {LOGO_METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={s.opt}
                      aria-pressed={concept.logo.method === m.id && concept.logo.position !== 'none'}
                      onClick={() =>
                        onChange(setLogo(concept, {
                          method: m.id,
                          ...(concept.logo.position === 'none' ? { position: 'left_chest' as LogoPosition } : {}),
                        }))
                      }
                    >
                      <span className={s.optMark}>
                        {concept.logo.method === m.id && concept.logo.position !== 'none' ? <Tick /> : null}
                      </span>
                      <span className={s.optText}>
                        <span className={s.optName}>{m.name}</span>
                        <span className={s.optNote}>{m.note}</span>
                      </span>
                      <span className={s.optPrice}>+{m.price}</span>
                    </button>
                  ))}
                </div>

                <div className={s.partBlock}>
                  <div className={s.partName}>Placement</div>
                  <div className={s.optList}>
                    {PLACEMENTS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={s.opt}
                        aria-pressed={concept.logo.position === p.id}
                        onClick={() => onChange(setLogo(concept, { position: p.id }))}
                      >
                        <span className={s.optMark}>{concept.logo.position === p.id ? <Tick /> : null}</span>
                        <span className={s.optText}>
                          <span className={s.optName}>{p.name}</span>
                          <span className={s.optNote}>{p.note}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className={s.panelHead}>
                  <h3>Quantity</h3>
                  <p>Spare stock covers new starters and replacements.</p>
                </div>
                <div className={s.field}>
                  <label htmlFor="staffCount">People to kit out</label>
                  <input
                    id="staffCount"
                    type="number"
                    min={1}
                    value={staff}
                    onChange={(e) => onStaffChange(Math.max(1, +e.target.value || 1))}
                  />
                </div>
                <div className={s.field}>
                  <label htmlFor="spare">Spare stock</label>
                  <select id="spare" value={spare} onChange={(e) => onSpareChange(+e.target.value)}>
                    <option value={0}>None — exactly {staff} sets</option>
                    <option value={0.05}>5% spare — {Math.ceil(staff * 1.05)} sets</option>
                    <option value={0.1}>10% spare — {Math.ceil(staff * 1.1)} sets</option>
                  </select>
                  <div className={s.fieldHint}>
                    Sizes are collected from staff after the order is placed.
                  </div>
                </div>
              </>
            )}

            <ManagerNote note={stepAdvice(step, concept, fabric, brief, staff, spare)} />

            {/* Available at every step: describe the change instead of hunting for it. */}
            <div className={s.ask}>
              <div className={s.askHead}>Or just tell me what to change</div>
              {log.length === 0 && (
                <p className={s.askHint}>
                  I will show you exactly what I changed, so nothing moves that you did not ask for.
                </p>
              )}
              {log.length > 0 && (
                <div className={s.askLog}>
                  {log.map((m, i) => (
                    <div key={i} className={`${s.msg} ${m.who === 'you' ? s.msgYou : s.msgApp}`}>
                      {m.text}
                      {m.patch && <span className={s.patch}>{m.patch}</span>}
                    </div>
                  ))}
                  <div ref={logEnd} />
                </div>
              )}
              <form
                className={s.askForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  submitAsk(draft);
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Make the trouser navy"
                  aria-label="Describe a change"
                />
                <button type="submit" className={`${s.btn} ${s.btnSecondary}`}>Apply</button>
              </form>
              <div className={s.askChips}>
                {['Make the trouser navy', 'Try a white shirt', 'Move the logo to the sleeve'].map((q) => (
                  <button key={q} type="button" onClick={() => submitAsk(q)}>{q}</button>
                ))}
              </div>
            </div>
          </div>

          <div className={s.stepNav}>
            {step > 0 && (
              <button
                type="button"
                className={`${s.btn} ${s.btnSecondary}`}
                onClick={() => setStep((n) => n - 1)}
              >
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className={`${s.btn} ${s.btnPrimary} ${s.grow}`}
                onClick={() => setStep((n) => n + 1)}
              >
                Next: {STEPS[step + 1]}
              </button>
            ) : (
              <button
                type="button"
                className={`${s.btn} ${s.btnSecondary} ${s.grow}`}
                onClick={onSave}
              >
                Save as a kit
              </button>
            )}
          </div>
        </div>
    </div>
  );
}

function Tick() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 5.2 3.8 7.5 8.5 2.5" />
    </svg>
  );
}
