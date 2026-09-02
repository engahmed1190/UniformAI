'use client';

import { useEffect, useRef, useState } from 'react';
import s from './ui.module.css';
import { Sidebar, Topbar, type PageId } from '@/components/shell';
import { type Locale, LOCALES, LOCALE_CODES, LOCALE_NAMES, dir, kitName, formatCurrency, formatDate, t } from '@/lib/i18n';
import { ConceptCard } from '@/components/concept';
import { Select } from '@/components/select';
import { colourName } from '@/lib/refine';

/** colourName() answers in English -- it is shared with the parser -- so the
 *  screen turns its answer into the buyer's language. */
function swatch(locale: Locale, name: string): string {
  const near = /^Close to (.+)$/.exec(name);
  return near
    ? t(locale, 'colours.closeTo', { name: t(locale, `colours.${near[1]}`) })
    : t(locale, `colours.${name}`);
}
import { Configurator } from '@/components/configurator';
import { GarmentSvg, logoGarmentIndex } from '@/components/garments';
import { CONCEPTS, selectConcepts } from '@/lib/concepts';
import {
  type Concept, type GarmentCut, type SizePlan, LABELS, allocatedSizeCount,
  asSavedKit, conceptPrice, conceptPriceAt, gradeName, gradesFor, sameKit,
} from '@/lib/spec';
import { greeting, whyTheseKits, quoteNote, orderNote } from '@/lib/manager';
import { type Order, STAGES, STAGE_KEYS, placeOrder, progress, revive, shortDate, stageDate, status } from '@/lib/order';
import { ManagerNote } from '@/components/manager';
import { Check } from '@/components/check';

const USER = 'Ahmed Osama';

/** Industry values are stored in English and displayed translated: the value
 *  is data the brief reads, the label is language. */
const INDUSTRIES: [string, string][] = [
  ['Technology', 'settings.industryTech'],
  ['Hospitality', 'settings.industryHospitality'],
  ['Facilities management', 'settings.industryFacilities'],
  ['Retail', 'settings.industryRetail'],
];

/** What Settings holds. Company and staff reach the sidebar and the price;
 *  industry and the dress code are read into every brief. */
type Profile = { company: string; staff: number; industry: string; rules: string };
const PROFILE: Profile = {
  company: 'BrainWise Technology',
  staff: 40,
  industry: 'Technology',
  rules: 'Smart casual for client-facing teams. Hard-wearing kit for operations.',
};

/** Breadcrumb trails, as translation keys. */
const TRAIL: Record<PageId, string[]> = {
  home: ['nav.home'],
  design: ['nav.home', 'nav.newUniform'],
  configure: ['nav.home', 'nav.newUniform', 'nav.configure'],
  kits: ['nav.home', 'nav.savedKits'],
  orders: ['nav.home', 'nav.orders'],
  settings: ['nav.home', 'nav.settings'],
};

/** Example briefs, per language. These get typed into the brief box, so they
 *  have to be in the language the parser and the manager will read back. */
const EXAMPLES: Record<Locale, string[]> = {
  en: [
    'Summer polos for 40 site technicians, navy, logo on the chest',
    'Smart shirts and trousers for the front desk team',
    'Hard-wearing workwear for the warehouse, dark colours',
  ],
  ar: [
    'قمصان بولو صيفية لـ40 فني موقع، كحلي، الشعار على الصدر',
    'قمصان وبناطيل رسمية لفريق الاستقبال',
    'ملابس عمل متينة للمستودع، بألوان داكنة',
  ],
};

