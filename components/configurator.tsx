'use client';

import { Check } from './check';
import { useEffect, useMemo, useRef, useState } from 'react';
import s from '@/app/ui.module.css';
import { GarmentSvg, isTop, logoGarmentIndex } from './garments';
import { SWATCHES, colourName, refine } from '@/lib/refine';
import { stepAdvice } from '@/lib/manager';
import { type Suggestion, quickAsks } from '@/lib/suggest';
import { type Locale, formatCurrency, kitName, t } from '@/lib/i18n';

/** colourName() answers in English -- it is shared with the parser. Turn its
 *  answer into the buyer's language, including the "Close to X" fallback. */
function swatchLabel(locale: Locale, name: string): string {
  const near = /^Close to (.+)$/.exec(name);
  if (near) return t(locale, 'colours.closeTo', { name: t(locale, `colours.${near[1]}`) });
  return t(locale, `colours.${name}`);
}
import {
  type Concept, type GarmentCut, type GarmentFit, type GarmentType,
  type LogoMethod, type LogoPosition, type SizePlan,
  allocatedSizeCount, GARMENT_CATALOG, LABELS, PARTS, SIZES,
  setCuts, setGarmentFit, setGarmentIncluded, setLogo, setPart, setSizeCount,
  gradesFor, gradeName,
} from '@/lib/spec';

// No patch line. The drawing and the price change in front of you, which is
// the proof that matters; "shirt.fabric = Cotton Poplin 130 GSM" is the
// program talking about itself in the middle of a conversation.
type Msg = { who: 'you' | 'app'; text: string };


const STEPS = ['outfit', 'fit', 'colours', 'branding', 'sizes'] as const;

const GARMENT_OPTIONS: { type: GarmentType; group: 'top' | 'layer' | 'bottom' }[] = [
  { type: 'polo', group: 'top' },
  { type: 'shirt', group: 'top' },
  { type: 'blazer', group: 'layer' },
  { type: 'chino', group: 'bottom' },
  { type: 'cargo', group: 'bottom' },
];

const FITS: GarmentFit[] = ['slim', 'regular', 'relaxed'];

