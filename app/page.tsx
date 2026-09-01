'use client';

import { useEffect, useRef, useState } from 'react';
import s from './ui.module.css';
import { Sidebar, Topbar, type PageId } from '@/components/shell';
import { ConceptCard } from '@/components/concept';
import { Configurator } from '@/components/configurator';
import { GarmentSvg, logoGarmentIndex } from '@/components/garments';
import { selectConcepts } from '@/lib/concepts';
import { type Concept, LABELS, conceptPrice, conceptPriceAt, gradeName, gradesFor } from '@/lib/spec';
import { greeting, whyTheseKits, quoteNote, orderNote } from '@/lib/manager';
import { ManagerNote } from '@/components/manager';

const COMPANY = 'BrainWise Technology';
const USER = 'Ahmed Osama';

const money = (n: number) => `EGP ${Math.round(n).toLocaleString()}`;

const TRAIL: Record<PageId, string[]> = {
  home: ['Home'],
  design: ['Home', 'New uniform'],
  configure: ['Home', 'New uniform', 'Configure'],
  kits: ['Home', 'Saved kits'],
  orders: ['Home', 'Orders'],
  settings: ['Home', 'Settings'],
};

const EXAMPLES = [
  'Summer polos for 40 site technicians, navy, logo on the chest',
  'Smart shirts and trousers for the front desk team',
  'Hard-wearing workwear for the warehouse, dark colours',
];

