import type { AuditActionType, AuditLogEntry } from '@tpsdev/governance-engine';

import { AuditEvent } from '@/components/AuditEvent';
import { EmptyState } from '@/components/EmptyState';
import { FilterBar, type SelectFilter } from '@/components/FilterBar';
import { getDefaultContext, getTpsClient } from '@/lib/tps';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    entity_type?: string;
    action_type?: string;
    actor?: string;
    from?: string;
    to?: string;
    cursor?: string;
  }>;
}

const ENTITY_TYPE_FILTER: SelectFilter = {
  key: 'entity_type',
  label: 'entity type',
  options: [
    { value: 'governance.agents', label: 'agents' },
    { value: 'governance.permissions', label: 'permissions' },
    { value: 'governance.agent_role_assignments', label: 'assignments' },
    { value: 'governance.roles', label: 'roles' },
    { value: 'governance.rules', label: 'rules' },
    { value: 'governance.resources', label: 'resources' },
    { value: 'governance.tools', label: 'tools' },
  ],
};

const ACTION_TYPE_FILTER: SelectFilter<AuditActionType> = {
  key: 'action_type',
  label: 'action',
  options: [
    { value: 'agent_registered', label: 'agent registered' },
    { value: 'agent_lifecycle_changed', label: 'lifecycle changed' },
    { value: 'permission_granted', label: 'permission granted' },
    { value: 'permission_revoked', label: 'permission revoked' },
    { value: 'assignment_created', label: 'assignment created' },
    { value: 'assignment_revoked', label: 'assignment revoked' },
    { value: 'rule_created', label: 'rule created' },
    { value: 'rule_modified', label: 'rule modified' },
    { value: 'sod_violation_detected', label: 'sod violation' },
  ],
};

export default async function AuditPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tps = getTpsClient();
  const ctx = getDefaultContext();

  const page = await tps.audit.list(ctx, {
    entity_type: params.entity_type,
    action_type: params.action_type as AuditActionType | undefined,
    actor: params.actor,
    from: params.from ? new Date(params.from) : undefined,
    to: params.to ? new Date(params.to) : undefined,
    cursor: params.cursor,
    limit: 50,
  });

  const grouped = groupByDay(page.items);

  return (
    <div className="px-6 py-4 space-y-3">
      <h1 className="kya-data text-xl text-kya-text-primary">AUDIT TIMELINE</h1>

      <FilterBar
        filters={[ENTITY_TYPE_FILTER, ACTION_TYPE_FILTER]}
        searchKey="actor"
        resultCount={page.items.length}
      />

      {page.items.length === 0 ? (
        <EmptyState message="no events match the current filters" />
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([day, events]) => (
            <section key={day}>
              <header className="kya-data text-xs uppercase text-kya-text-muted mb-1">
                {day} — {events.length} events
              </header>
              <div className="border border-kya-border-default bg-kya-bg-secondary">
                {events.map((e) => (
                  <AuditEvent key={e.id} event={e} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {page.next_cursor && (
        <div className="flex justify-center">
          <a
            href={`?${new URLSearchParams({ ...params, cursor: page.next_cursor }).toString()}`}
            className="kya-data text-xs px-3 py-1 border border-kya-border-default text-kya-text-secondary hover:border-kya-accent-primary hover:text-kya-accent-primary"
          >
            LOAD MORE
          </a>
        </div>
      )}
    </div>
  );
}

/** Group events by ISO date (YYYY-MM-DD), preserving the original order. */
function groupByDay(events: AuditLogEntry[]): Map<string, AuditLogEntry[]> {
  const out = new Map<string, AuditLogEntry[]>();
  for (const e of events) {
    const key = new Date(e.occurred_at).toISOString().slice(0, 10);
    const arr = out.get(key);
    if (arr) arr.push(e);
    else out.set(key, [e]);
  }
  return out;
}
