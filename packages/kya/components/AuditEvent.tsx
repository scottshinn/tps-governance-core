'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import type { AuditLogEntry } from '@tpsdev/governance-engine';

import { JsonDiff } from './JsonDiff';

/**
 * Single audit-log row. Collapsed by default — click to expand and see
 * the full state diff and metadata.
 */
export function AuditEvent({ event }: { event: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  const time = new Date(event.occurred_at);
  const hhmmss = time.toISOString().slice(11, 19);

  return (
    <div className="border-b border-kya-border-default kya-data text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-2 px-3 py-1.5 text-left hover:bg-kya-bg-tertiary"
      >
        {open ? (
          <ChevronDown size={12} className="mt-0.5 text-kya-text-muted" />
        ) : (
          <ChevronRight size={12} className="mt-0.5 text-kya-text-muted" />
        )}
        <span className="text-kya-text-muted tabular-nums w-16">{hhmmss}</span>
        <span className="text-kya-text-secondary truncate w-48">
          {event.actor ?? 'system'}
        </span>
        <span className="text-kya-accent-primary">{event.action_type}</span>
        <span className="text-kya-text-secondary truncate flex-1">
          {event.entity_type}
        </span>
        <span className="text-kya-text-muted truncate w-32">
          {event.entity_id.slice(0, 8)}…
        </span>
      </button>
      {open && (
        <div className="px-9 py-2 border-t border-kya-border-default bg-kya-bg-primary">
          {event.reason && (
            <div className="mb-1 text-kya-text-secondary">
              <span className="text-kya-text-muted">reason:</span> {event.reason}
            </div>
          )}
          <JsonDiff previous={event.previous_state} next={event.new_state} />
        </div>
      )}
    </div>
  );
}
