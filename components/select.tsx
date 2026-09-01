'use client';

import { useEffect, useId, useRef, useState } from 'react';
import s from '@/app/ui.module.css';

export type Choice = {
  value: string;
  /** What the row reads. */
  label: string;
  /** A short code shown alongside, mono, the way a size tab carries both. */
  code?: string;
  /** Set when a row's own language differs from the page's -- the language
   *  picker lists العربية while the page may still be in English. */
  lang?: string;
  dir?: 'ltr' | 'rtl';
};

/** One dropdown for the whole product. A native <select> renders its arrow
 *  from the platform, which lands on the wrong edge in RTL and cannot be
 *  restyled; this draws its own, so the control is identical in both
 *  directions. Keyboard behaviour is the listbox pattern: arrows move,
 *  Enter and Space choose, Escape closes and returns focus to the trigger.
 *
 *  ponytail: no typeahead and no virtualisation. Every list in this app is
 *  under ten rows; add them when one is not. */
export function Select({
  value, choices, onChange, id, label,
}: {
  value: string;
  choices: Choice[];
  onChange: (v: string) => void;
  /** Points a <label htmlFor> at the trigger. */
  id?: string;
  /** Names the control when there is no visible label beside it. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, choices.findIndex((c) => c.value === value)));
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const current = choices.find((c) => c.value === value) ?? choices[0];

  // The highlighted row follows the value while the menu is shut, so opening
  // always starts on what is selected rather than where you last hovered.
  useEffect(() => {
    if (!open) setActive(Math.max(0, choices.findIndex((c) => c.value === value)));
  }, [open, value, choices]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    addEventListener('mousedown', onDown);
    return () => removeEventListener('mousedown', onDown);
  }, [open]);

  function choose(i: number) {
    onChange(choices[i].value);
    setOpen(false);
    trigger.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    // Up and Down, not Left and Right: a vertical list reads the same way in
    // both directions, so the arrows do not swap with the text.
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + choices.length) % choices.length);
      return;
    }
    if (open && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      choose(active);
      return;
    }
    if (!open && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div className={s.sel} ref={box} onKeyDown={onKeyDown}>
      <button
        type="button"
        id={id}
        ref={trigger}
        className={s.selTrigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-label={label}
      >
        <span className={s.selValue} lang={current?.lang} dir={current?.dir}>
          {current?.label}
        </span>
        {current?.code && <span className={s.selCode}>{current.code}</span>}
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={s.selCaret}>
          <path d="M4 6.5 8 10.5l4-4" />
        </svg>
      </button>

      {open && (
        <ul className={s.selMenu} role="listbox" id={listId} aria-label={label}>
          {choices.map((c, i) => (
            <li key={c.value} role="option" aria-selected={c.value === value}>
              <button
                type="button"
                className={`${c.value === value ? s.selOn : ''} ${i === active ? s.selActive : ''}`}
                onClick={() => choose(i)}
                onMouseEnter={() => setActive(i)}
                lang={c.lang}
                dir={c.dir}
                tabIndex={-1}
              >
                <span className={s.selItemLabel}>{c.label}</span>
                {c.code && <span className={s.selCode}>{c.code}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