export default function Page() {
  const [page, setPage] = useState<PageId>('home');
  const [brief, setBrief] = useState('');
  const [staff, setStaff] = useState(40);
  // Grades and spare live here so the price bar and the quote read one number.
  // One grade per garment, into that garment's own family list.
  const [grades, setGrades] = useState<number[]>([]);
  const [spare, setSpare] = useState(0.05);
  const [logoText, setLogoText] = useState('BW');
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Concept[]>([]);
  const [quoting, setQuoting] = useState(false);
  // Set by any configurator edit, cleared by a fresh generate. Guards the
  // one destructive path in the app: asking for new kits replaces these.
  const [edited, setEdited] = useState(false);
  const [toast, setToast] = useState('');

  const scroller = useRef<HTMLDivElement>(null);
  // A new page starts at the top. Carrying the previous scroll position over
  // was hiding the step tabs on Configure.
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [page]);

  const active = concepts?.[sel] ?? null;
  const perPerson = active ? conceptPriceAt(active, grades) : 0;

  // Grades are positional, so carrying them across a kit change would put a
  // different garment on an upgrade nobody picked -- and move the price on a
  // screen the user never touched.
  useEffect(() => { setGrades([]); }, [active?.id]);
  const sets = Math.ceil(staff * (1 + spare));

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }

  function generate(text = brief) {
    if (!text.trim()) return;
    if (edited && !confirm(
      'New kits will replace the ones you have changed.\n\n' +
      'Save the kit first if you want to keep it.')) return;
    setEdited(false);
    setBusy(true);
    setPage('design');
    setTimeout(() => {
      setConcepts(selectConcepts({ industry: text }));
      setSel(0);
      setBusy(false);
    }, 650);
  }

  function saveKit(c: Concept) {
    setSaved((k) => (k.some((x) => x.id === c.id) ? k : [...k, c]));
    flash(`Saved “${c.name}” to your kits`);
  }

  return (
    <div className={s.app}>
      <Sidebar
        page={page}
        onNavigate={setPage}
        company={COMPANY}
        staff={staff}
        kitCount={saved.length}
        orderCount={1}
      />

      <div className={s.main}>
        <Topbar trail={TRAIL[page]} user={USER} />

        <div className={s.scroll} ref={scroller}>
          <div className={s.body}>
          <div className={s.stack}>
          {page === 'home' && (
            <Home
              staff={staff}
              savedCount={saved.length}
              onAsk={(t) => { setBrief(t); generate(t); }}
              onKits={() => setPage('kits')}
              onOrders={() => setPage('orders')}
            />
          )}

          {page === 'design' && (
            <>
              <div className={s.pageHead}>
                <div>
                  <h1>New uniform</h1>
                  <p>Describe who it is for and we will put three kits together.</p>
                </div>
              </div>

              {/* The brief takes the room it needs; the short answers sit
                  beside it instead of leaving half the card empty. */}
              <div className={`${s.panel} ${s.briefPanel}`}>
                <div className={s.briefMain}>
                  <div className={s.field}>
                    <label htmlFor="brief">What do you need?</label>
                    <textarea
                      id="brief"
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      placeholder="Summer polos for 40 site technicians, navy, logo on the chest"
                    />
                    <div className={s.fieldHint}>Mention the team, the season, and any colours you have to stick to.</div>
                  </div>
                  <div className={s.chips}>
                    {EXAMPLES.map((e) => (
                      <button key={e} type="button" onClick={() => { setBrief(e); generate(e); }}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={s.briefSide}>
                  <div className={s.field}>
                    <label htmlFor="people">How many people?</label>
                    <input id="people" type="number" min={1} value={staff}
                      onChange={(e) => setStaff(Math.max(1, +e.target.value || 1))} />
                  </div>
                  <div className={s.field}>
                    <label htmlFor="logo">Logo text</label>
                    <input id="logo" value={logoText} onChange={(e) => setLogoText(e.target.value)} />
                    <div className={s.fieldHint}>Shown on the garment previews.</div>
                  </div>
                  <button
                    type="button"
                    className={`${s.btn} ${s.btnPrimary} ${s.briefGo}`}
                    onClick={() => generate()}
                    disabled={busy || !brief.trim()}
                  >
                    {busy ? 'Putting kits together…' : 'Show me some kits'}
                  </button>
                </div>
              </div>

              {concepts && !busy && (
                <>
                  <div className={s.group}>
                  <div className={s.sectionHead}>
                    <div>
                      <h2>Three kits for {staff} people</h2>
                      <p>Pick the closest one — you can change every detail next.</p>
                    </div>
                  </div>
                  <ManagerNote tone="panel" note={whyTheseKits(brief, concepts)} />
                  <div className={s.kitGrid}>
                    {concepts.map((c, i) => (
                      <ConceptCard key={c.id} concept={c} logoText={logoText} employees={staff}
                        selected={i === sel} onSelect={() => setSel(i)} />
                    ))}
                  </div>
                  </div>
                </>
              )}
            </>
          )}

          {page === 'configure' && (
            <>
              <div className={s.pageHead}>
                <div>
                  <h1>Configure</h1>
                  <p>Every option is priced from live stock.</p>
                </div>
                {/* Says where it goes. "Back to kits" read as the Saved kits
                    destination in the nav; this returns to the three
                    suggestions you picked from. */}
                <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={() => setPage('design')}>
                  Choose a different kit
                </button>
              </div>
              {active ? (
                <Configurator
                  concept={active}
                  onChange={(c) => {
                    setEdited(true);
                    setConcepts((cs) => cs && cs.map((x, i) => (i === sel ? c : x)));
                  }}
                  logoText={logoText}
                  staff={staff}
                  onStaffChange={setStaff}
                  grades={grades}
                  onGradesChange={(g) => { setEdited(true); setGrades(g); }}
                  spare={spare}
                  onSpareChange={(v) => { setEdited(true); setSpare(v); }}
                  perPerson={perPerson}
                  sets={sets}
                  brief={brief}
                  onSave={() => saveKit(active)}
                />
              ) : (
                <Empty
                  title="Nothing to configure yet"
                  note="Describe what you need and pick a kit first."
                  action="Start a new uniform"
                  onAct={() => setPage('design')}
                />
              )}
            </>
          )}

          {page === 'kits' && (
            <Kits
              saved={saved}
              logoText={logoText}
              staff={staff}
              onNew={() => setPage('design')}
              onOpen={(c) => {
                // Add to the working set rather than replacing it, so going
                // back to the generated kits still shows all of them.
                setConcepts((cs) => {
                  const list = cs ?? [];
                  const at = list.findIndex((x) => x.id === c.id);
                  if (at >= 0) { setSel(at); return list; }
                  setSel(list.length);
                  return [...list, c];
                });
                setPage('configure');
              }}
            />
          )}

          {page === 'orders' && <Orders />}
          {page === 'settings' && <Settings company={COMPANY} staff={staff} onSave={() => flash('Settings saved')} />}
          </div>
          </div>
        </div>

        {/* Fixed chrome: the primary action is never scrolled out of reach. */}
        {page === 'design' && concepts && !busy && (
          <div className={s.actionBar}>
            <div className={s.actionText}>
              <strong>{concepts[sel].name}</strong>
              {/* Says "before options" so the number growing on the next
                  screen reads as the options being added, not a wobble. */}
              <span className={s.sub}>
                {money(conceptPrice(concepts[sel]))} a person · {money(conceptPrice(concepts[sel]) * staff)} for {staff} before options
              </span>
            </div>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => setPage('configure')}>
              Configure this kit
            </button>
          </div>
        )}

        {page === 'configure' && active && (
          <div className={s.priceBar}>
            <div className={s.priceFigures}>
              <span className={s.priceTotal}>{money(perPerson * sets)}</span>
              <span className={s.priceBreak}>
                {money(perPerson)} per person · {sets} sets{spare > 0 && ` (incl. ${sets - staff} spare)`}
              </span>
            </div>
            <div className={s.priceActions}>
              <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={() => saveKit(active)}>
                Save kit
              </button>
              <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => setQuoting(true)}>
                Get a quote
              </button>
            </div>
          </div>
        )}
      </div>

      {quoting && active && (
        <Quote
          concept={active}
          staff={staff}
          perPerson={perPerson}
          sets={sets}
          grades={grades}
          onClose={() => setQuoting(false)}
          onConfirm={() => {
            setQuoting(false);
            flash('Order placed. You will get a confirmation by email.');
            setTimeout(() => setPage('orders'), 800);
          }}
        />
      )}

      {toast && <div className={s.toast} role="status">{toast}</div>}
    </div>
  );
}

