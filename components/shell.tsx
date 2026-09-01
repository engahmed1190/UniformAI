'use client';

import { useEffect, useState } from 'react';
import s from '@/app/ui.module.css';
import { type Locale, LOCALES, LOCALE_NAMES, t } from '@/lib/i18n';

export type PageId = 'home' | 'design' | 'configure' | 'kits' | 'orders' | 'settings';

const ICONS: Record<PageId, React.ReactNode> = {
  home: <><rect x="2" y="2" width="4.5" height="4.5" rx="1" /><rect x="9.5" y="2" width="4.5" height="4.5" rx="1" />
    <rect x="2" y="9.5" width="4.5" height="4.5" rx="1" /><rect x="9.5" y="9.5" width="4.5" height="4.5" rx="1" /></>,
  design: <path d="M8 2l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5z" />,
  configure: <><path d="M3 3.5 5.5 2.5 8 4l2.5-1.5L13 3.5v3.8l-1.8.5V14H4.8V7.8L3 7.3z" /></>,
  kits: <><path d="M2.5 4h11M2.5 8h11M2.5 12h11" /></>,
  orders: <><circle cx="8" cy="8" r="5.8" /><path d="M8 4.8V8l2.2 1.4" /></>,
  settings: <><circle cx="8" cy="8" r="2" />
    <path d="M8 2v1.8M8 12.2V14M14 8h-1.8M3.8 8H2M12.2 3.8l-1.3 1.3M5.1 10.9l-1.3 1.3M12.2 12.2l-1.3-1.3M5.1 5.1 3.8 3.8" /></>,
};

/** Order of the rail. The label for each is a translation key, not a string:
 *  shell.test.ts reads this list, so it stays a plain array of ids. */
const NAV: [PageId, string][] = [
  ['home', 'nav.home'],
  ['design', 'nav.newUniform'],
  ['configure', 'nav.configure'],
  ['kits', 'nav.savedKits'],
  ['orders', 'nav.orders'],
  ['settings', 'nav.settings'],
];

/** On a phone the bar carries the three things people come here to do.
 *  Configure is left out on purpose: it is a state you enter by opening a
 *  kit, and tapping it cold lands on "Nothing to configure yet". Saved kits
 *  and Settings move into More. */
const PHONE_NAV: PageId[] = ['home', 'design', 'orders'];
const MORE_NAV: PageId[] = ['kits', 'settings'];

const KEYS = Object.fromEntries(NAV) as Record<PageId, string>;

function NavButton({
  id, label, current, count, onNavigate,
}: {
  id: PageId; label: string; current: boolean;
  count?: number; onNavigate: (p: PageId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(id)}
      aria-current={current ? 'page' : undefined}
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[id]}
      </svg>
      {label}
      {count ? <span className={s.navCount}>{count}</span> : null}
    </button>
  );
}

export function Sidebar({
  page, onNavigate, company, staff, kitCount, orderCount, locale,
}: {
  page: PageId;
  onNavigate: (p: PageId) => void;
  company: string;
  staff: number;
  kitCount: number;
  orderCount: number;
  locale: Locale;
}) {
  const counts: Partial<Record<PageId, number>> = { kits: kitCount, orders: orderCount };
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the sheet on Escape and whenever the page changes under it.
  useEffect(() => setMoreOpen(false), [page]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const moreCount = MORE_NAV.reduce((n, id) => n + (counts[id] ?? 0), 0);

  return (
    <aside className={s.sidebar}>
      <div className={s.brand}>
        <div className={s.brandmark}>
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" fill="#fff">
            <path d="M5 2.6 8 4.2l3-1.6 2.4 1.2v3.6l-1.7.4V14H4.3V7.8l-1.7-.4V3.8z" />
          </svg>
        </div>
        <span className={s.brandName}>UniformAI</span>
      </div>

      <div className={s.account}>
        <span className={s.accountName}>{company}</span>
        <div className={s.accountMeta}>{t(locale, 'nav.staff', { count: staff })}</div>
      </div>

      {/* The full rail: every destination, shown from tablet width up. */}
      <nav className={s.nav} aria-label={t(locale, 'nav.sections')}>
        <div className={s.navLabel}>{t(locale, 'nav.workspace')}</div>
        {NAV.map(([id, key]) => (
          <NavButton key={id} id={id} label={t(locale, key)} current={page === id}
            count={counts[id]} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* The phone bar: three destinations plus More. */}
      <nav className={s.navPhone} aria-label={t(locale, 'nav.sections')}>
        {PHONE_NAV.map((id) => (
          <NavButton key={id} id={id} label={t(locale, KEYS[id])} current={page === id}
            count={counts[id]} onNavigate={onNavigate} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-current={MORE_NAV.includes(page) ? 'page' : undefined}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" aria-hidden="true">
            <path d="M3 5h10M3 8h10M3 11h10" />
          </svg>
          {t(locale, 'nav.more')}
          {moreCount ? <span className={s.navCount}>{moreCount}</span> : null}
        </button>
      </nav>

      {moreOpen && (
        <>
          <button type="button" className={s.sheetScrim} aria-label={t(locale, 'nav.closeMenu')}
            onClick={() => setMoreOpen(false)} />
          <div className={s.sheet} role="dialog" aria-label={t(locale, 'nav.moreSections')}>
            {MORE_NAV.map((id) => (
              <button key={id} type="button" className={s.sheetItem}
                onClick={() => { onNavigate(id); setMoreOpen(false); }}
                aria-current={page === id ? 'page' : undefined}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {ICONS[id]}
                </svg>
                {t(locale, KEYS[id])}
                {counts[id] ? <span className={s.sheetCount}>{counts[id]}</span> : null}
              </button>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

export function Topbar({ trail, user, locale, onLocale }: {
  trail: string[]; user: string;
  locale: Locale; onLocale: (l: Locale) => void;
}) {
  const initials = user.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <header className={s.topbar}>
      <div className={s.crumb}>
        {trail.map((t, i) => (
          <span key={t}>
            {i > 0 && ' / '}
            {i === trail.length - 1 ? <b>{t}</b> : t}
          </span>
        ))}
      </div>
      <div className={s.topRight}>
        {/* Two languages, so the switch is a pair of buttons rather than a
            select: one tap to change, and the other language is always
            legible in its own script. */}
        <div className={s.langSwitch} role="group" aria-label={t(locale, 'settings.interfaceLanguage')}>
          {LOCALES.map((l) => (
            <button key={l} type="button" onClick={() => onLocale(l)}
              className={l === locale ? s.langOn : undefined}
              aria-pressed={l === locale} lang={l}>
              {LOCALE_NAMES[l]}
            </button>
          ))}
        </div>
        {/* No search box until it searches something. A control that does
            nothing when clicked costs more than the space it saves. */}
        <div className={s.avatar} title={user}>{initials}</div>
      </div>
    </header>
  );
}
