'use client';

import s from '@/app/ui.module.css';
import { type Locale, t } from '@/lib/i18n';

/** The account manager's voice. Only rendered where there is something
 *  specific to say -- if `note` is empty, nothing appears at all. */
export function ManagerNote({
  note, tone = 'inline', intro = false, locale,
}: {
  note: string;
  /** 'panel' for the standalone greeting card, 'inline' inside a step. */
  tone?: 'panel' | 'inline';
  /** Names the role. Used once, on first meeting. */
  intro?: boolean;
  locale: Locale;
}) {
  if (!note) return null;
  return (
    <div className={tone === 'panel' ? s.mgrPanel : s.mgrInline}>
      <span className={s.mgrMark} aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
          <path d="M5 2.6 8 4.2l3-1.6 2.4 1.2v3.6l-1.7.4V14H4.3V7.8l-1.7-.4V3.8z" />
        </svg>
      </span>
      <div className={s.mgrBody}>
        {intro && <div className={s.mgrWho}>{t(locale, 'manager.who')}</div>}
        <p className={s.mgrText}>{note}</p>
      </div>
    </div>
  );
}
