'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import s from './ui.module.css';
import { Sidebar, Topbar, type PageId } from '@/components/shell';
import { type Locale, LOCALES, LOCALE_CODES, LOCALE_NAMES, dir, kitName, formatCurrency, formatDate, t } from '@/lib/i18n';
import { ConceptCard } from '@/components/concept';
import { Select } from '@/components/select';
import { colourName } from '@/lib/refine';
import { cutsOf } from '@/lib/size-run';
import { POLICY } from '@/lib/policy';

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
import { selectConcepts } from '@/lib/concepts';
import {
  type Concept, type GarmentCut, type SizePlan, LABELS, allocatedSizeCount,
  asSavedKit, conceptPrice, conceptPriceAt, gradeName, gradesFor, sameKit,
} from '@/lib/spec';
import { GROUPS, greeting, whyTheseKits, quoteNote, orderNote } from '@/lib/manager';
import { suggestions } from '@/lib/suggest';
import { type Order, type Workflow, fromJson, status, timeline } from '@/lib/order';
import { ManagerNote } from '@/components/manager';
import { useConfirm } from '@/components/confirm';
import { Check } from '@/components/check';
import { AskErp, type AskRequest } from '@/components/ask-erp';

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
  // stored yet, two sample kits stand in so the library is not bare; once the
  // customer has emptied it themselves, it stays empty.
  useEffect(() => {
    let stored: Concept[] | null = null;
    try { stored = JSON.parse(localStorage.getItem('kits') ?? 'null'); } catch { /* stay empty */ }
    setSaved(stored ?? [
      selectConcepts({ industry: 'site technicians, navy, logo on the chest' })[0],
      selectConcepts({ industry: 'smart shirts for the front desk' })[0],
    ]);
  }, []);
  const [quoting, setQuoting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  // The designer's panel is opened from the price bar, so its state lives
  // beside the bar rather than inside the configurator.
  const [asking, setAsking] = useState(false);
  // An order to open the assistant on, from outside it: the order card's button.
  const [erpRequest, setErpRequest] = useState<AskRequest | null>(null);
  // An order the assistant cited, to open on Orders. `n` makes a repeat
  // click on the same order still count.
  const [focusOrder, setFocusOrder] = useState<{ id: string; n: number } | null>(null);

  // Everything Orders and Home show comes from the sales workflow, newest
  // first. A reload that fails while orders are on screen keeps them; only a
  // first load that fails is an error screen.
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const loadSeq = useRef(0);
  const loadOrders = useCallback(async () => {
    const mine = ++loadSeq.current;
    setLoadState((cur) => (cur === 'failed' ? 'loading' : cur));
    try {
      const res = await fetch('/api/orders');
      if (!res.ok) throw new Error(String(res.status));
      const list = ((await res.json()) as Order[]).map(fromJson);
      if (mine === loadSeq.current) { setOrders(list); setLoadState('ready'); }
      return true;
    } catch {
      if (mine === loadSeq.current) setLoadState((cur) => (cur === 'ready' ? 'ready' : 'failed'));
      return false;
    }
  }, []);
  useEffect(() => {
    if (page === 'orders' || page === 'home') void loadOrders();
  }, [page, loadOrders]);
  useEffect(() => {
    const onFocus = () => void loadOrders();
    addEventListener('focus', onFocus);
    return () => removeEventListener('focus', onFocus);
  }, [loadOrders]);
  // Set by any configurator edit, cleared by a fresh generate. Guards the
  // one destructive path in the app: asking for new kits replaces these.
  const [edited, setEdited] = useState(false);
  const [toast, setToast] = useState('');
  const { confirm, dialog } = useConfirm();

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
  // Never below the minimum order; the quote dialog shows the final count.
  const sets = Math.max(Math.ceil(staff * (1 + spare)), POLICY.minimumSets);

  /* Computed here, beside the price bar, because the button there carries the
     count -- a badge that disagrees with the panel is worse than no badge. */
  const tips = useMemo(
    () => (active ? suggestions(locale, active, grades, brief, sets, spare) : []),
    [locale, active, grades, brief, sets, spare],
  );

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }

  async function generate(text = brief) {
    if (!text.trim()) return;
    if (edited && !(await confirm({
      title: t(locale, 'design.replaceTitle'),
      message: t(locale, 'design.replaceWarning'),
      confirmLabel: t(locale, 'common.confirm'),
      cancelLabel: t(locale, 'common.cancel'),
    }))) return;
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

  async function removeKit(c: Concept) {
    const name = kitName(locale, c.id);
    if (!(await confirm({
      title: t(locale, 'kits.removeTitle', { name }),
      message: t(locale, 'kits.removeNote'),
      confirmLabel: t(locale, 'kits.remove'),
      cancelLabel: t(locale, 'common.cancel'),
    }))) return;
    const next = saved.filter((x) => x.id !== c.id);
    setSaved(next);
    try { localStorage.setItem('kits', JSON.stringify(next)); } catch { /* private mode */ }
    flash(t(locale, 'kits.removed', { name }));
  }

  return (
    <div className={s.app} dir={dir(locale)}>
      <Sidebar
        page={page}
        onNavigate={setPage}
        company={profile.company}
        staff={staff}
        kitCount={saved.length}
        orderCount={orders.filter((o) => status(o) !== 'delivered').length}
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
              loadState={loadState}
              onReload={() => void loadOrders()}
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
                      dir="auto"
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
                    <input id="people" type="number" min={1} max={500} value={staff}
                      onChange={(e) => setStaff(Math.max(1, +e.target.value || 1))} />
                  </div>
                  <div className={s.field}>
                    <label htmlFor="logo">{t(locale, 'design.logoLabel')}</label>
                    <input id="logo" dir="auto" value={logoText} onChange={(e) => setLogoText(e.target.value)} />
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
                  tips={tips}
                  asking={asking}
                  onAskingChange={setAsking}
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
              onRemove={(c) => void removeKit(c)}
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
            <Orders orders={orders} loadState={loadState} onReload={() => void loadOrders()}
              onApproved={(id) => { setFocusOrder({ id, n: Date.now() }); return loadOrders(); }} onHome={() => setPage('home')}
              locale={locale} money={money} shortDay={shortDay}
              focus={focusOrder}
              onAsk={(id) => setErpRequest({ orderId: id, id: Date.now() })} />
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
              {!asking && (
                <button
                  type="button"
                  className={s.chatLauncher}
                  onClick={() => setAsking(true)}
                  aria-label={t(locale, 'suggest.open')}
                  title={t(locale, 'suggest.open')}
                  aria-haspopup="dialog"
                >
                  <svg width="21" height="21" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M5 2.6 8 4.2l3-1.6 2.4 1.2v3.6l-1.7.4V14H4.3V7.8l-1.7-.4V3.8z" />
                  </svg>
                  {tips.length > 0 && <span className={s.chatLauncherCount}>{tips.length}</span>}
                </button>
              )}
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
          onClose={() => { setQuoting(false); setQuoteError(''); }}
          pending={requesting}
          error={quoteError}
          onConfirm={async () => {
            if (requesting) return;
            setRequesting(true);
            setQuoteError('');
            try {
              const res = await fetch('/api/quotes', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ concept: active, staff, sets, grades, sizePlan }),
              });
              if (!res.ok) { setQuoteError(t(locale, failureKey(res.status))); return; }
              const placed = fromJson(await res.json() as Order);
              setQuoting(false);
              flash(t(locale, 'quote.requested', { name: placed.quote ?? placed.id }));
              setFocusOrder({ id: placed.id, n: Date.now() });
              setPage('orders');
              void loadOrders();
            } catch {
              setQuoteError(t(locale, failureKey(502)));
            } finally {
              setRequesting(false);
            }
          }}
        />
      )}

      {toast && <div className={s.toast} role="status">{toast}</div>}
      {/* The account manager, on every screen. */}
      <AskErp locale={locale} request={erpRequest}
        raised={page === 'configure' || (page === 'design' && !!concepts && !busy)}
        onOpenOrder={(id) => { setFocusOrder({ id, n: Date.now() }); setPage('orders'); }}
        onChanged={() => void loadOrders()} />
      {dialog}
    </div>
  );
}

