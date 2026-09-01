'use client';

import { useEffect, useRef, useState } from 'react';
import s from './ui.module.css';
import { Sidebar, Topbar, type PageId } from '@/components/shell';
import { ConceptCard } from '@/components/concept';
import { Configurator } from '@/components/configurator';
import { GarmentSvg, logoGarmentIndex } from '@/components/garments';
import { CONCEPTS, selectConcepts } from '@/lib/concepts';
import { type Concept, LABELS, asSavedKit, conceptPrice, conceptPriceAt, gradeName, gradesFor, sameKit } from '@/lib/spec';
import { greeting, whyTheseKits, quoteNote, orderNote } from '@/lib/manager';
import { type Order, STAGES, placeOrder, progress, revive, shortDate, stageDate, status } from '@/lib/order';
import { ManagerNote } from '@/components/manager';
import { Check } from '@/components/check';

const USER = 'Ahmed Osama';

/** What Settings holds. Company and staff reach the sidebar and the price;
 *  industry and the dress code are read into every brief. */
type Profile = { company: string; staff: number; industry: string; rules: string };
const PROFILE: Profile = {
  company: 'BrainWise Technology',
  staff: 40,
  industry: 'Technology',
  rules: 'Smart casual for client-facing teams. Hard-wearing kit for operations.',
};

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
  const [staff, setStaff] = useState(PROFILE.staff);
  const [profile, setProfile] = useState(PROFILE);
  // Grades and spare live here so the price bar and the quote read one number.
  // One grade per garment, into that garment's own family list.
  const [grades, setGrades] = useState<number[]>([]);
  const [spare, setSpare] = useState(0.05);
  const [logoText, setLogoText] = useState('BW');
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Concept[]>([]);
  // Loaded after mount, not in the initializer: the server renders an empty
  // list and a lazy read would hydrate against something else. With nothing
  // stored, two sample kits stand in so the library is not bare.
  useEffect(() => {
    let stored: Concept[] = [];
    try { stored = JSON.parse(localStorage.getItem('kits') ?? '[]'); } catch { /* stay empty */ }
    setSaved(stored.length ? stored : [
      selectConcepts({ industry: 'site technicians, navy, logo on the chest' })[0],
      selectConcepts({ industry: 'smart shirts for the front desk' })[0],
    ]);
  }, []);
  const [quoting, setQuoting] = useState(false);
  // The quote, carried over. Everything Orders and Home show comes from here.
  // Newest first. Loaded after mount like the kits. With nothing stored,
  // three samples in three states stand in so Home does not open on zeros.
  // ponytail: samples are real placeOrder() calls on real concepts, so every
  // screen agrees with them. Delete the fallback for a blank-slate demo.
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('orders');
      if (stored) { setOrders(revive(stored)); return; }
    } catch { /* fall through to the samples */ }
    // Named seeds, not briefs: selectConcepts only ever reaches three of the
    // four, so a brief could not give three visibly different kits.
    const sample = (kit: string, daysAgo: number, stage: number, people: number) => {
      const c = CONCEPTS.find((x) => x.id === kit) ?? CONCEPTS[0];
      return placeOrder(c, people, Math.ceil(people * 1.05), [], conceptPriceAt(c, []),
        new Date(Date.now() - daysAgo * 864e5), stage);
    };
    setOrders([
      sample('technicians', 4, 1, PROFILE.staff),
      sample('operations', 18, 3, 24),
      sample('management', 45, 5, 12),
    ]);
  }, []);
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
      // ponytail: the brief comes first, so on a clash the customer's own words
      // win over the dress code. A real model gets these as separate fields.
      setConcepts(selectConcepts({ industry: `${text}. ${profile.industry}. ${profile.rules}` }));
      setSel(0);
      setBusy(false);
    }, 650);
  }

  function saveKit(c: Concept) {
    // Dedupe on what the kit IS, not just its id: an edit keeps the id, so
    // matching on that alone silently dropped a customised kit.
    if (saved.some((x) => sameKit(x, c))) {
      flash(`“${c.name}” is already in your kits`);
      return;
    }
    // An edit keeps the seed's id, so a customised kit needs its own before
    // it joins the library -- otherwise it collides with the kit it came from.
    const kit = asSavedKit(c, saved);
    const next = [...saved, kit];
    setSaved(next);
    try { localStorage.setItem('kits', JSON.stringify(next)); } catch { /* private mode */ }
    flash(`Saved “${kit.name}” to your kits`);
  }

  return (
    <div className={s.app}>
      <Sidebar
        page={page}
        onNavigate={setPage}
        company={profile.company}
        staff={staff}
        kitCount={saved.length}
        orderCount={orders.filter((o) => o.stage < 5).length}
      />

      <div className={s.main}>
        <Topbar trail={TRAIL[page]} user={USER} />

        <div className={s.scroll} ref={scroller}>
          <div className={s.body}>
          <div className={s.stack}>
          {page === 'home' && (
            <Home
              staff={staff}
              orders={orders}
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
                  <p>Indicative prices from the demo catalogue.</p>
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

          {page === 'orders' && <Orders orders={orders} onHome={() => setPage('home')} />}
          {page === 'settings' && (
            <Settings profile={{ ...profile, staff }} onSave={(p) => { setProfile(p); setStaff(p.staff); flash('Settings saved'); }} />
          )}
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
            const next = [placeOrder(active, staff, sets, grades, perPerson), ...orders];
            setOrders(next);
            try { localStorage.setItem('orders', JSON.stringify(next)); } catch { /* private mode */ }
            setQuoting(false);
            flash(`${next[0].id} placed. Sizes are next.`);
            setTimeout(() => setPage('orders'), 800);
          }}
        />
      )}

      {toast && <div className={s.toast} role="status">{toast}</div>}
    </div>
  );
}

