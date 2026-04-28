'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

interface Command {
  label: string;
  hint?: string;
  href: string;
}

/**
 * Minimal command palette for ⌘K / Ctrl+K. Phase 1 ships static page
 * navigation only; Phase 2 will add agent search via a server-action
 * RPC into `tps.agents.list({ search })`.
 */
const COMMANDS: Command[] = [
  { label: 'Agents', hint: 'go to agent registry', href: '/agents' },
  { label: 'Audit', hint: 'go to global audit timeline', href: '/audit' },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery('');
  }, [open]);

  if (!open) return null;

  const filtered = COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[480px] max-w-[90vw] bg-kya-bg-secondary border border-kya-border-default kya-data"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-kya-border-default">
          <Search size={14} className="text-kya-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="jump to..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-kya-text-muted"
          />
          <kbd>esc</kbd>
        </div>
        <ul className="max-h-[40vh] overflow-auto">
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-xs text-kya-text-muted">no matches</li>
          ) : (
            filtered.map((c) => (
              <li key={c.href}>
                <button
                  type="button"
                  onClick={() => {
                    router.push(c.href);
                    setOpen(false);
                  }}
                  className="w-full flex items-baseline justify-between px-3 py-1.5 text-left hover:bg-kya-bg-tertiary"
                >
                  <span className="text-sm text-kya-text-primary">{c.label}</span>
                  {c.hint && (
                    <span className="text-xs text-kya-text-muted">{c.hint}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