function Home({
  staff, orders, loadState, onReload, savedCount, onAsk, onKits, onOrders, locale, money, shortDay,
}: {
  staff: number;
  locale: Locale;
  money: (n: number) => string;
  shortDay: (d: Date) => string;
  orders: Order[];
  loadState: 'loading' | 'ready' | 'failed';
  onReload: () => void;
  savedCount: number;
  onAsk: (text: string) => void;
  onKits: () => void;
  onOrders: () => void;
}) {
  const [text, setText] = useState('');
  const inState = (...w: readonly Workflow[]) => orders.filter((o) => w.includes(status(o)));
  // The greeting's groups: a quote to approve and sizes to send both wait on you.
  const waiting = inState(...GROUPS.waitingYou, ...GROUPS.waitingSizes);
  const withUs = inState(...GROUPS.withUs);
  const making = inState(...GROUPS.makingNow);
  const done = orders.filter((o) => status(o) === 'delivered');
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
      {loadState !== 'ready' ? (
        loadState === 'failed' ? (
          <Empty
            title={t(locale, 'orders.loadFailed')}
            note={t(locale, 'orders.loadFailedNote')}
            action={t(locale, 'orders.retry')}
            onAct={onReload}
          />
        ) : <p className={s.muted}>{t(locale, 'common.loading')}</p>
      ) : (
        <ManagerNote locale={locale} tone="panel" intro note={greeting(locale, orders)} />
      )}

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

      {loadState === 'ready' && (<>
      <div className={s.stats}>
        <Stat label={t(locale, 'home.savedKits')} value={String(savedCount)} note={t(locale, 'home.savedKitsNote')} />
        {/* Every number here is counted from the orders, or an honest zero. */}
        <Stat label={t(locale, 'home.waitingOnYou')} value={String(waiting.length)}
          note={waiting[0]
            ? t(locale, 'home.orderLine', { id: waiting[0].id, sets: waiting[0].sets })
            : t(locale, 'home.noneOnYou')} />
        <Stat label={t(locale, 'home.withUs')} value={String(withUs.length)}
          note={withUs[0]
            ? t(locale, 'home.orderLine', { id: withUs[0].id, sets: withUs[0].sets })
            : t(locale, 'home.noneWithUs')} />
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
                  <td><strong>{orderKit(locale, o)}</strong><div className={s.sub}>{t(locale, 'home.orderLine', { id: o.id, sets: o.sets })}</div></td>
                  <td data-label={t(locale, 'home.colStatus')}><StatusPill order={o} locale={locale} /></td>
                  <td data-label={t(locale, 'home.colValue')} className={`${s.right} ${s.mono}`}>{money(o.total)}</td>
                  <td data-label={t(locale, 'home.colUpdated')} className={`${s.right} ${s.muted}`}>{shortDay(lastStep(o))}</td>
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
      </>)}
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
  saved, logoText, staff, onNew, onOpen, onRemove, locale, money,
}: {
  saved: Concept[];
  locale: Locale;
  money: (n: number) => string;
  logoText: string;
  staff: number;
  onNew: () => void;
  onOpen: (c: Concept) => void;
  onRemove: (c: Concept) => void;
}) {
  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1>{t(locale, 'kits.title')}</h1>
          <p>{t(locale, 'kits.subtitle')}</p>
        </div>
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
          {/* The action is the last slot on the shelf rather than a button in
              the header: two kits on a wide screen used to sit beside 500px
              of nothing, and the place to say "another one" is at the end of
              the ones you have. */}
          {saved.map((c) => (
            // A sibling of the card, not inside it: the card is itself a button.
            <div key={c.id} className={s.kitSlot}>
              <ConceptCard concept={c} logoText={logoText} employees={staff}
                locale={locale} money={money}
                selected={false} onSelect={() => onOpen(c)} />
              <button type="button" className={s.kitRemove} onClick={() => onRemove(c)}
                aria-label={t(locale, 'kits.removeLabel', { name: kitName(locale, c.id) })}
                title={t(locale, 'kits.remove')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
                </svg>
              </button>
            </div>
          ))}
          <button type="button" className={s.kitNew} onClick={onNew}>
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M8 3.5v9M3.5 8h9" />
            </svg>
            {t(locale, 'kits.newUniform')}
          </button>
        </div>
      )}
    </>
  );
}