const CUT_PROFILES: { id: 'mixed' | GarmentCut; cuts: GarmentCut[] }[] = [
  { id: 'mixed', cuts: ['men', 'women'] },
  { id: 'unisex', cuts: ['unisex'] },
  { id: 'men', cuts: ['men'] },
  { id: 'women', cuts: ['women'] },
];

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
  sizePlan, onSizePlanChange, brief, onSave, locale,
  tips, asking, onAskingChange,
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
  sizePlan: SizePlan;
  onSizePlanChange: (plan: SizePlan) => void;
  /** The customer's own words, so advice can refer back to them. */
  brief: string;
  onSave: () => void;
  /** Computed by the page so the price bar's count and this panel agree. */
  tips: Suggestion[];
  /** Opened from the price bar, so the state belongs to the page. */
  asking: boolean;
  onAskingChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState(0); // garment being configured
  const [log, setLog] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const body = useRef<HTMLDivElement>(null);

  const topIdx = logoGarmentIndex(concept.garments);
  const per = perPerson;

  // Outfit, fit and colour decisions all operate on one garment at a time.
  const picking = step <= 2;
  const focusedGarment = concept.garments[focus] ?? concept.garments[0];

  const parts = useMemo(
    () => PARTS[focusedGarment?.type] ?? [],
    [concept, focus],
  );

  // What the designer would change about the kit as it stands. Each one is a
  // sentence the ask box already understands, so tapping it is indistinguish-
  // able from typing it -- and one that would change nothing never appears.
  const advice = stepAdvice(
    locale, step, concept, Math.max(0, ...grades, 0),
    brief, staff, spare, sizePlan.mode,
  );

  // The quick asks under the composer. Derived from the same state as the
  // proposals and gated the same way, so the row changes as the kit does and
  // never offers a tap that would land on nothing.
  const quick = useMemo(
    () => quickAsks(locale, concept, grades, spare, step, tips.map((x) => x.ask)),
    [locale, concept, grades, spare, step, tips],
  );

  // One row for the composer: what the designer recommends, then the rest of
  // the useful asks for this step. A recommendation carries its reason.
  const chips = useMemo(
    () => [
      ...tips.map((x) => ({ ask: x.ask, why: x.why })),
      ...quick.map((ask) => ({ ask, why: '' })),
    ],
    [tips, quick],
  );

  // The newest turn is always at the end, so the bottom is always what to
  // show. scrollIntoView({block:'nearest'}) moved the minimum distance and
  // left the last message a few pixels under the fold.
  useEffect(() => {
    const el = body.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log, asking]);

  function toggleGarment(type: GarmentType) {
    const at = concept.garments.findIndex((g) => g.type === type);
    if (at >= 0) {
      const sameKind = concept.garments.filter((g) => isTop(g.type) === isTop(type));
      if (sameKind.length === 1) return;
      onChange(setGarmentIncluded(concept, type, false));
      onGradesChange(grades.filter((_, i) => i !== at));
      setFocus(Math.max(0, Math.min(at, concept.garments.length - 2)));
      return;
    }
    const next = setGarmentIncluded(concept, type, true);
    onChange(next);
    onGradesChange([...concept.garments.map((_, i) => grades[i] ?? 0), 0]);
    setFocus(next.garments.length - 1);
  }

  /** `jump` follows a typed ask to the control it changed -- proof that the
   *  words landed. A tapped suggestion prints the same patch line without
   *  moving anyone: the card is beside the preview, and being thrown back to
   *  step 2 mid-way through branding is a punishment for taking advice. */
  function submitAsk(text: string, jump = true) {
    const q = text.trim();
    if (!q) return;
    setDraft('');
    const applied = refine(concept, q, grades, locale);
    const next: Msg[] = [{ who: 'you', text: q }];
    if (applied) {
      if (applied.concept !== concept) onChange(applied.concept);
      if (applied.grades) { onGradesChange(applied.grades); if (jump) setStep(1); }
      if (applied.spare !== undefined) { onSpareChange(applied.spare); if (jump) setStep(4); }
      next.push({ who: 'app', text: applied.note });
    } else {
      next.push({
        who: 'app',
        text: t(locale, 'errors.notUnderstood'),
      });
    }
    setLog((l) => [...l, ...next]);
  }

  return (
    <>
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
                  aria-label={t(locale, step === 2 ? 'configure.colourThe' : 'configure.editThe', {
                    garment: t(locale, `garments.${g.type}`),
                  })}
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
                  ? t(locale, step === 2 ? 'configure.selectGarment' : 'configure.selectGarmentToEdit')
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
                <span className={s.trailNum}>{i < step ? <Check /> : i + 1}</span>
                <span className={s.trailName}>{t(locale, `configure.${name}`)}</span>
              </button>
            ))}
          </div>

          <div className={s.panel}>
            {step === 0 && (
              <>
                <div className={s.panelHead}>
                  <h2>{t(locale, 'configure.buildOutfit')}</h2>
                  <p>{t(locale, 'configure.buildOutfitNote')}</p>
                </div>

                <div className={s.garmentCatalog}>
                  {GARMENT_OPTIONS.map((option) => {
                    const included = concept.garments.some((g) => g.type === option.type);
                    const sameKind = concept.garments.filter(
                      (g) => isTop(g.type) === isTop(option.type),
                    ).length;
                    const locked = included && sameKind === 1;
                    return (
                      <button
                        key={option.type}
                        type="button"
                        className={s.catalogItem}
                        aria-pressed={included}
                        aria-label={t(locale, locked ? 'configure.requiredGarment' : included
                          ? 'configure.removeGarment' : 'configure.addGarment', {
                          garment: t(locale, `garments.${option.type}`),
                        })}
                        disabled={locked}
                        onClick={() => toggleGarment(option.type)}
                      >
                        <span className={s.catalogPreview}>
                          <GarmentSvg garment={GARMENT_CATALOG[option.type]} showLogo={false} />
                        </span>
                        <span className={s.catalogCopy}>
                          <span className={s.catalogName}>
                            {t(locale, `garments.${option.type}`)}
                            {locked && (
                              <span className={s.catalogRequired}>
                                {t(locale, 'configure.required')}
                              </span>
                            )}
                          </span>
                          <span className={s.catalogNote}>{t(locale, `garmentNotes.${option.type}`)}</span>
                        </span>
                        {/* The same tick the fabric and placement lists use: one
                            control vocabulary, so "chosen" looks the same everywhere. */}
                        <span className={s.optMark}>{included ? <Tick /> : null}</span>
                      </button>
                    );
                  })}
                </div>

                <div className={s.choiceSection}>
                  <div className={s.partName}>{t(locale, 'configure.genderCut')}</div>
                  <div className={s.partCurrent}>{t(locale, 'configure.genderCutNote')}</div>
                  <div className={s.compactOptions}>
                    {CUT_PROFILES.map((profile) => {
                      const cuts = concept.cuts?.length ? concept.cuts : ['men', 'women'];
                      const selected = profile.cuts.length === cuts.length
                        && profile.cuts.every((cut) => cuts.includes(cut));
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          className={s.compactOption}
                          aria-pressed={selected}
                          onClick={() => onChange(setCuts(concept, profile.cuts))}
                        >
                          <span className={s.optMark}>{selected ? <Tick /> : null}</span>
                          <span>
                            <strong>{t(locale, `cuts.${profile.id}`)}</strong>
                            <small>{t(locale, `cuts.${profile.id}Note`)}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className={s.panelHead}>
                  <h2>{t(locale, 'configure.fitAndFabric')}</h2>
                  <p>{t(locale, 'configure.fitAndFabricNote')}</p>
                </div>

                {focusedGarment && (
                  <>
                    <div className={s.focusCard}>
                      <span className={s.focusPreview}>
                        <GarmentSvg garment={focusedGarment} showLogo={false} />
                      </span>
                      <span>
                        <strong>{t(locale, `garments.${focusedGarment.type}`)}</strong>
                        <small>{t(locale, 'configure.selectPreviewToSwitch')}</small>
                      </span>
                    </div>

                    <div className={s.choiceSection}>
                      <div className={s.partName}>{t(locale, 'configure.fit')}</div>
                      <div className={s.partCurrent}>{t(locale, 'configure.fitNote')}</div>
                      <div className={s.segmented}>
                        {FITS.map((fit) => (
                          <button
                            key={fit}
                            type="button"
                            aria-pressed={(focusedGarment.fit ?? 'regular') === fit}
                            onClick={() => onChange(setGarmentFit(concept, focus, fit))}
                          >
                            <strong>{t(locale, `fits.${fit}`)}</strong>
                            <span>{t(locale, `fits.${fit}Note`)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={s.choiceSection}>
                      <div className={s.partName}>{t(locale, 'configure.fabric')}</div>
                      <div className={s.optList}>
                        {gradesFor(focusedGarment.type).map((fabric, i) => (
                          <button
                            key={fabric.name}
                            type="button"
                            className={s.opt}
                            aria-pressed={i === (grades[focus] ?? 0)}
                            onClick={() => onGradesChange(concept.garments.map(
                              (_, j) => (j === focus ? i : grades[j] ?? 0)))}
                          >
                            <span className={s.optMark}>{i === (grades[focus] ?? 0) ? <Tick /> : null}</span>
                            <span className={s.optText}>
                              <span className={s.optName}>{gradeName(focusedGarment, i)}</span>
                              <span className={s.optNote}>{t(locale, fabric.note)}</span>
                            </span>
                            <span className={s.optPrice}>{fabric.delta
                              ? `+${fabric.delta}` : t(locale, 'common.included')}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {step === 2 && (
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

            {step === 3 && (
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

            {step === 4 && (
              <>
                <div className={s.panelHead}>
                  <h2>{t(locale, 'configure.quantitySizes')}</h2>
                  <p>{t(locale, 'configure.quantitySizesNote')}</p>
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
                </div>

                <div className={s.choiceSection}>
                  <div className={s.partName}>{t(locale, 'configure.sizeCollection')}</div>
                  <div className={s.optList}>
                    {(['collect_later', 'allocate_now'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={s.opt}
                        aria-pressed={sizePlan.mode === mode}
                        onClick={() => onSizePlanChange({ ...sizePlan, mode })}
                      >
                        <span className={s.optMark}>{sizePlan.mode === mode ? <Tick /> : null}</span>
                        <span className={s.optText}>
                          <span className={s.optName}>{t(locale, `sizing.${mode}`)}</span>
                          <span className={s.optNote}>{t(locale, `sizing.${mode}Note`)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {sizePlan.mode === 'allocate_now' && (
                  <SizeAllocationEditor
                    concept={concept}
                    locale={locale}
                    plan={sizePlan}
                    sets={sets}
                    onChange={onSizePlanChange}
                  />
                )}
              </>
            )}

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

      {/* Only here once the floating chat launcher is opened. */}
      {asking && (
        <div className={s.dock}>
          <div className={s.dockPanel} role="dialog" aria-label={t(locale, 'suggest.open')}>
            <div className={s.dockHead}>
              <span className={s.mgrMark} aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5 2.6 8 4.2l3-1.6 2.4 1.2v3.6l-1.7.4V14H4.3V7.8l-1.7-.4V3.8z" />
                </svg>
              </span>
              <span className={s.dockWho}>{t(locale, 'manager.who')}</span>
              <button
                type="button"
                className={s.dockClose}
                onClick={() => onAskingChange(false)}
                aria-label={t(locale, 'common.close')}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
                  stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            {/* A transcript, and nothing else in it: the designer opens with
                what it makes of this step, then it is your words and its
                replies. */}
            <div className={s.ask} ref={body}>
              {advice && <div className={`${s.msg} ${s.msgApp}`}>{advice}</div>}
              {log.map((m, i) => (
                <div key={i} className={`${s.msg} ${m.who === 'you' ? s.msgYou : s.msgApp}`}>
                  {m.text}
                </div>
              ))}
            </div>

            <div className={s.dockFoot}>
              {/* Quick replies above the input, the way a chat does it. What
                  the designer would actually recommend comes first and is
                  marked; the rest are the useful asks from this step. All of
                  them are gated the same way, so none is ever a no-op. */}
              {chips.length > 0 && (
                <div className={s.askChips}>
                  {chips.map((c) => (
                    <button
                      key={c.ask}
                      type="button"
                      className={c.why ? s.chipTip : undefined}
                      title={c.why || undefined}
                      onClick={() => submitAsk(c.ask, false)}
                    >
                      {c.ask}
                    </button>
                  ))}
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
                  /* The parser takes either language, so the field has to
                     lay out either language rather than the page's. */
                  dir="auto"
                  placeholder={t(locale, 'configure.examples').split('|')[0]}
                  aria-label={t(locale, 'configure.describeChange')}
                />
                <button
                  type="submit"
                  className={s.askSend}
                  disabled={!draft.trim()}
                  aria-label={t(locale, 'configure.apply')}
                >
                  {/* Up, not sideways: a horizontal arrow reads as send in
                      English and as back in Arabic, and this icon is shared. */}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                    stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M8 13V4M4.5 7.5 8 4l3.5 3.5" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SizeAllocationEditor({ concept, locale, plan, sets, onChange }: {
  concept: Concept;
  locale: Locale;
  plan: SizePlan;
  sets: number;
  onChange: (plan: SizePlan) => void;
}) {
  const cuts = concept.cuts?.length ? concept.cuts : ['men', 'women'] as GarmentCut[];
  const allocated = allocatedSizeCount(plan.allocation, cuts);
  const remaining = sets - allocated;
  const progress = Math.min(100, sets > 0 ? (allocated / sets) * 100 : 0);

  return (
    <div className={s.sizePlanner}>
      <div className={s.sizeSummary} aria-live="polite">
        <span>
          <strong>{t(locale, 'sizing.assigned', { assigned: allocated, sets })}</strong>
          <small>{remaining === 0
            ? t(locale, 'sizing.complete')
            : remaining > 0
              ? t(locale, 'sizing.remaining', { count: remaining })
              : t(locale, 'sizing.over', { count: Math.abs(remaining) })}</small>
        </span>
        <span className={remaining === 0 ? s.sizeReady : s.sizeCount}>{allocated}/{sets}</span>
      </div>
      <div className={s.sizeTrack} aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      {cuts.map((cut) => {
        const cutTotal = SIZES.reduce(
          (sum, size) => sum + (plan.allocation[cut]?.[size] ?? 0), 0);
        return (
          <div className={s.cutSizes} key={cut}>
            <div className={s.cutSizesHead}>
              <strong>{t(locale, `cuts.${cut}Block`)}</strong>
              <span>{t(locale, cutTotal === 1 ? 'sizing.cutCountOne' : 'sizing.cutCount', { count: cutTotal })}</span>
            </div>
            <div className={s.sizeGrid}>
              {SIZES.map((size) => {
                const id = `size-${cut}-${size}`;
                return (
                  <label className={s.sizeField} key={size} htmlFor={id}>
                    <span>{size}</span>
                    <input
                      id={id}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={plan.allocation[cut]?.[size] ?? 0}
                      onChange={(event) => onChange({
                        ...plan,
                        allocation: setSizeCount(
                          plan.allocation, cut, size, Number(event.target.value) || 0),
                      })}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className={s.sizeFootnote}>{t(locale, 'sizing.drawingNote')}</p>
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