function Home({
  staff, orders, savedCount, onAsk, onKits, onOrders,
}: {
  staff: number;
  orders: Order[];
  savedCount: number;
  onAsk: (text: string) => void;
  onKits: () => void;
  onOrders: () => void;
}) {
  const [text, setText] = useState('');
  const sizing = orders.filter((o) => status(o) === 'Collecting sizes');
  const making = orders.filter((o) => status(o) === 'In production');
  const done = orders.filter((o) => status(o) === 'Delivered');
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
      <ManagerNote tone="panel" intro note={greeting('Ahmed', orders)} />

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
        {/* Every number here is counted from the orders, or an honest zero. */}
        <Stat label="Collecting sizes" value={String(sizing.length)}
          note={sizing[0] ? `${sizing[0].id} · ${sizing[0].sets} sets` : 'None waiting'} />
        <Stat label="In production" value={String(making.length)}
          note={making[0] ? `Next due ${shortDate(making[0].due)}` : 'Nothing on the floor'} />
        <Stat label="Delivered" value={String(done.length)}
          note={done.length ? money(done.reduce((n, o) => n + o.total, 0)) : 'Nothing yet'} />
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
              {orders.length ? orders.map((o) => (
                <tr key={o.id}>
                  <td><strong>{o.name}</strong><div className={s.sub}>{o.id} · {o.sets} sets</div></td>
                  <td data-label="Status"><StatusPill order={o} /></td>
                  <td data-label="Value" className={`${s.right} ${s.mono}`}>{money(o.total)}</td>
                  <td data-label="Updated" className={`${s.right} ${s.muted}`}>{shortDate(stageDate(o, Math.min(o.stage, 5)))}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className={s.muted}>Nothing yet. Your first order shows here.</td>
                </tr>
              )}
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

/** One pill for one status, coloured the same everywhere it appears. */
function StatusPill({ order }: { order: Order }) {
  const st = status(order);
  const tone = st === 'Delivered' ? s.pillGood : st === 'Collecting sizes' ? s.pillWarn : '';
  return <span className={`${s.pill} ${tone}`}>{st}</span>;
}

function Orders({ orders, onHome }: { orders: Order[]; onHome: () => void }) {
  // The open order is a choice on this page, not app state: leaving and
  // coming back should show the newest again.
  const [openId, setOpenId] = useState<string | null>(null);
  const o = orders.find((x) => x.id === openId) ?? orders[0];
  const head = (
    <div className={s.pageHead}>
      <div>
        <h1>Orders</h1>
        <p>Where everything is right now.</p>
      </div>
    </div>
  );
  if (!o) {
    return (
      <>
        {head}
        <Empty
          title="No orders yet"
          note="Configure a kit, review the quote and place the order. It lands here with its production stages."
          action="Start a uniform"
          onAct={onHome}
        />
      </>
    );
  }
  const reached = (i: number) => i <= o.stage || i === STAGES.length - 1;
  const state = (i: number) => (o.stage >= 5 || i < o.stage ? 'done' : i === o.stage ? 'now' : '');
  const pct = progress(o);
  return (
    <>
      {head}

      {orders.length > 1 && (
        <div className={`${s.tableCard} ${s.tableFixed} ${s.tableOrders}`}>
          <div className={s.tableScroll}>
            <table>
              <thead>
                <tr><th>Order</th><th>Status</th><th className={s.right}>Value</th><th className={s.right}>Due</th></tr>
              </thead>
              <tbody>
                {/* The whole row is the control. A View button needed a fifth
                    column the table had no room for, which pushed the order
                    name off the left edge behind a scrollbar. Keyboard users
                    get the same row via Enter or Space. */}
                {orders.map((x) => (
                  <tr key={x.id} className={`${s.rowPick} ${x.id === o.id ? s.rowOpen : ''}`}
                    aria-current={x.id === o.id ? 'true' : undefined}
                    tabIndex={0} role="button" aria-label={`Open ${x.name}, ${x.id}`}
                    onClick={() => setOpenId(x.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(x.id); }
                    }}>
                    <td>
                      <strong>{x.name}</strong>
                      <div className={s.sub}>{x.id} · {x.sets} sets</div>
                    </td>
                    <td data-label="Status"><StatusPill order={x} /></td>
                    <td data-label="Value" className={`${s.right} ${s.mono}`}>{money(x.total)}</td>
                    <td data-label="Due" className={`${s.right} ${s.mono}`}>{shortDate(x.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={`${s.card} ${s.cardPad}`}>
        <div className={s.splitRow}>
          <div>
            <div className={s.sub}>{o.id}</div>
            <h2 className={s.orderTitle}>{o.name}</h2>
            <div className={s.sub}>{o.sets} sets · {money(o.total)}</div>
          </div>
          <div className={s.alignEnd}>
            <StatusPill order={o} />
            <div className={`${s.muted} ${s.metaLine}`}>
              {o.stage >= 5 ? `Delivered ${shortDate(o.due)}` : `Due around ${shortDate(o.due)}`}
            </div>
          </div>
        </div>
        <div className={s.timeline}>
          {STAGES.map((name, i) => (
            <div key={name} className={`${s.tStep} ${state(i) === 'done' ? s.tDone : state(i) === 'now' ? s.tNow : ''}`}>
              <div className={s.tDot}>{state(i) === 'done' ? <Check /> : i + 1}</div>
              <b>{name}</b>
              <small>{state(i) === 'now' && o.stage < 5 ? 'Now' : reached(i) ? shortDate(stageDate(o, i)) : '—'}</small>
            </div>
          ))}
        </div>
      </div>

      <ManagerNote tone="panel" note={orderNote(o)} />

      <div className={s.group}>
      <div className={s.sectionHead}>
        <div><h2>{o.stage >= 5 ? 'What was made' : 'What is being made'}</h2></div>
      </div>
      <div className={`${s.tableCard} ${s.tableFixed} ${s.tableLines}`}>
        <div className={s.tableScroll}>
          <table>
            <thead>
              <tr><th>Item</th><th className={s.right}>Qty</th><th>Progress</th><th className={s.right}>Ready</th></tr>
            </thead>
            <tbody>
              {o.lines.map((l) => (
                <tr key={l.item}>
                  <td><strong>{l.item}</strong><div className={s.sub}>{l.note}</div></td>
                  <td data-label="Qty" className={`${s.right} ${s.mono}`}>{l.qty}</td>
                  <td data-label="Progress">
                    <div className={s.progress}>
                      <div className={s.progressTrack}><i style={{ width: `${pct}%` }} /></div>
                      <span className={s.progressPct}>{pct === 0 ? 'Waiting on sizes' : `${pct}%`}</span>
                    </div>
                  </td>
                  <td data-label="Ready" className={`${s.right} ${s.mono}`}>{shortDate(o.due)}</td>
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

function Settings({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => void }) {
  const [d, setD] = useState(profile);
  // Held as typed so the field can be emptied while editing; validated on
  // save. Clamping on every keystroke made the staff box impossible to clear.
  const set = (k: keyof Profile) => (e: { target: { value: string } }) =>
    setD({ ...d, [k]: k === 'staff' ? e.target.value : e.target.value } as unknown as Profile);
  const staffNum = Math.max(1, Math.floor(+d.staff) || 0);
  const nameOk = String(d.company).trim().length > 0;
  const staffOk = staffNum >= 1 && String(d.staff).trim() !== '';
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
              <input id="sName" value={d.company} onChange={set('company')}
                aria-invalid={!nameOk} aria-describedby={nameOk ? undefined : 'sNameErr'} />
              {!nameOk && <div className={s.fieldHint} id="sNameErr" role="alert">A name is needed — it goes on every quote.</div>}
            </div>
            <div className={`${s.field} ${s.fieldNarrow}`}>
              <label htmlFor="sStaff">Total staff</label>
              <input id="sStaff" type="number" min={1} value={d.staff} onChange={set('staff')}
                aria-invalid={!staffOk} aria-describedby={staffOk ? undefined : 'sStaffErr'} />
              {!staffOk && <div className={s.fieldHint} id="sStaffErr" role="alert">At least one person.</div>}
            </div>
            <div className={`${s.field} ${s.fieldWide}`}>
              <label htmlFor="sInd">Industry</label>
              <select id="sInd" value={d.industry} onChange={set('industry')}>
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
            <textarea id="sRules" value={d.rules} onChange={set('rules')} />
          </div>
        </section>

        <div className={s.settingsFoot}>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`}
            disabled={!nameOk || !staffOk}
            onClick={() => onSave({ ...d, company: d.company.trim(), staff: staffNum })}>
            Save settings
          </button>
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
  // Escape closes; focus goes back to the button that opened it. The handler
  // is read through a ref so an inline onClose does not re-arm this each render.
  // ponytail: no focus trap. Tab can leave the dialog; add one if a reviewer asks.
  const close = useRef(onClose);
  close.current = onClose;
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Read the opener before moving focus in; autoFocus would have beaten us to it.
    const opener = document.activeElement as HTMLElement | null;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    addEventListener('keydown', onKey);
    return () => { removeEventListener('keydown', onKey); opener?.focus(); };
  }, []);
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
          <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={onClose} ref={first}>Keep editing</button>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={onConfirm}>Place order</button>
        </div>
      </div>
    </div>
  );
}