/** One pill for one status, coloured the same everywhere it appears. */
/** The kit's display name; a hand-made order has no kit, so its own name. */
const orderKit = (locale: Locale, o: Order) => (o.concept ? kitName(locale, o.concept.id) : o.name);
/** The latest step reached, for "updated". */
const lastStep = (o: Order) =>
  Object.values(o.dates).reduce((a, d) => (d > a ? d : a), o.placed);

function StatusPill({ order, locale }: { order: Order; locale: Locale }) {
  const st = status(order);
  // Good: done. Warn: it is waiting on the customer. Plain: with us or closed.
  const tone = st === 'delivered' ? s.pillGood
    : st === 'quote_ready' || st === 'collecting_sizes' ? s.pillWarn : '';
  return <span className={`${s.pill} ${tone}`}>{t(locale, `orders.state.${st}`)}</span>;
}

function Orders({ orders, loadState, onReload, onApproved, onHome, locale, money, shortDay, onAsk, focus }: {
  orders: Order[]; loadState: 'loading' | 'ready' | 'failed'; onReload: () => void;
  /** The order the approval created, to keep open once the list reloads. */
  onApproved: (id: string) => Promise<boolean>;
  onHome: () => void; locale: Locale;
  money: (n: number) => string; shortDay: (d: Date) => string;
  /** Hands this order's id to the ERP assistant as a question. */
  onAsk: (id: string) => void;
  /** An order to bring up from outside, e.g. a record the assistant cited. */
  focus?: { id: string; n: number } | null;
}) {
  // The open order is a choice on this page, not app state: leaving and
  // coming back should show the newest again.
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (focus && orders.some((x) => x.id === focus.id)) setOpenId(focus.id);
  }, [focus, orders]);
  const o = orders.find((x) => x.id === openId) ?? orders[0];
  const head = (
    <div className={s.pageHead}>
      <div>
        <h1>{t(locale, 'orders.title')}</h1>
        <p>{t(locale, 'orders.subtitle')}</p>
      </div>
    </div>
  );
  if (!o && loadState !== 'ready') {
    return (
      <>
        {head}
        {loadState === 'failed' ? (
          <Empty
            title={t(locale, 'orders.loadFailed')}
            note={t(locale, 'orders.loadFailedNote')}
            action={t(locale, 'orders.retry')}
            onAct={onReload}
          />
        ) : <p className={s.muted}>{t(locale, 'common.loading')}</p>}
      </>
    );
  }
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
  const steps = timeline(o);
  const pct = Math.round(o.perDelivered);
  const sized = o.state === 'collecting_sizes' || o.state === 'in_progress' || o.state === 'delivered';
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
                    tabIndex={0} role="button" aria-label={t(locale, 'orders.open', { name: orderKit(locale, x), id: x.id })}
                    onClick={() => setOpenId(x.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(x.id); }
                    }}>
                    <td>
                      <strong>{orderKit(locale, x)}</strong>
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
            <h2 className={s.orderTitle}>{orderKit(locale, o)}</h2>
            <div className={s.sub}>{t(locale, 'orders.setsAndValue', { sets: o.sets, value: money(o.total) })}</div>
          </div>
          <div className={s.alignEnd}>
            <StatusPill order={o} locale={locale} />
            <div className={`${s.muted} ${s.metaLine}`}>
              {o.state === 'delivered'
                ? t(locale, 'orders.deliveredOn', { date: shortDay(o.dates.delivered ?? o.due) })
                : t(locale, 'orders.dueAround', { date: shortDay(o.due) })}
            </div>
            <button type="button" className={s.askOrder} onClick={() => onAsk(o.id)}>
              {t(locale, 'erpAsk.askAboutOrder')}
            </button>
          </div>
        </div>
        <div className={s.timeline}>
          {steps.map((st, i) => (
            <div key={st.key} className={`${s.tStep} ${st.reached ? s.tDone : st.now ? s.tNow : ''}`}>
              <div className={s.tDot}>{st.reached ? <Check /> : i + 1}</div>
              <b>{t(locale, `orders.step.${st.key}`)}</b>
              <small>{st.reached && st.date ? shortDay(st.date)
                : st.partial ? t(locale, 'orders.partDelivered', { pct: st.partial })
                  : st.now ? t(locale, 'orders.now') : '—'}</small>
              {st.doc && <small className={s.mono}>{st.doc}</small>}
            </div>
          ))}
        </div>
      </div>

      <ManagerNote locale={locale} tone="panel" note={orderNote(locale, o)} />

      {o.state === 'quote_ready' && o.quote && (
        <ApproveQuote key={o.quote} order={o} quote={o.quote} locale={locale} money={money} onDone={onApproved} />
      )}

      <div className={s.group}>
      <div className={s.sectionHead}>
        <div><h2>{t(locale, o.state === 'delivered' ? 'orders.whatWasMade' : 'orders.whatIsBeingMade')}</h2></div>
      </div>
      <div className={`${s.tableCard} ${s.tableFixed} ${s.tableLines}`}>
        <div className={s.tableScroll}>
          <table>
            <thead>
              <tr><th>{t(locale, 'orders.colItem')}</th><th className={s.right}>{t(locale, 'orders.colQty')}</th><th>{t(locale, 'orders.colProgress')}</th><th className={s.right}>{t(locale, 'orders.colReady')}</th></tr>
            </thead>
            <tbody>
              {(o.lines ?? []).map((l, i) => (
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
                      {/* An empty track next to "waiting on sizes" is a grey
                          stub that says nothing the words do not. */}
                      {pct > 0 && <div className={s.progressTrack}><i style={{ width: `${pct}%` }} /></div>}
                      <span className={s.progressPct}>{pct > 0 ? `${pct}%` : sized ? t(locale, 'orders.waitingOnSizes') : '—'}</span>
                    </div>
                  </td>
                  <td data-label={t(locale, 'orders.colReady')} className={`${s.right} ${s.mono}`}>{shortDay(o.state === 'delivered' ? o.dates.delivered ?? o.due : o.due)}</td>
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

/** ERPNext's sales routes answer with a status; the customer gets a sentence. */
const failureKey = (status: number) =>
  status === 409 ? 'orders.errConflict' : status === 502 ? 'orders.errUnreachable' : 'orders.errGeneric';

/** The quoted price, and the one button that turns the quote into an order. */
function ApproveQuote({ order: o, quote, locale, money, onDone }: {
  order: Order; quote: string; locale: Locale; money: (n: number) => string; onDone: (id: string) => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function approve() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const res = await fetch(`/api/quotes/${encodeURIComponent(quote)}/approve`, { method: 'POST' });
      if (!res.ok) { setError(t(locale, failureKey(res.status))); setPending(false); return; }
      // Stay disabled until the reload has moved the order past quote_ready;
      // the card then unmounts. Only a failed reload gives the button back.
      if (!(await onDone(((await res.json()) as Order).id))) setPending(false);
    } catch {
      setError(t(locale, failureKey(502)));
      setPending(false);
    }
  }
  return (
    <div className={`${s.card} ${s.cardPad} ${s.approveBar}`}>
      <div>
        <div className={s.sub}>{t(locale, 'orders.quotedTotal')}</div>
        <b className={`${s.mono} ${s.approveTotal}`}>{money(o.total)}</b>
        {o.total !== o.estimate && (
          <div className={s.sub}>{t(locale, 'orders.originalEstimate', { value: money(o.estimate) })}</div>
        )}
      </div>
      <div className={s.approveAct}>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={pending} onClick={approve}>
          {t(locale, pending ? 'orders.approving' : 'orders.approve')}
        </button>
        {error && <p className={s.approveError} role="alert">{error}</p>}
      </div>
    </div>
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
              <input id="sName" dir="auto" value={d.company} onChange={set('company')}
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
            <textarea id="sRules" dir="auto" value={d.rules} onChange={set('rules')} />
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
  concept, staff, perPerson, sets, grades, sizePlan, onClose, onConfirm, pending, error, locale, money,
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
  pending: boolean;
  error: string;
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
  const cuts = cutsOf(concept);
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
          {/* Items first, then what the kit is made to. Both lists are priced
              per set -- the sets row below is what turns that into the total. */}
          <p className={s.quoteHead}>{t(locale, 'quote.itemsHead')}</p>
          {concept.garments.map((g, i) => {
            const grade = grades[i] ?? 0;
            const delta = gradesFor(g.type)[grade]?.delta ?? 0;
            return (
              <div className={s.quoteLine} key={i}>
                <span>{t(locale, `garments.${g.type}`)}<span className={s.sub}>
                  {gradeName(g, grade)}{delta > 0 && ` · ${t(locale, 'quote.upgrade')} +${delta}`}
                </span></span>
                <b>{money(g.unitPrice + delta)}</b>
              </div>
            );
          })}
          {/* Only a charge belongs in the priced list. Unbranded, this row
              moves to the specification below rather than showing a dash. */}
          {branding > 0 && (
            <div className={s.quoteLine}>
              <span>{t(locale, 'quote.branding')}<span className={s.sub}>
                {`${t(locale, `branding.${concept.logo.method}`)}, ${t(locale, `branding.${concept.logo.position}`)}`}
              </span></span>
              <b>{money(branding)}</b>
            </div>
          )}
          <div className={`${s.quoteLine} ${s.quoteSubtotal}`}>
            <span>{t(locale, 'quote.perSet')}</span>
            <b>{money(per)}</b>
          </div>

          {/* No price column here: these rows describe the kit, they do not
              add to it, and a column of em dashes read as missing numbers. */}
          <p className={s.quoteHead}>{t(locale, 'quote.specHead')}</p>
          {branding === 0 && (
            <div className={s.quoteSpec}>
              <span>{t(locale, 'quote.branding')}</span>
              <span className={s.sub}>{t(locale, 'common.none')}</span>
            </div>
          )}
          <div className={s.quoteSpec}>
            <span>{t(locale, 'quote.cutRange')}</span>
            <span className={s.sub}>{t(locale, `cuts.${cutKey}`)}</span>
          </div>
          <div className={s.quoteSpec}>
            <span>{t(locale, 'quote.fitProfile')}</span>
            <span className={s.sub}>
              {concept.garments.map((g) => `${t(locale, `garments.${g.type}`)}: ${
                t(locale, `fits.${g.fit ?? 'regular'}`)}`).join(' · ')}
            </span>
          </div>
          <div className={s.quoteSpec}>
            <span>{t(locale, 'quote.sizing')}</span>
            <span className={s.sub}>
              {sizePlan.mode === 'collect_later'
                ? t(locale, 'sizing.collectQuote')
                : t(locale, 'sizing.allocatedQuote', { count: assigned })}
              {sizePlan.mode === 'allocate_now' && ` · ${assigned}/${sets}`}
            </span>
          </div>

          <div className={`${s.quoteLine} ${s.quoteSets}`}>
            <span>{t(locale, 'quote.sets')}<span className={s.sub}>
              {spareSets > 0
                ? t(locale, 'quote.coversPeople', { people: staff, spare: spareSets })
                : t(locale, 'quote.coversNoSpare', { people: staff })}
            </span></span>
            <b>{`\u00d7 ${sets}`}</b>
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
        {error && <p className={s.approveError} role="alert" style={{ padding: '0 var(--s5)' }}>{error}</p>}
        <div className={s.modalFoot}>
          <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={onClose} ref={first}>{t(locale, 'quote.keepEditing')}</button>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={onConfirm} disabled={pending}>
            {t(locale, pending ? 'quote.submitting' : 'quote.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
