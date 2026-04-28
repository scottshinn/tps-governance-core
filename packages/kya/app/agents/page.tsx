import type {
  Agent,
  AgentLifecycleState,
  AgentType,
  RiskLevel,
} from '@tpsdev/governance-engine';

import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { EntityLink } from '@/components/EntityLink';
import { FilterBar, type SelectFilter } from '@/components/FilterBar';
import { SeverityBadge } from '@/components/SeverityBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { isoDate, relativeTime, reviewStatus } from '@/lib/format';
import { getDefaultContext, getTpsClient } from '@/lib/tps';

export const dynamic = 'force-dynamic';

interface AgentRow extends Agent {
  active_role_count: number;
  latest_risk_level: RiskLevel | null;
}

const LIFECYCLE_FILTER: SelectFilter<AgentLifecycleState> = {
  key: 'state',
  label: 'state',
  options: [
    { value: 'proposed', label: 'proposed' },
    { value: 'under_review', label: 'under review' },
    { value: 'approved', label: 'approved' },
    { value: 'active', label: 'active' },
    { value: 'suspended', label: 'suspended' },
    { value: 'decommissioned', label: 'decommissioned' },
  ],
};

const TYPE_FILTER: SelectFilter<AgentType> = {
  key: 'type',
  label: 'type',
  options: [
    { value: 'orchestrator', label: 'orchestrator' },
    { value: 'worker', label: 'worker' },
    { value: 'autonomous', label: 'autonomous' },
    { value: 'human_in_the_loop', label: 'human in loop' },
  ],
};

interface PageProps {
  searchParams: Promise<{
    state?: string;
    type?: string;
    search?: string;
    cursor?: string;
  }>;
}

export default async function AgentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tps = getTpsClient();
  const ctx = getDefaultContext();

  const { items, next_cursor } = await tps.agents.list(ctx, {
    lifecycle_state: params.state as AgentLifecycleState | undefined,
    agent_type: params.type as AgentType | undefined,
    search: params.search,
    cursor: params.cursor,
    limit: 50,
  });

  // Enrich each agent with active role count and latest risk score in parallel.
  // For a real production deployment this would be one batch query against
  // governance.agent_summary view; for Phase 1 we N+1 over a small list and
  // accept the cost.
  const enriched: AgentRow[] = await Promise.all(
    items.map(async (a) => {
      const [assignments, latestRisk] = await Promise.all([
        tps.assignments.list(ctx, {
          agent_id: a.id,
          active_only: true,
          limit: 100,
        }),
        tps.riskAssessments.latest(ctx, {
          entity_type: 'governance.agents',
          entity_id: a.id,
        }),
      ]);
      return {
        ...a,
        active_role_count: assignments.items.length,
        latest_risk_level: latestRisk?.risk_level ?? null,
      };
    })
  );

  const columns: DataTableColumn<AgentRow>[] = [
    {
      key: 'lifecycle_state',
      header: 'STATE',
      width: 'w-28',
      render: (r) => <StatusBadge state={r.lifecycle_state} />,
    },
    {
      key: 'name',
      header: 'NAME',
      render: (r) => (
        <EntityLink href={`/agents/${r.id}`}>{r.name}</EntityLink>
      ),
    },
    {
      key: 'agent_type',
      header: 'TYPE',
      width: 'w-32',
      render: (r) => (
        <span className="uppercase text-kya-text-secondary">{r.agent_type}</span>
      ),
    },
    {
      key: 'owner',
      header: 'OWNER',
      width: 'w-40',
      render: (r) => <span className="text-kya-text-secondary">{r.owner}</span>,
    },
    {
      key: 'active_role_count',
      header: 'ROLES',
      width: 'w-16',
      align: 'right',
      render: (r) => <span>{r.active_role_count}</span>,
    },
    {
      key: 'risk',
      header: 'RISK',
      width: 'w-24',
      render: (r) =>
        r.latest_risk_level ? (
          <SeverityBadge level={r.latest_risk_level} />
        ) : (
          <span className="text-kya-text-muted">—</span>
        ),
    },
    {
      key: 'review',
      header: 'REVIEW',
      width: 'w-24',
      render: (r) => {
        const s = reviewStatus(r.last_review_at, r.review_cycle_days);
        const label =
          s === 'ok'
            ? 'OK'
            : s === 'overdue'
              ? 'OVERDUE'
              : s === 'never'
                ? 'NEVER'
                : '—';
        const color =
          s === 'ok'
            ? 'text-kya-status-low'
            : s === 'overdue'
              ? 'text-kya-status-medium'
              : 'text-kya-text-muted';
        return <span className={`uppercase ${color}`}>{label}</span>;
      },
    },
    {
      key: 'created_at',
      header: 'CREATED',
      width: 'w-28',
      render: (r) => (
        <span className="text-kya-text-muted" title={isoDate(r.created_at)}>
          {relativeTime(r.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="px-6 py-4 space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="kya-data text-xl text-kya-text-primary">AGENTS</h1>
      </header>

      <FilterBar
        filters={[LIFECYCLE_FILTER, TYPE_FILTER]}
        resultCount={enriched.length}
      />

      <DataTable
        columns={columns}
        rows={enriched}
        empty="no agents match the current filters"
      />

      {next_cursor && (
        <div className="flex justify-center">
          <a
            href={`?${new URLSearchParams({ ...params, cursor: next_cursor }).toString()}`}
            className="kya-data text-xs px-3 py-1 border border-kya-border-default text-kya-text-secondary hover:border-kya-accent-primary hover:text-kya-accent-primary"
          >
            LOAD MORE
          </a>
        </div>
      )}
    </div>
  );
}
