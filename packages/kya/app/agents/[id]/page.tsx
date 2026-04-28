import { notFound } from 'next/navigation';

import type {
  ActionType,
  AgentToolInventoryRow,
  AuditLogEntry,
  BlastRadiusRow,
  NetPermission,
  RiskAssessment,
  SodCheckRow,
} from '@tpsdev/governance-engine';
import { TpsNotFoundError } from '@tpsdev/governance-engine';

import { AgentActions } from '@/components/AgentActions';
import { AuditEvent } from '@/components/AuditEvent';
import { Breadcrumb } from '@/components/Breadcrumb';
import { ComplianceProgress } from '@/components/ComplianceProgress';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { EntityLink } from '@/components/EntityLink';
import { KyaCard } from '@/components/KyaCard';
import { RiskScore } from '@/components/RiskScore';
import { SensitivityBar } from '@/components/SensitivityBar';
import { SeverityBadge } from '@/components/SeverityBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { isoDate, relativeTime, reviewStatus } from '@/lib/format';
import { getDefaultContext, getTpsClient } from '@/lib/tps';

import {
  evaluateRulesForAgent,
  exportConstitution,
  runRiskAssessment,
  setAgentLifecycle,
} from './actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const tps = getTpsClient();
  const ctx = getDefaultContext();

  let agent;
  try {
    agent = await tps.agents.get(ctx, id);
  } catch (err) {
    if (err instanceof TpsNotFoundError) notFound();
    throw err;
  }

  // Eight parallel TpsClient calls per the spec.
  const [
    netPerms,
    tools,
    blast,
    sod,
    risk,
    audit,
    parent,
    children,
  ] = await Promise.all([
    tps.intelligence.netEffectivePermissions(ctx, id),
    tps.intelligence.toolInventory(ctx, id),
    tps.intelligence.blastRadius(ctx, id),
    tps.intelligence.sodCheck(ctx, id),
    tps.riskAssessments.latest(ctx, {
      entity_type: 'governance.agents',
      entity_id: id,
    }),
    tps.audit.list(ctx, {
      entity_type: 'governance.agents',
      entity_id: id,
      limit: 10,
    }),
    agent.parent_agent_id
      ? tps.agents.get(ctx, agent.parent_agent_id).catch(() => null)
      : Promise.resolve(null),
    tps.agents.listChildren(ctx, id),
  ]);

  // Bind server actions for this specific agent.
  const setLifecycle = setAgentLifecycle.bind(null, id);
  const exportFn = exportConstitution.bind(null, id);
  const runRisk = runRiskAssessment.bind(null, id);
  const evaluateFn = evaluateRulesForAgent.bind(null, id);

  return (
    <div className="px-6 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <Breadcrumb
          items={[
            { label: 'AGENTS', href: '/agents' },
            { label: agent.name },
          ]}
        />
        <StatusBadge state={agent.lifecycle_state} />
      </div>

      <header className="flex items-center justify-between">
        <h1 className="kya-data text-xl text-kya-accent-primary">{agent.name}</h1>
        <AgentActions
          agentId={id}
          lifecycle={agent.lifecycle_state}
          setLifecycle={setLifecycle}
          exportConstitution={exportFn}
          runRiskAssessment={runRisk}
          evaluateRules={evaluateFn}
        />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Identity panel */}
        <KyaCard title="IDENTITY">
          <dl className="kya-data text-sm grid grid-cols-[120px_1fr] gap-y-1">
            <dt className="text-kya-text-secondary">name</dt>
            <dd className="text-kya-text-primary">{agent.name}</dd>
            <dt className="text-kya-text-secondary">version</dt>
            <dd className="text-kya-text-primary">{agent.version ?? '—'}</dd>
            <dt className="text-kya-text-secondary">type</dt>
            <dd className="text-kya-text-primary">{agent.agent_type}</dd>
            <dt className="text-kya-text-secondary">purpose</dt>
            <dd className="text-kya-text-primary whitespace-pre-wrap">{agent.purpose}</dd>
            <dt className="text-kya-text-secondary">owner</dt>
            <dd className="text-kya-text-primary">{agent.owner}</dd>
            {agent.contact && (
              <>
                <dt className="text-kya-text-secondary">contact</dt>
                <dd className="text-kya-text-primary">{agent.contact}</dd>
              </>
            )}
            <dt className="text-kya-text-secondary">review</dt>
            <dd className="text-kya-text-primary">
              {(() => {
                const s = reviewStatus(agent.last_review_at, agent.review_cycle_days);
                if (s === 'no-cycle')
                  return <span className="text-kya-text-muted">no cycle</span>;
                if (s === 'never')
                  return (
                    <span className="text-kya-status-medium">
                      never reviewed
                    </span>
                  );
                if (s === 'overdue')
                  return (
                    <span className="text-kya-status-medium">
                      overdue (last {relativeTime(agent.last_review_at)})
                    </span>
                  );
                return (
                  <span className="text-kya-status-low">
                    OK — last {relativeTime(agent.last_review_at)}
                  </span>
                );
              })()}
            </dd>
            <dt className="text-kya-text-secondary">created</dt>
            <dd className="text-kya-text-muted" title={isoDate(agent.created_at)}>
              {relativeTime(agent.created_at)}
            </dd>
          </dl>
        </KyaCard>

        {/* Risk panel */}
        <KyaCard title="RISK">
          <RiskScore
            assessment={
              risk
                ? {
                  risk_score: risk.risk_score,
                  risk_level: risk.risk_level,
                  risk_factors: risk.risk_factors,
                }
                : null
            }
          />
        </KyaCard>

        {/* Hierarchy panel */}
        <KyaCard title="HIERARCHY">
          <dl className="kya-data text-sm grid grid-cols-[120px_1fr] gap-y-1">
            <dt className="text-kya-text-secondary">reports to</dt>
            <dd>
              {parent ? (
                <EntityLink href={`/agents/${parent.id}`}>{parent.name}</EntityLink>
              ) : (
                <span className="text-kya-text-muted">top-level</span>
              )}
            </dd>
            <dt className="text-kya-text-secondary">sub-agents</dt>
            <dd>
              {children.length === 0 ? (
                <span className="text-kya-text-muted">none</span>
              ) : (
                <ul className="space-y-0.5">
                  {children.map((c) => (
                    <li key={c.id}>
                      <EntityLink href={`/agents/${c.id}`}>{c.name}</EntityLink>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </dl>
        </KyaCard>

        {/* SoD panel */}
        <KyaCard title="SOD VIOLATIONS">
          <SodPanel rows={sod} />
        </KyaCard>
      </div>

      {/* Tools — first 6 */}
      <KyaCard
        title="TOOLS"
        action={
          <EntityLink href={`/agents/${id}/tools`}>
            view all ({tools.length}) →
          </EntityLink>
        }
      >
        <ToolsTable rows={tools.slice(0, 6)} />
      </KyaCard>

      {/* Net permissions — first 8 */}
      <KyaCard
        title="NET PERMISSIONS"
        action={
          <EntityLink href={`/agents/${id}/permissions`}>
            view all ({netPerms.length}) →
          </EntityLink>
        }
      >
        <PermissionsTable rows={netPerms.slice(0, 8)} />
      </KyaCard>

      {/* Blast radius summary */}
      <KyaCard
        title="BLAST RADIUS"
        action={
          <EntityLink href={`/agents/${id}/blast-radius`}>
            view all ({blast.length}) →
          </EntityLink>
        }
      >
        <SensitivityBar rows={blast} />
      </KyaCard>

      {/* Compliance summary — placeholder until per-agent compliance check
          is run on every page load (potentially expensive). For Phase 1 we
          show "run RULES → see results". */}
      <KyaCard title="COMPLIANCE">
        <ComplianceSummary />
      </KyaCard>

      {/* Recent audit */}
      <KyaCard
        title="RECENT AUDIT"
        action={
          <EntityLink href={`/agents/${id}/audit`}>view all →</EntityLink>
        }
      >
        <AuditList events={audit.items} />
      </KyaCard>
    </div>
  );
}

// ---------- Inline panel components ----------

function SodPanel({ rows }: { rows: SodCheckRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="kya-data text-sm text-kya-status-low">
        ✓ no active violations
      </div>
    );
  }
  return (
    <ul className="kya-data text-sm space-y-1">
      {rows.map((v) => (
        <li
          key={v.constraint_id}
          className="flex items-start gap-2 py-1 border-b last:border-b-0 border-kya-border-default"
        >
          <SeverityBadge level={v.severity} />
          <span className="text-kya-text-primary flex-1">{v.constraint_name}</span>
          <span className="text-kya-text-muted text-xs">
            {v.side_a_perm_ids.length}↔{v.side_b_perm_ids.length} perms
          </span>
        </li>
      ))}
    </ul>
  );
}

const TOOL_COLUMNS: DataTableColumn<AgentToolInventoryRow>[] = [
  {
    key: 'tool_name',
    header: 'NAME',
    render: (r) => <span className="text-kya-text-primary">{r.tool_name}</span>,
  },
  {
    key: 'tool_type',
    header: 'TYPE',
    width: 'w-28',
    render: (r) => (
      <span className="uppercase text-kya-text-secondary">{r.tool_type}</span>
    ),
  },
  {
    key: 'mcp_server_name',
    header: 'SERVER',
    width: 'w-32',
    render: (r) => (
      <span className="text-kya-text-secondary">
        {r.mcp_server_name ?? '—'}
      </span>
    ),
  },
  {
    key: 'is_destructive',
    header: 'DESTRUCT',
    width: 'w-24',
    render: (r) =>
      r.is_destructive ? (
        <span className="text-kya-status-critical kya-data">YES ●</span>
      ) : (
        <span className="text-kya-text-muted">no</span>
      ),
  },
  {
    key: 'resource_count',
    header: 'RES',
    width: 'w-12',
    align: 'right',
    render: (r) => <span>{r.resource_count}</span>,
  },
];

function ToolsTable({ rows }: { rows: AgentToolInventoryRow[] }) {
  if (rows.length === 0) {
    return <EmptyState message="no tools granted" />;
  }
  return <DataTable columns={TOOL_COLUMNS} rows={rows.map((r) => ({ ...r, id: r.tool_id }))} />;
}

interface NetPermissionRow extends NetPermission {
  id: string;
}

const PERMISSION_COLUMNS: DataTableColumn<NetPermissionRow>[] = [
  {
    key: 'resource_id',
    header: 'RESOURCE',
    render: (r) => <span className="text-kya-text-primary truncate">{r.resource_id.slice(0, 8)}…</span>,
  },
  {
    key: 'tool_id',
    header: 'TOOL',
    width: 'w-32',
    render: (r) =>
      r.tool_id ? (
        <span className="text-kya-text-secondary">{r.tool_id.slice(0, 8)}…</span>
      ) : (
        <span className="text-kya-text-muted italic">any tool</span>
      ),
  },
  {
    key: 'net_actions',
    header: 'NET',
    render: (r) => <ActionList actions={r.net_actions} />,
  },
  {
    key: 'denied_actions',
    header: 'DENIED',
    width: 'w-40',
    render: (r) =>
      r.denied_actions.length > 0 ? (
        <span className="kya-data text-xs text-kya-status-critical">
          {r.denied_actions.join(', ')}
        </span>
      ) : (
        <span className="text-kya-text-muted">—</span>
      ),
  },
];

function PermissionsTable({ rows }: { rows: NetPermission[] }) {
  if (rows.length === 0) {
    return <EmptyState message="no effective permissions" />;
  }
  const enriched: NetPermissionRow[] = rows.map((r, i) => ({
    ...r,
    id: `${r.resource_id}-${r.tool_id ?? 'null'}-${i}`,
  }));
  return <DataTable columns={PERMISSION_COLUMNS} rows={enriched} />;
}

function ActionList({ actions }: { actions: ActionType[] }) {
  if (actions.length === 0) {
    return <span className="text-kya-text-muted">—</span>;
  }
  return (
    <span className="kya-data text-xs">
      {actions.map((a) => (
        <span
          key={a}
          className="inline-block px-1 py-px mr-1 bg-kya-accent-dim text-kya-accent-primary"
        >
          {a}
        </span>
      ))}
    </span>
  );
}

function ComplianceSummary() {
  return (
    <div className="kya-data text-xs text-kya-text-muted">
      Run <span className="text-kya-text-primary">EVALUATE RULES</span> from the
      action bar to see compliance against linked frameworks. Per-page
      pre-evaluation is deferred until Phase 2.
    </div>
  );
}

function AuditList({ events }: { events: AuditLogEntry[] }) {
  if (events.length === 0) {
    return <EmptyState message="no audit events for this agent" />;
  }
  return (
    <div className="-mx-3">
      {events.map((e) => (
        <AuditEvent key={e.id} event={e} />
      ))}
    </div>
  );
}
