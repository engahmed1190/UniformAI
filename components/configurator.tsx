'use client';

import { Check } from './check';
import { useMemo, useRef, useState } from 'react';
import s from '@/app/ui.module.css';
import { GarmentSvg, logoGarmentIndex } from './garments';
import { SWATCHES, colourName, refine } from '@/lib/refine';
import { stepAdvice } from '@/lib/manager';
import { type Locale, formatCurrency, kitName, t } from '@/lib/i18n';

/** colourName() answers in English -- it is shared with the parser. Turn its
 *  answer into the buyer's language, including the "Close to X" fallback. */
function swatchLabel(locale: Locale, name: string): string {
  const near = /^Close to (.+)$/.exec(name);
  if (near) return t(locale, 'colours.closeTo', { name: t(locale, `colours.${near[1]}`) });
  return t(locale, `colours.${name}`);
}
import { ManagerNote } from './manager';
import {
  type Concept, type LogoMethod, type LogoPosition,
  LABELS, PARTS, setLogo, setPart, gradesFor, gradeName,
} from '@/lib/spec';

type Msg = { who: 'you' | 'app'; text: string; patch?: string };


const STEPS = ['garments', 'colours', 'branding', 'quantity'] as const;

const SPARES = [0, 0.05, 0.1];

// Names and notes come from the dictionary, keyed by id.
const LOGO_METHODS: { id: LogoMethod; price: number }[] = [
  { id: 'embroidery', price: 35 },
  { id: 'print', price: 18 },
];

const PLACEMENTS: { id: LogoPosition }[] = [
  { id: 'left_chest' }, { id: 'right_chest' }, { id: 'sleeve' },
  { id: 'back' }, { id: 'none' },
];

