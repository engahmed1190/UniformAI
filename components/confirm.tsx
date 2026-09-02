'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import s from '@/app/ui.module.css';

// A confirmation the app owns. window.confirm cannot be one: it prints
// "localhost:3000 says" above your own words, ignores the stylesheet, and
// lays out left-to-right whatever the page direction is -- so in Arabic the
// buttons sit on the wrong side of a sentence read the other way.
//
// Built on <dialog>, which already brings the top layer, the backdrop,
// Escape-to-dismiss and the focus trap. None of that is worth hand-rolling.

export type ConfirmRequest = {
  title: string;
  /** A blank line starts a new paragraph, matching how the strings are written. */
  message: string;
  confirmLabel: string;
  cancelLabel: string;
};

type Pending = ConfirmRequest & { resolve: (ok: boolean) => void };

/** Ask a question and wait for the answer:
 *
 *      if (!(await confirm({ ... }))) return;
 *
 *  Render the returned `dialog` once, anywhere in the tree -- <dialog> is in
 *  the top layer, so no ancestor's overflow or transform can trap it. */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (request: ConfirmRequest) =>
      new Promise<boolean>((resolve) => setPending({ ...request, resolve })),
    [],
  );

  // Depends on `pending` so the resolve it calls is always the live one; a
  // second call finds nothing pending and does nothing, which is what makes
  // Escape-then-click safe.
  const settle = useCallback((ok: boolean) => {
    setPending(null);
    pending?.resolve(ok);
  }, [pending]);

  return {
    confirm,
    dialog: pending ? <ConfirmDialog ask={pending} onSettle={settle} /> : null,
  };
}

function ConfirmDialog({
  ask, onSettle,
}: {
  ask: ConfirmRequest;
  onSettle: (ok: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // showModal() rather than show(): only the former gives the backdrop, the
  // top layer and the focus trap. It mounts open and unmounts closed, so it
  // is never called twice on the same element.
  useEffect(() => { ref.current?.showModal(); }, []);

  return (
    <dialog
      ref={ref}
      className={s.confirmCard}
      aria-labelledby="confirmTitle"
      // Escape closes the dialog natively; that is an answer of "no".
      onCancel={() => onSettle(false)}
    >
      <h2 className={s.confirmTitle} id="confirmTitle">{ask.title}</h2>
      <div className={s.confirmBody}>
        {ask.message.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
      </div>
      <div className={s.confirmActions}>
        {/* Cancel takes focus: the safe answer should be the one a stray
            Enter picks, since these questions guard work you cannot undo. */}
        <button type="button" autoFocus className={`${s.btn} ${s.btnSecondary}`}
          onClick={() => onSettle(false)}>
          {ask.cancelLabel}
        </button>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`}
          onClick={() => onSettle(true)}>
          {ask.confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