export default function Page() {
  const [page, setPage] = useState<PageId>('home');
  const [brief, setBrief] = useState('');
  const [staff, setStaff] = useState(PROFILE.staff);
  const [profile, setProfile] = useState(PROFILE);
  // Arabic first: this demo's audience reads Arabic. Loaded after mount like
  // everything else, so the server render and the hydration agree.
  const [locale, setLocale] = useState<Locale>('ar');
  useEffect(() => {
    try {
      const stored = localStorage.getItem('uniformai-locale');
      if (stored === 'ar' || stored === 'en') setLocale(stored);
    } catch { /* keep the default */ }
  }, []);
  // The document carries the direction, so scrollbars, text selection and the
  // native form controls flip with the page rather than just our own layout.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir(locale);
  }, [locale]);
  const money = (n: number) => formatCurrency(locale, n);
  const shortDay = (d: Date) => formatDate(locale, d);
  function changeLocale(next: Locale) {
    setLocale(next);
    try { localStorage.setItem('uniformai-locale', next); } catch { /* private mode */ }
  }
  // Grades and spare live here so the price bar and the quote read one number.
  // One grade per garment, into that garment's own family list.
  const [grades, setGrades] = useState<number[]>([]);
  const [spare, setSpare] = useState(0.05);
  const [sizePlan, setSizePlan] = useState<SizePlan>({
    mode: 'collect_later', allocation: {},
  });
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
  useEffect(() => {
    setGrades([]);
    setSizePlan({ mode: 'collect_later', allocation: {} });
  }, [active?.id]);
  const sets = Math.ceil(staff * (1 + spare));

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }

  function generate(text = brief) {
    if (!text.trim()) return;
    if (edited && !confirm(
      t(locale, 'design.replaceWarning'))) return;
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
      flash(t(locale, 'kits.already', { name: kitName(locale, c.id) }));
      return;
    }
    // An edit keeps the seed's id, so a customised kit needs its own before
    // it joins the library -- otherwise it collides with the kit it came from.
    const kit = asSavedKit(c, saved);
    const next = [...saved, kit];
    setSaved(next);
    try { localStorage.setItem('kits', JSON.stringify(next)); } catch { /* private mode */ }
    flash(t(locale, 'kits.saved', { name: kitName(locale, kit.id) }));
  }

  return (
    <div className={s.app} dir={dir(locale)}>
      <Sidebar
        page={page}
        onNavigate={setPage}
        company={profile.company}
        staff={staff}
        kitCount={saved.length}
        orderCount={orders.filter((o) => o.stage < 5).length}
        locale={locale}
      />

      <div className={s.main}>
        <Topbar trail={TRAIL[page].map((k) => t(locale, k))} user={USER}
          locale={locale} onLocale={changeLocale} />

        <div className={s.scroll} ref={scroller}>
          <div className={s.body}>
          <div className={s.stack}>
          {page === 'home' && (
            <Home
              locale={locale}
              money={money}
              shortDay={shortDay}
              staff={staff}
              orders={orders}
              savedCount={saved.length}
              onAsk={(text) => { setBrief(text); generate(text); }}
              onKits={() => setPage('kits')}
              onOrders={() => setPage('orders')}
            />
          )}

          {page === 'design' && (
            <>
              <div className={s.pageHead}>
                <div>
                  <h1>{t(locale, 'design.title')}</h1>
                  <p>{t(locale, 'design.subtitle')}</p>
                </div>
              </div>

              {/* The brief takes the room it needs; the short answers sit
                  beside it instead of leaving half the card empty. */}
              <div className={`${s.panel} ${s.briefPanel}`}>
                <div className={s.briefMain}>
                  <div className={s.field}>
                    <label htmlFor="brief">{t(locale, 'design.needLabel')}</label>
                    <textarea
                      id="brief"
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      placeholder={EXAMPLES[locale][0]}
                    />
                    <div className={s.fieldHint}>{t(locale, 'design.needHint')}</div>
                  </div>
                  <div className={s.chips}>
                    {EXAMPLES[locale].map((e) => (
                      <button key={e} type="button" onClick={() => { setBrief(e); generate(e); }}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={s.briefSide}>
                  <div className={s.field}>
                    <label htmlFor="people">{t(locale, 'design.peopleLabel')}</label>
                    <input id="people" type="number" min={1} value={staff}
                      onChange={(e) => setStaff(Math.max(1, +e.target.value || 1))} />
                  </div>
                  <div className={s.field}>
                    <label htmlFor="logo">{t(locale, 'design.logoLabel')}</label>
                    <input id="logo" value={logoText} onChange={(e) => setLogoText(e.target.value)} />
                    <div className={s.fieldHint}>{t(locale, 'design.logoHint')}</div>
                  </div>
                  <button
                    type="button"
                    className={`${s.btn} ${s.btnPrimary} ${s.briefGo}`}
                    onClick={() => generate()}
                    disabled={busy || !brief.trim()}
                  >
                    {t(locale, busy ? 'design.generating' : 'design.generate')}
                  </button>
                </div>
              </div>

              {concepts && !busy && (
                <>
                  <div className={s.group}>
                  <div className={s.sectionHead}>
                    <div>
                      <h2>{t(locale, 'design.threeKits', { count: staff })}</h2>
                      <p>{t(locale, 'design.pickClosest')}</p>
                    </div>
                  </div>
                  <ManagerNote locale={locale} tone="panel" note={whyTheseKits(locale, brief, concepts)} />
                  <div className={s.kitGrid}>
                    {concepts.map((c, i) => (
                      <ConceptCard key={c.id} concept={c} logoText={logoText} employees={staff}
                        locale={locale} money={money}
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
                  <h1>{t(locale, 'configure.title')}</h1>
                  <p>{t(locale, 'configure.subtitle')}</p>
                </div>
                {/* Says where it goes. "Back to kits" read as the Saved kits
                    destination in the nav; this returns to the three
                    suggestions you picked from. */}
                <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={() => setPage('design')}>
                  {t(locale, 'design.chooseDifferent')}
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
                  sizePlan={sizePlan}
                  onSizePlanChange={(plan) => { setEdited(true); setSizePlan(plan); }}
                  brief={brief}
              locale={locale}
                  onSave={() => saveKit(active)}
                />
              ) : (
                <Empty
                  title={t(locale, 'configure.nothingYet')}
                  note={t(locale, 'configure.nothingYetNote')}
                  action={t(locale, 'configure.startOne')}
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
              locale={locale}
              money={money}
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

          {page === 'orders' && (
            <Orders orders={orders} onHome={() => setPage('home')}
              locale={locale} money={money} shortDay={shortDay} />
          )}
          {page === 'settings' && (
            <Settings profile={{ ...profile, staff }} locale={locale} onLocale={changeLocale}
              onSave={(p) => { setProfile(p); setStaff(p.staff); flash(t(locale, 'settings.saved')); }} />
          )}
          </div>
          </div>
        </div>

        {/* Fixed chrome: the primary action is never scrolled out of reach. */}
        {page === 'design' && concepts && !busy && (
          <div className={s.actionBar}>
            <div className={s.actionText}>
              <strong>{kitName(locale, concepts[sel].id)}</strong>
              {/* Says "before options" so the number growing on the next
                  screen reads as the options being added, not a wobble. */}
              <span className={s.sub}>
                {t(locale, 'configure.beforeOptions', {
                  price: money(conceptPrice(concepts[sel])),
                  total: money(conceptPrice(concepts[sel]) * staff),
                  count: staff,
                })}
              </span>
            </div>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => setPage('configure')}>
              {t(locale, 'design.configureThis')}
            </button>
          </div>
        )}

        {page === 'configure' && active && (
          <div className={s.priceBar}>
            <div className={s.priceFigures}>
              <span className={s.priceTotal}>{money(perPerson * sets)}</span>
              <span className={s.priceBreak}>
                {spare > 0
                  ? t(locale, 'configure.setsLine', { price: money(perPerson), sets, spare: sets - staff })
                  : t(locale, 'configure.setsLineNoSpare', { price: money(perPerson), sets })}
              </span>
            </div>
            <div className={s.priceActions}>
              <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={() => saveKit(active)}>
                {t(locale, 'configure.saveKit')}
              </button>
              <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => setQuoting(true)}>
                {t(locale, 'configure.getQuote')}
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
          sizePlan={sizePlan}
          locale={locale}
          money={money}
          onClose={() => setQuoting(false)}
          onConfirm={() => {
            const cuts = active.cuts?.length ? active.cuts : ['men', 'women'] as GarmentCut[];
            const sizesComplete = sizePlan.mode === 'allocate_now'
              && allocatedSizeCount(sizePlan.allocation, cuts) === sets;
            const next = [placeOrder(
              active, staff, sets, grades, perPerson, new Date(), sizesComplete ? 2 : 1, sizePlan,
            ), ...orders];
            setOrders(next);
            try { localStorage.setItem('orders', JSON.stringify(next)); } catch { /* private mode */ }
            setQuoting(false);
            flash(t(locale, 'kits.saved', { name: next[0].id }));
            setTimeout(() => setPage('orders'), 800);
          }}
        />
      )}

      {toast && <div className={s.toast} role="status">{toast}</div>}
    </div>
  );
}

function Home({
  staff, orders, savedCount, onAsk, onKits, onOrders, locale, money, shortDay,
}: {
  staff: number;
  locale: Locale;
  money: (n: number) => string;
  shortDay: (d: Date) => string;
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
          <h1>{t(locale, 'home.title')}</h1>
          <p>{t(locale, 'home.subtitle')}</p>
        </div>
      </div>
      <ManagerNote locale={locale} tone="panel" intro note={greeting(locale, 'Ahmed', orders)} />

      {/* The primary job, first thing on the page. */}
      <div className={s.panel}>
        <div className={s.panelHead}>
          <h2>{t(locale, 'home.askTitle')}</h2>
          <p>{t(locale, 'home.askSubtitle')}</p>
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
            placeholder={EXAMPLES[locale][0]}
            aria-label={t(locale, 'home.describeTeam')}
          />
          <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={!text.trim()}>
            {t(locale, 'home.showKits')}
          </button>
        </form>
        <div className={s.askChips}>
          {EXAMPLES[locale].map((e) => (
            <button key={e} type="button" onClick={() => { setText(e); onAsk(e); }}>{e}</button>
          ))}
        </div>
      </div>

      <div className={s.stats}>
        <Stat label={t(locale, 'home.savedKits')} value={String(savedCount)} note={t(locale, 'home.savedKitsNote')} />
        {/* Every number here is counted from the orders, or an honest zero. */}
        <Stat label={t(locale, 'home.collectingSizes')} value={String(sizing.length)}
          note={sizing[0]
            ? t(locale, 'home.orderLine', { id: sizing[0].id, sets: sizing[0].sets })
            : t(locale, 'home.noneWaiting')} />
        <Stat label={t(locale, 'home.inProduction')} value={String(making.length)}
          note={making[0]
            ? t(locale, 'home.nextDue', { date: shortDay(making[0].due) })
            : t(locale, 'home.nothingOnFloor')} />
        <Stat label={t(locale, 'home.delivered')} value={String(done.length)}
          note={done.length ? money(done.reduce((n, o) => n + o.total, 0)) : t(locale, 'home.nothingYet')} />
      </div>

      <div className={s.group}>
      <div className={s.sectionHead}>
        <div>
          <h2>{t(locale, 'home.recentActivity')}</h2>
        </div>
        <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={onOrders}>{t(locale, 'home.viewOrders')}</button>
      </div>
      <div className={`${s.tableCard} ${s.tableFixed} ${s.tableActivity}`}>
        <div className={s.tableScroll}>
          <table>
            <thead>
              <tr><th>{t(locale, 'home.colWhat')}</th><th>{t(locale, 'home.colStatus')}</th><th className={s.right}>{t(locale, 'home.colValue')}</th><th className={s.right}>{t(locale, 'home.colUpdated')}</th></tr>
            </thead>
            <tbody>
              {orders.length ? orders.map((o) => (
                <tr key={o.id}>
                  <td><strong>{kitName(locale, o.concept.id)}</strong><div className={s.sub}>{t(locale, 'home.orderLine', { id: o.id, sets: o.sets })}</div></td>
                  <td data-label={t(locale, 'home.colStatus')}><StatusPill order={o} locale={locale} /></td>
                  <td data-label={t(locale, 'home.colValue')} className={`${s.right} ${s.mono}`}>{money(o.total)}</td>
                  <td data-label={t(locale, 'home.colUpdated')} className={`${s.right} ${s.muted}`}>{shortDay(stageDate(o, Math.min(o.stage, 5)))}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className={s.muted}>{t(locale, 'home.firstOrderHere')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
      <div>
        <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={onKits}>{t(locale, 'home.browseSavedKits')}</button>
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
  saved, logoText, staff, onNew, onOpen, locale, money,
}: {
  saved: Concept[];
  locale: Locale;
  money: (n: number) => string;
  logoText: string;
  staff: number;
  onNew: () => void;
  onOpen: (c: Concept) => void;
}) {
  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1>{t(locale, 'kits.title')}</h1>
          <p>{t(locale, 'kits.subtitle')}</p>
        </div>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={onNew}>{t(locale, 'kits.newUniform')}</button>
      </div>
      {saved.length === 0 ? (
        <Empty
          title={t(locale, 'kits.noneTitle')}
          note={t(locale, 'kits.noneNote')}
          action={t(locale, 'kits.createFirst')}
          onAct={onNew}
        />
      ) : (
        <div className={s.kitGrid}>
          {saved.map((c) => (
            <ConceptCard key={c.id} concept={c} logoText={logoText} employees={staff}
              locale={locale} money={money}
              selected={false} onSelect={() => onOpen(c)} />
          ))}
        </div>
      )}
    </>
  );
}

/** One pill for one status, coloured the same everywhere it appears. */
function StatusPill({ order, locale }: { order: Order; locale: Locale }) {
  const st = status(order);
  const tone = st === 'Delivered' ? s.pillGood : st === 'Collecting sizes' ? s.pillWarn : '';
  const key = st === 'Delivered' ? 'delivered' : st === 'Collecting sizes' ? 'collectingSizes' : 'inProduction';
  return <span className={`${s.pill} ${tone}`}>{t(locale, `statuses.${key}`)}</span>;
}

function Orders({ orders, onHome, locale, money, shortDay }: {
  orders: Order[]; onHome: () => void; locale: Locale;
  money: (n: number) => string; shortDay: (d: Date) => string;
}) {
  // The open order is a choice on this page, not app state: leaving and
  // coming back should show the newest again.
  const [openId, setOpenId] = useState<string | null>(null);
  const o = orders.find((x) => x.id === openId) ?? orders[0];
  const head = (
    <div className={s.pageHead}>
      <div>
        <h1>{t(locale, 'orders.title')}</h1>
        <p>{t(locale, 'orders.subtitle')}</p>
      </div>
    </div>
  );
  if (!o) {
    return (
      <>
        {head}
        <Empty
          title={t(locale, 'orders.noneTitle')}
          note={t(locale, 'orders.noneNote')}
          action={t(locale, 'orders.startOne')}
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
                <tr><th>{t(locale, 'orders.colOrder')}</th><th>{t(locale, 'orders.colStatus')}</th><th className={s.right}>{t(locale, 'orders.colValue')}</th><th className={s.right}>{t(locale, 'orders.colDue')}</th></tr>
              </thead>
              <tbody>
                {/* The whole row is the control. A View button needed a fifth
                    column the table had no room for, which pushed the order
                    name off the left edge behind a scrollbar. Keyboard users
                    get the same row via Enter or Space. */}
                {orders.map((x) => (
                  <tr key={x.id} className={`${s.rowPick} ${x.id === o.id ? s.rowOpen : ''}`}
                    aria-current={x.id === o.id ? 'true' : undefined}
                    tabIndex={0} role="button" aria-label={t(locale, 'orders.open', { name: kitName(locale, x.concept.id), id: x.id })}
                    onClick={() => setOpenId(x.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(x.id); }
                    }}>
                    <td>
                      <strong>{kitName(locale, x.concept.id)}</strong>
                      <div className={s.sub}>{t(locale, 'home.orderLine', { id: x.id, sets: x.sets })}</div>
                    </td>
                    <td data-label={t(locale, 'orders.colStatus')}><StatusPill order={x} locale={locale} /></td>
                    <td data-label={t(locale, 'orders.colValue')} className={`${s.right} ${s.mono}`}>{money(x.total)}</td>
                    <td data-label={t(locale, 'orders.colDue')} className={`${s.right} ${s.mono}`}>{shortDay(x.due)}</td>
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
            <h2 className={s.orderTitle}>{kitName(locale, o.concept.id)}</h2>
            <div className={s.sub}>{t(locale, 'orders.setsAndValue', { sets: o.sets, value: money(o.total) })}</div>
          </div>
          <div className={s.alignEnd}>
            <StatusPill order={o} locale={locale} />
            <div className={`${s.muted} ${s.metaLine}`}>
              {o.stage >= 5
                ? t(locale, 'orders.deliveredOn', { date: shortDay(o.due) })
                : t(locale, 'orders.dueAround', { date: shortDay(o.due) })}
            </div>
          </div>
        </div>
        <div className={s.timeline}>
          {STAGE_KEYS.map((key, i) => (
            <div key={key} className={`${s.tStep} ${state(i) === 'done' ? s.tDone : state(i) === 'now' ? s.tNow : ''}`}>
              <div className={s.tDot}>{state(i) === 'done' ? <Check /> : i + 1}</div>
              <b>{t(locale, `orders.${key}`)}</b>
              <small>{state(i) === 'now' && o.stage < 5
                ? t(locale, 'orders.now')
                : reached(i) ? shortDay(stageDate(o, i)) : '—'}</small>
            </div>
          ))}
        </div>
      </div>

      <ManagerNote locale={locale} tone="panel" note={orderNote(locale, o)} />

      <div className={s.group}>
      <div className={s.sectionHead}>
        <div><h2>{t(locale, o.stage >= 5 ? 'orders.whatWasMade' : 'orders.whatIsBeingMade')}</h2></div>
      </div>
      <div className={`${s.tableCard} ${s.tableFixed} ${s.tableLines}`}>
        <div className={s.tableScroll}>
          <table>
            <thead>
              <tr><th>{t(locale, 'orders.colItem')}</th><th className={s.right}>{t(locale, 'orders.colQty')}</th><th>{t(locale, 'orders.colProgress')}</th><th className={s.right}>{t(locale, 'orders.colReady')}</th></tr>
            </thead>
            <tbody>
              {o.lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <strong>{l.garment
                      ? `${t(locale, `garments.${l.garment}`)} · ${swatch(locale, colourName(l.colour ?? ''))}`
                      : t(locale, l.logo === 'print' ? 'branding.printedLogo' : 'branding.embroideredLogo')}</strong>
                    <div className={s.sub}>{l.fabric ?? (l.position ? t(locale, `branding.${l.position}`) : '')}</div>
                  </td>
                  <td data-label={t(locale, 'orders.colQty')} className={`${s.right} ${s.mono}`}>{l.qty}</td>
                  <td data-label={t(locale, 'orders.colProgress')}>
                    <div className={s.progress}>
                      <div className={s.progressTrack}><i style={{ width: `${pct}%` }} /></div>
                      <span className={s.progressPct}>{pct === 0 ? t(locale, 'orders.waitingOnSizes') : `${pct}%`}</span>
                    </div>
                  </td>
                  <td data-label={t(locale, 'orders.colReady')} className={`${s.right} ${s.mono}`}>{shortDay(o.due)}</td>
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

function Settings({ profile, onSave, locale, onLocale }: {
  profile: Profile; onSave: (p: Profile) => void;
  locale: Locale; onLocale: (l: Locale) => void;
}) {
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
          <h1>{t(locale, 'settings.title')}</h1>
          <p>{t(locale, 'settings.subtitle')}</p>
        </div>
      </div>
      {/* Two things live here, so the page says so: who you are, and how
          your uniforms should look. */}
      <div className={s.settings}>
        <section className={s.panel}>
          <div className={s.panelHead}>
            <h2>{t(locale, 'settings.company')}</h2>
            <p>{t(locale, 'settings.companyNote')}</p>
          </div>
          <div className={s.formGrid}>
            <div className={`${s.field} ${s.fieldWide}`}>
              <label htmlFor="sName">{t(locale, 'settings.companyName')}</label>
              <input id="sName" value={d.company} onChange={set('company')}
                aria-invalid={!nameOk} aria-describedby={nameOk ? undefined : 'sNameErr'} />
              {!nameOk && <div className={s.fieldHint} id="sNameErr" role="alert">{t(locale, 'settings.nameNeeded')}</div>}
            </div>
            <div className={`${s.field} ${s.fieldNarrow}`}>
              <label htmlFor="sStaff">{t(locale, 'settings.totalStaff')}</label>
              <input id="sStaff" type="number" min={1} value={d.staff} onChange={set('staff')}
                aria-invalid={!staffOk} aria-describedby={staffOk ? undefined : 'sStaffErr'} />
              {!staffOk && <div className={s.fieldHint} id="sStaffErr" role="alert">{t(locale, 'settings.staffNeeded')}</div>}
            </div>
            <div className={`${s.field} ${s.fieldWide}`}>
              <label htmlFor="sInd">{t(locale, 'settings.industry')}</label>
              <Select
                id="sInd"
                value={d.industry}
                onChange={(v) => setD({ ...d, industry: v })}
                choices={INDUSTRIES.map(([value, key]) => ({ value, label: t(locale, key) }))}
              />
              <div className={s.fieldHint}>{t(locale, 'settings.industryHint')}</div>
            </div>
          </div>
        </section>

        <section className={s.panel}>
          <div className={s.panelHead}>
            <h2>{t(locale, 'settings.language')}</h2>
            <p>{t(locale, 'settings.languageNote')}</p>
          </div>
          <div className={s.field}>
            <label htmlFor="sLang">{t(locale, 'settings.interfaceLanguage')}</label>
            <Select
              id="sLang"
              value={locale}
              onChange={(v) => onLocale(v as Locale)}
              choices={LOCALES.map((l) => ({
                value: l, label: LOCALE_NAMES[l], code: LOCALE_CODES[l], lang: l, dir: dir(l),
              }))}
            />
          </div>
        </section>

        <section className={s.panel}>
          <div className={s.panelHead}>
            <h2>{t(locale, 'settings.dressCode')}</h2>
            <p>{t(locale, 'settings.dressCodeNote')}</p>
          </div>
          <div className={s.field}>
            <label htmlFor="sRules">{t(locale, 'settings.rulesLabel')}</label>
            <textarea id="sRules" value={d.rules} onChange={set('rules')} />
          </div>
        </section>

        <div className={s.settingsFoot}>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`}
            disabled={!nameOk || !staffOk}
            onClick={() => onSave({ ...d, company: d.company.trim(), staff: staffNum })}>
            {t(locale, 'settings.save')}
          </button>
        </div>
      </div>
    </>
  );
}

function Quote({
  concept, staff, perPerson, sets, grades, sizePlan, onClose, onConfirm, locale, money,
}: {
  concept: Concept;
  staff: number;
  locale: Locale;
  money: (n: number) => string;
  /** Passed in, never recomputed -- the price bar showed these same numbers. */
  perPerson: number;
  sets: number;
  grades: number[];
  sizePlan: SizePlan;
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
  const cuts = concept.cuts?.length ? concept.cuts : ['men', 'women'] as GarmentCut[];
  const cutKey = cuts.includes('men') && cuts.includes('women') ? 'mixed' : cuts[0];
  const assigned = allocatedSizeCount(sizePlan.allocation, cuts);
  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-labelledby="qt"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.modal}>
        <div className={s.modalHead}>
          <div>
            <h2 id="qt">{t(locale, 'quote.title')}</h2>
            <p>{t(locale, 'quote.validFor')}</p>
          </div>
          <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={onClose}>{t(locale, 'common.close')}</button>
        </div>
        <div className={s.modalBody}>
          {/* Each garment carries its own cloth and its own upgrade, so the
              row a buyer queries is the row that explains itself. */}
          {concept.garments.map((g, i) => {
            const grade = grades[i] ?? 0;
            const delta = gradesFor(g.type)[grade]?.delta ?? 0;
            return (
              <div className={s.quoteLine} key={i}>
                <span>{t(locale, `garments.${g.type}`)}<div className={s.sub}>
                  {gradeName(g, grade)}{delta > 0 && ` · ${t(locale, 'quote.upgrade')} +${delta}`}
                </div></span>
                <b>{money(g.unitPrice + delta)}</b>
              </div>
            );
          })}
          <div className={s.quoteLine}>
            <span>{t(locale, 'quote.cutRange')}<div className={s.sub}>
              {t(locale, `cuts.${cutKey}`)}
            </div></span>
            <b>—</b>
          </div>
          <div className={s.quoteLine}>
            <span>{t(locale, 'quote.fitProfile')}<div className={s.sub}>
              {concept.garments.map((g) => `${t(locale, `garments.${g.type}`)}: ${
                t(locale, `fits.${g.fit ?? 'regular'}`)}`).join(' · ')}
            </div></span>
            <b>—</b>
          </div>
          <div className={s.quoteLine}>
            <span>{t(locale, 'quote.sizing')}<div className={s.sub}>
              {sizePlan.mode === 'collect_later'
                ? t(locale, 'sizing.collectQuote')
                : t(locale, 'sizing.allocatedQuote', { count: assigned })}
            </div></span>
            <b>{sizePlan.mode === 'allocate_now' ? `${assigned}/${sets}` : '—'}</b>
          </div>
          <div className={s.quoteLine}>
            <span>{t(locale, 'quote.branding')}<div className={s.sub}>
              {concept.logo.position === 'none'
                ? t(locale, 'common.none')
                : `${t(locale, `branding.${concept.logo.method}`)}, ${t(locale, `branding.${concept.logo.position}`)}`}
            </div></span>
            <b>{branding ? money(branding) : '—'}</b>
          </div>
          <div className={s.quoteLine}>
            <span>{t(locale, 'quote.sets')}<div className={s.sub}>
              {spareSets > 0
                ? t(locale, 'quote.coversPeople', { people: staff, spare: spareSets })
                : t(locale, 'quote.coversNoSpare', { people: staff })}
            </div></span>
            <b>{sets}</b>
          </div>
          <div className={s.quoteTotal}>
            <span>{t(locale, 'quote.total')}</span>
            <b>{money(per * sets)}</b>
          </div>
          <ManagerNote locale={locale} note={quoteNote(
            locale, concept, staff, sets,
            sizePlan.mode === 'allocate_now' && assigned === sets,
          )} />
        </div>
        <div className={s.modalFoot}>
          <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={onClose} ref={first}>{t(locale, 'quote.keepEditing')}</button>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={onConfirm}>{t(locale, 'quote.submit')}</button>
        </div>
      </div>
    </div>
  );
}