export function Configurator({
  concept, onChange, logoText, staff, onStaffChange,
  grades, onGradesChange, spare, onSpareChange, perPerson, sets,
  brief, onSave, locale,
}: {
  locale: Locale;
  concept: Concept;
  onChange: (c: Concept) => void;
  logoText: string;
  staff: number;
  onStaffChange: (n: number) => void;
  /** One grade index per garment, into that garment's own family list. */
  grades: number[];
  onGradesChange: (g: number[]) => void;
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
    const applied = refine(concept, q, grades);
    const next: Msg[] = [{ who: 'you', text: q }];
    if (applied) {
      if (applied.concept !== concept) onChange(applied.concept);
      if (applied.grades) { onGradesChange(applied.grades); setStep(0); }
      if (applied.spare !== undefined) { onSpareChange(applied.spare); setStep(3); }
      next.push({ who: 'app', text: applied.note, patch: applied.patch });
    } else {
      next.push({
        who: 'app',
        text: 'I can change a colour, a fabric, the branding, or the spare stock. Try “make the trouser navy” or “use the performance knit”.',
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
              <div className={s.stageTitle}>{kitName(locale, concept.id)}</div>
              <div className={s.stageSub}>
                {concept.garments.map((g) => t(locale, `garments.${g.type}`)).join(' · ')}
              </div>
            </div>
            <span className={s.pill}>{
              // Compare grades, not cloth names: at grade 0 a shirt and a
              // blazer legitimately name different cloth and are not "mixed".
              new Set(concept.garments.map((_, i) => grades[i] ?? 0)).size > 1
                ? t(locale, 'configure.mixedGrades')
                : (grades[0] ?? 0) === 0
                  ? t(locale, 'configure.standardCloth')
                  : gradeName(concept.garments[0], grades[0])
            }</span>
          </div>

          <div className={s.stageArea}>
            {concept.garments.map((g, i) =>
              picking ? (
                <button
                  key={i}
                  type="button"
                  className={s.garmentBtn}
                  aria-pressed={i === focus}
                  aria-label={t(locale, 'configure.colourThe', { garment: t(locale, `garments.${g.type}`) })}
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
                ? t(locale, 'configure.showingBack')
                : picking
                  ? t(locale, 'configure.selectGarment')
                  : t(locale, 'configure.previewUpdates')}
            </span>
            <span className={s.mono}>{t(locale, 'configure.perPersonPrice', { price: formatCurrency(locale, per) })}</span>
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
                aria-label={t(locale, 'configure.step', { n: i + 1, name: t(locale, `configure.${name}`) })}
              >
                <span className={s.trailBar} />
                <span className={s.trailNum}>{i < step ? <Check /> : i + 1}</span>
                <span className={s.trailName}>{t(locale, `configure.${name}`)}</span>
              </button>
            ))}
          </div>

          <div className={s.panel}>
            {step === 0 && (
              <>
                <div className={s.panelHead}>
                  <h2>{t(locale, 'configure.fabric')}</h2>
                  <p>{t(locale, 'configure.fabricNote')}</p>
                </div>
                {/* A blazer has no "moisture-wicking knit" grade, so the
                    options come from the garment's own family. */}
                {concept.garments.map((g, gi) => (
                  <div className={s.partBlock} key={gi}>
                    <div className={s.partName}>{t(locale, `garments.${g.type}`)}</div>
                    <div className={s.optList}>
                      {gradesFor(g.type).map((f, i) => (
                        <button
                          key={f.name}
                          type="button"
                          className={s.opt}
                          aria-pressed={i === (grades[gi] ?? 0)}
                          onClick={() => onGradesChange(
                            concept.garments.map((_, j) => (j === gi ? i : grades[j] ?? 0)))}
                        >
                          <span className={s.optMark}>{i === (grades[gi] ?? 0) ? <Tick /> : null}</span>
                          <span className={s.optText}>
                            <span className={s.optName}>{gradeName(g, i)}</span>
                            <span className={s.optNote}>{t(locale, f.note)}</span>
                          </span>
                          <span className={s.optPrice}>{f.delta ? `+${f.delta}` : t(locale, 'common.included')}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            {step === 1 && (
              <>
                <div className={s.panelHead}>
                  <h2>{t(locale, 'configure.colours')}</h2>
                  <p>{t(locale, 'configure.coloursNote', { garment: t(locale, `garments.${concept.garments[focus].type}`) })}</p>
                </div>
                {parts.map((part) => (
                  <div className={s.partBlock} key={part}>
                    <div className={`${s.partName} ${s.partNameData}`}>{t(locale, `parts.${part}`)}</div>
                    <div className={s.partCurrent}>
                      {swatchLabel(locale, colourName(concept.garments[focus].parts[part]))}
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
                          <span className={s.swatchName}>{t(locale, `colours.${name}`)}</span>
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
                  <h2>{t(locale, 'configure.branding')}</h2>
                  <p>{t(locale, 'configure.brandingNote')}</p>
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
                        <span className={s.optName}>{t(locale, `branding.${m.id}`)}</span>
                        <span className={s.optNote}>{t(locale, `branding.${m.id}Note`)}</span>
                      </span>
                      <span className={s.optPrice}>+{m.price}</span>
                    </button>
                  ))}
                </div>

                {concept.logo.position !== 'none' && (
                <div className={s.partBlock}>
                  <div className={s.partName}>{t(locale, 'configure.logoColour')}</div>
                  <div className={s.swatches}>
                    {SWATCHES.map(([hex, name]) => (
                      <button
                        key={hex}
                        type="button"
                        className={s.swatch}
                        aria-pressed={(concept.logo.colour ?? '#ffffff').toLowerCase() === hex.toLowerCase()}
                        onClick={() => onChange(setLogo(concept, { colour: hex }))}
                      >
                        <span className={s.swatchChip} style={{ background: hex }} />
                        <span className={s.swatchName}>{t(locale, `colours.${name}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                )}

                <div className={s.partBlock}>
                  <div className={s.partName}>{t(locale, 'configure.placement')}</div>
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
                          <span className={s.optName}>{t(locale, `branding.${p.id}`)}</span>
                          <span className={s.optNote}>{t(locale, `branding.${p.id}Note`)}</span>
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
                  <h2>{t(locale, 'configure.quantity')}</h2>
                  <p>{t(locale, 'configure.quantityNote')}</p>
                </div>
                <div className={s.field}>
                  <label htmlFor="staffCount">{t(locale, 'configure.peopleToKit')}</label>
                  <input
                    id="staffCount"
                    type="number"
                    min={1}
                    value={staff}
                    onChange={(e) => onStaffChange(Math.max(1, +e.target.value || 1))}
                  />
                </div>
                {/* Three options, so they are all on screen. A native select
                    renders as the OS wants -- a full-height wheel on a phone,
                    a grey system menu on desktop -- next to buttons that look
                    nothing like it, and hides two of the three choices. */}
                <div className={s.partBlock}>
                  <div className={s.partName}>{t(locale, 'configure.spareStock')}</div>
                  <div className={s.optList}>
                    {SPARES.map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        className={s.opt}
                        aria-pressed={spare === pct}
                        onClick={() => onSpareChange(pct)}
                      >
                        <span className={s.optMark}>{spare === pct ? <Tick /> : null}</span>
                        <span className={s.optText}>
                          <span className={s.optName}>
                            {pct === 0 ? t(locale, 'spare.none') : t(locale, 'configure.spareOf', { pct: pct * 100 })}
                          </span>
                          <span className={s.optNote}>
                            {pct === 0
                              ? t(locale, 'spare.noneNote')
                              : t(locale, 'spare.note', { count: Math.ceil(staff * (1 + pct)) - staff })}
                          </span>
                        </span>
                        <span className={s.optPrice}>{t(locale, 'spare.setsCount', { count: Math.ceil(staff * (1 + pct)) })}</span>
                      </button>
                    ))}
                  </div>
                  <div className={s.fieldHint}>
                    {t(locale, 'configure.sizesNote')}
                  </div>
                </div>
              </>
            )}

            {/* Advice reads the top grade actually chosen on any garment. */}
            <ManagerNote locale={locale} note={stepAdvice(locale, step, concept, Math.max(0, ...grades, 0), brief, staff, spare)} />

            {/* Available at every step: describe the change instead of hunting for it. */}
            <div className={s.ask}>
              <div className={s.askHead}>{t(locale, 'configure.askTitle')}</div>
              {log.length === 0 && (
                <p className={s.askHint}>
                  {t(locale, 'configure.askNote')}
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
                  placeholder={t(locale, 'configure.examples').split('|')[0]}
                  aria-label={t(locale, 'configure.describeChange')}
                />
                <button type="submit" className={`${s.btn} ${s.btnSecondary}`}>{t(locale, 'configure.apply')}</button>
              </form>
              <div className={s.askChips}>
                {t(locale, 'configure.examples').split('|').map((q) => (
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
                {t(locale, 'common.back')}
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className={`${s.btn} ${s.btnPrimary} ${s.grow}`}
                onClick={() => setStep((n) => n + 1)}
              >
                {t(locale, 'configure.nextStep', { name: t(locale, `configure.${STEPS[step + 1]}`) })}
              </button>
            ) : (
              <button
                type="button"
                className={`${s.btn} ${s.btnSecondary} ${s.grow}`}
                onClick={onSave}
              >
                {t(locale, 'configure.saveAsKit')}
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