function Home({
  staff, savedCount, onAsk, onKits, onOrders,
}: {
  staff: number;
  savedCount: number;
  onAsk: (text: string) => void;
  onKits: () => void;
  onOrders: () => void;
}) {
  const [text, setText] = useState('');
  // 70% of the team has sent sizes in. One number, so the count and the
  // remainder can never disagree.
  const collected = Math.round(staff * 0.7);
  return (
    <>
      {/* Home was the one page with no h1: the heading order ran h3, h2 and
          a screen reader had nothing to announce the page by. */}
      <div className={s.pageHead}>
        <div>
          <h1>Home</h1>
          <p>Where your uniform work stands today.</p>
        </div>
      </div>
      <ManagerNote tone="panel" intro note={greeting('Ahmed', 1)} />

      {/* The primary job, first thing on the page. */}
      <div className={s.panel}>
        <div className={s.panelHead}>
          <h2>What do you need to kit out?</h2>
          <p>Describe the team in your own words.</p>
        </div>
        <form
          className={s.askForm}
          onSubmit={(e) => {
            e.preventDefault();
            onAsk(text);
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Summer polos for 40 site technicians, navy, logo on the chest"
            aria-label="Describe what you need"
          />
          <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={!text.trim()}>
            Show kits
          </button>
        </form>
        <div className={s.askChips}>
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => { setText(e); onAsk(e); }}>{e}</button>
          ))}
        </div>
      </div>

      <div className={s.stats}>
        <Stat label="Saved kits" value={String(savedCount)} note="Ready to reorder" />
        <Stat label="Awaiting approval" value="1" note="EGP 78,400 quoted" />
        <Stat label="In production" value="1" note="Ships 08 Sep" />
        {/* Derived, not frozen: this read "28 / 200 · 12 still to confirm"
            as soon as anyone changed the headcount. */}
        <Stat label="Sizes collected" value={String(collected)} sub={` / ${staff}`}
          note={`${staff - collected} ${staff - collected === 1 ? 'person' : 'people'} still to confirm`} />
      </div>

      <div className={s.group}>
      <div className={s.sectionHead}>
        <div>
          <h2>Recent activity</h2>
        </div>
        <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={onOrders}>View orders</button>
      </div>
      <div className={`${s.tableCard} ${s.tableFixed} ${s.tableActivity}`}>
        <div className={s.tableScroll}>
          <table>
            <thead>
              <tr><th>What</th><th>Status</th><th className={s.right}>Value</th><th className={s.right}>Updated</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Site technician polos</strong><div className={s.sub}>SO-2026-00418 · 158 sets</div></td>
                <td data-label="Status"><span className={`${s.pill} ${s.pillWarn}`}>In production</span></td>
                <td data-label="Value" className={`${s.right} ${s.mono}`}>EGP 68,250</td>
                <td data-label="Updated" className={`${s.right} ${s.muted}`}>2 days ago</td>
              </tr>
              <tr>
                <td><strong>Front desk shirts</strong><div className={s.sub}>QTN-2026-0091 · 22 sets</div></td>
                <td data-label="Status"><span className={s.pill}>Awaiting approval</span></td>
                <td data-label="Value" className={`${s.right} ${s.mono}`}>EGP 78,400</td>
                <td data-label="Updated" className={`${s.right} ${s.muted}`}>5 days ago</td>
              </tr>
              <tr>
                <td><strong>Warehouse workwear</strong><div className={s.sub}>Delivered 14 Aug</div></td>
                <td data-label="Status"><span className={`${s.pill} ${s.pillGood}`}>Delivered</span></td>
                <td data-label="Value" className={`${s.right} ${s.mono}`}>EGP 141,900</td>
                <td data-label="Updated" className={`${s.right} ${s.muted}`}>3 weeks ago</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      </div>
      <div>
        <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={onKits}>Browse saved kits</button>
      </div>
    </>
  );
}

