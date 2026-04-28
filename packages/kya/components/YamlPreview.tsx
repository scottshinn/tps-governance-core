'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/**
 * Read-only YAML viewer with copy-to-clipboard. Used for the Sanna
 * constitution export modal. No syntax highlighting yet — keeps the
 * surface minimal; revisit if operators ask for it.
 */
export function YamlPreview({
  yaml,
  policyHash,
}: {
  yaml: string;
  policyHash?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — silently noop */
    }
  }

  return (
    <div className="border border-kya-border-default bg-kya-bg-secondary">
      <div className="flex items-center justify-between px-3 py-2 border-b border-kya-border-default">
        <div className="kya-data text-xs text-kya-text-secondary">
          {policyHash ? (
            <>
              <span className="text-kya-text-muted">policy_hash</span>{' '}
              <span className="text-kya-text-primary">{policyHash.slice(0, 16)}…</span>
            </>
          ) : (
            'CONSTITUTION'
          )}
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 kya-data text-xs px-2 py-0.5 border border-kya-border-default hover:border-kya-accent-primary hover:text-kya-accent-primary"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <pre className="kya-data text-xs leading-relaxed text-kya-text-primary px-3 py-2 overflow-auto max-h-[60vh]">
        {yaml}
      </pre>
    </div>
  );
}
