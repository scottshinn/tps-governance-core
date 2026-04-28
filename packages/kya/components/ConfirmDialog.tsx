'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Lightweight confirm dialog — uses the native `<dialog>` element so we
 * get backdrop and focus trap for free. Caller controls open/close via
 * the `open` prop and renders the trigger themselves.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'CONFIRM',
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="bg-kya-bg-secondary text-kya-text-primary border border-kya-border-default p-0 backdrop:bg-black/60"
    >
      <div className="min-w-[360px] max-w-[480px]">
        <header className="px-3 py-2 border-b border-kya-border-default kya-data text-xs uppercase tracking-wider text-kya-text-secondary">
          {title}
        </header>
        <div className="px-3 py-3 kya-data text-sm text-kya-text-primary">
          {body}
        </div>
        <footer className="flex items-center justify-end gap-2 px-3 py-2 border-t border-kya-border-default">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-2 py-1 kya-data text-xs border border-kya-border-default text-kya-text-secondary hover:text-kya-text-primary"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className={`px-2 py-1 kya-data text-xs border ${
              destructive
                ? 'border-kya-status-critical text-kya-status-critical hover:bg-kya-status-critical hover:text-kya-bg-primary'
                : 'border-kya-accent-primary text-kya-accent-primary hover:bg-kya-accent-primary hover:text-kya-bg-primary'
            }`}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