function Stat({ label, value, sub, note }: { label: string; value: string; sub?: string; note: string }) {
  return (
    <div className={s.stat}>
      <div className={s.statLabel}>{label}</div>
      <div className={s.statValue}>{value}{sub && <small>{sub}</small>}</div>
      <div className={s.statNote}>{note}</div>
    </div>
  );
}

function Empty({ title, note, action, onAct }: { title: string; note: string; action: string; onAct: () => void }) {
  return (
    <div className={`${s.card} ${s.empty}`}>
      <div className={s.emptyIcon}>
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3.5 5.5 2.5 8 4l2.5-1.5L13 3.5v3.8l-1.8.5V14H4.8V7.8L3 7.3z" />
        </svg>
      </div>
      <h2>{title}</h2>
      <p>{note}</p>
      <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={onAct}>{action}</button>
    </div>
  );
}

function Kits({
  saved, logoText, staff, onNew, onOpen,
}: {
  saved: Concept[];
  logoText: string;
  staff: number;
  onNew: () => void;
  onOpen: (c: Concept) => void;
}) {
  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1>Saved kits</h1>
          <p>Reorder these without starting again.</p>
        </div>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={onNew}>New uniform</button>
      </div>
      {saved.length === 0 ? (
        <Empty
          title="No saved kits yet"
          note="When you configure a uniform you are happy with, save it here and reorder it any time."
          action="Create your first kit"
          onAct={onNew}
        />
      ) : (
        <div className={s.kitGrid}>
          {saved.map((c) => (
            <ConceptCard key={c.id} concept={c} logoText={logoText} employees={staff}
              selected={false} onSelect={() => onOpen(c)} />
          ))}
        </div>
      )}
    </>
  );
}

const STEPS_ORDER: [string, string, 'done' | 'now' | ''][] = [
  ['Ordered', '18 Aug', 'done'],
  ['Sizes in', '22 Aug', 'done'],
  ['Fabric cut', '28 Aug', 'done'],
  ['Sewing', 'Now', 'now'],
  ['Checks', '05 Sep', ''],
  ['Delivery', '08 Sep', ''],
];

const LINES: [string, string, number][] = [
  ['Polo · Navy', 'Cotton pique 220 GSM', 72],
  ['Chino · Sand', 'Cotton twill 240 GSM', 61],
  ['Chest embroidery', 'Applied after sewing', 44],
];

function Orders() {
  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1>Orders</h1>
          <p>Where everything is right now.</p>
        </div>
      </div>

      <div className={`${s.card} ${s.cardPad}`}>
        <div className={s.splitRow}>
          <div>
            <div className={s.sub}>SO-2026-00418</div>
            <h2 className={s.orderTitle}>Site technician polos</h2>
            <div className={s.sub}>158 sets · EGP 68,250</div>
          </div>
          <div className={s.alignEnd}>
            <span className={`${s.pill} ${s.pillWarn}`}>In production</span>
            <div className={`${s.muted} ${s.metaLine}`}>Arrives 08 Sep</div>
          </div>
        </div>
        <div className={s.timeline}>
          {STEPS_ORDER.map(([name, when, state], i) => (
            <div key={name} className={`${s.tStep} ${state === 'done' ? s.tDone : state === 'now' ? s.tNow : ''}`}>
              <div className={s.tDot}>{state === 'done' ? '✓' : i + 1}</div>
              <b>{name}</b>
              <small>{when}</small>
            </div>
          ))}
        </div>
      </div>

      <ManagerNote tone="panel" note={orderNote()} />

      <div className={s.group}>
      <div className={s.sectionHead}>
        <div><h2>What is being made</h2></div>
      </div>
      <div className={`${s.tableCard} ${s.tableFixed} ${s.tableLines}`}>
        <div className={s.tableScroll}>
          <table>
            <thead>
              <tr><th>Item</th><th className={s.right}>Qty</th><th>Progress</th><th className={s.right}>Ready</th></tr>
            </thead>
            <tbody>
              {LINES.map(([item, note, pct]) => (
                <tr key={item}>
                  <td><strong>{item}</strong><div className={s.sub}>{note}</div></td>
                  <td data-label="Qty" className={`${s.right} ${s.mono}`}>158</td>
                  <td data-label="Progress">
                    <div className={s.progress}>
                      <div className={s.progressTrack}><i style={{ width: `${pct}%` }} /></div>
                      <span className={s.progressPct}>{pct}%</span>
                    </div>
                  </td>
                  <td data-label="Ready" className={`${s.right} ${s.mono}`}>08 Sep</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </>
  );
}

function Settings({ company, staff, onSave }: { company: string; staff: number; onSave: () => void }) {
  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1>Settings</h1>
          <p>Used to keep every kit on brand.</p>
        </div>
      </div>
      {/* Two things live here, so the page says so: who you are, and how
          your uniforms should look. */}
      <div className={s.settings}>
        <section className={s.panel}>
          <div className={s.panelHead}>
            <h2>Your company</h2>
            <p>Shown on quotes and used to size every order.</p>
          </div>
          <div className={s.formGrid}>
            <div className={`${s.field} ${s.fieldWide}`}>
              <label htmlFor="sName">Company name</label>
              <input id="sName" defaultValue={company} />
            </div>
            <div className={`${s.field} ${s.fieldNarrow}`}>
              <label htmlFor="sStaff">Total staff</label>
              <input id="sStaff" type="number" defaultValue={staff} />
            </div>
            <div className={`${s.field} ${s.fieldWide}`}>
              <label htmlFor="sInd">Industry</label>
              <select id="sInd" defaultValue="Technology">
                <option>Technology</option>
                <option>Hospitality</option>
                <option>Facilities management</option>
                <option>Retail</option>
              </select>
              <div className={s.fieldHint}>Sets the starting point for new kits.</div>
            </div>
          </div>
        </section>

        <section className={s.panel}>
          <div className={s.panelHead}>
            <h2>Dress code</h2>
            <p>I read this before suggesting kits, so write it in plain words.</p>
          </div>
          <div className={s.field}>
            <label htmlFor="sRules">What your teams should wear</label>
            <textarea id="sRules" defaultValue="Smart casual for client-facing teams. Hard-wearing kit for operations." />
          </div>
        </section>

        <div className={s.settingsFoot}>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={onSave}>Save settings</button>
        </div>
      </div>
    </>
  );
}

function Quote({
  concept, staff, perPerson, sets, grades, onClose, onConfirm,
}: {
  concept: Concept;
  staff: number;
  /** Passed in, never recomputed -- the price bar showed these same numbers. */
  perPerson: number;
  sets: number;
  grades: number[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  const per = perPerson;
  const garments = concept.garments.reduce((a, g) => a + g.unitPrice, 0);
  const branding = concept.logo.position === 'none' ? 0 : conceptPrice(concept) - garments;
  const spareSets = sets - staff;
  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-labelledby="qt"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.modal}>
        <div className={s.modalHead}>
          <div>
            <h2 id="qt">Your quote</h2>
            <p>Held for 30 days.</p>
          </div>
          <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={onClose}>Close</button>
        </div>
        <div className={s.modalBody}>
          {/* Each garment carries its own cloth and its own upgrade, so the
              row a buyer queries is the row that explains itself. */}
          {concept.garments.map((g, i) => {
            const grade = grades[i] ?? 0;
            const delta = gradesFor(g.type)[grade]?.delta ?? 0;
            return (
              <div className={s.quoteLine} key={i}>
                <span>{LABELS[g.type]}<div className={s.sub}>
                  {gradeName(g, grade)}{delta > 0 && ` · upgrade +${delta}`}
                </div></span>
                <b>{money(g.unitPrice + delta)}</b>
              </div>
            );
          })}
          <div className={s.quoteLine}>
            <span>Branding<div className={s.sub}>
              {concept.logo.position === 'none' ? 'None' : `${concept.logo.method}, ${concept.logo.position.replace('_', ' ')}`}
            </div></span>
            <b>{branding ? money(branding) : '—'}</b>
          </div>
          <div className={s.quoteLine}>
            <span>Sets<div className={s.sub}>
              {staff} people{spareSets > 0 ? ` plus ${spareSets} spare` : ', no spare'}
            </div></span>
            <b>{sets}</b>
          </div>
          <div className={s.quoteTotal}>
            <span>Total</span>
            <b>{money(per * sets)}</b>
          </div>
          <ManagerNote note={quoteNote(concept, staff, sets)} />
        </div>
        <div className={s.modalFoot}>
          <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={onClose}>Keep editing</button>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={onConfirm}>Place order</button>
        </div>
      </div>
    </div>
  );
}
