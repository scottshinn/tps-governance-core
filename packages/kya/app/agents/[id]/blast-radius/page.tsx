import type {
  BlastRadiusRow,
  SensitivityClassification,
} from '@tpsdev/governance-engine';

import { Breadcrumb } from '@/components/Breadcrumb';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { SensitivityBar } from '@/components/SensitivityBar';
import { getDefaultContext, getTpsClient } from '@/lib/tps';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

const SENSITIVITY_TEXT: Record<SensitivityClassification, string> = {
  critical: 'text-kya-status-critical',
  restricted: 'text-kya-status-high',
  confidential: 'text-kya-status-medium',
  internal: 'text-kya-status-info',
  public: 'text-kya-text-muted',
};

export default async function BlastRadiusPage({ params }: PageProps) {
  const { id } = await params;
  const tps = getTpsClient();
  const ctx = getDefaultContext();

  const [agent, rows] = await Promise.all([
    tps.agents.get(ctx, id),
    tps.intelligence.blastRadius(ctx, id),
  ]);

  const enriched = rows.map((r) => ({ ...r, id: r.resource_id }));

  return (
    <div className="px-6 py-4 space-y-3">
      <Breadcrumb
        items={[
          { label: 'AGENTS', href: '/agents' },
          { label: agent.name, href: `/agents/${id}` },
          { label: 'BLAST RADIUS' },
        ]}
      />
      <h1 className="kya-data text-xl text-kya-text-primary">BLAST RADIUS</h1>
      <p className="kya-data text-xs text-kya-text-muted max-w-2xl">
        Every resource the agent can reach — directly or via a tool. If this agent
        is compromised, this is the surface an attacker reaches.
      </p>

      <div className="border border-kya-border-default bg-kya-bg-secondary px-3 py-3">
        <SensitivityBar rows={rows} />
      </div>

      {enriched.length === 0 ? (
        <EmptyState message="agent reaches no resources" />
      ) : (
        <DataTable columns={COLUMNS} rows={enriched} />
      )}
    </div>
  );

  function Sensitivity({ row }: { row: BlastRadiusRow }) {
    return (
      <span
        className={`uppercase kya-data text-xs ${SENSITIVITY_TEXT[row.sensitivity]}`}
      >
        {row.sensitivity}
      </span>
    );
  }
}

const COLUMNS: DataTableColumn<BlastRadiusRow & { id: string }>[] = [
  {
    key: 'sensitivity',
    header: 'SENS',
    width: 'w-28',
    render: (r) => (
      <span
        className={`uppercase kya-data text-xs ${SENSITIVITY_TEXT[r.sensitivity]}`}
      >
        {r.sensitivity}
      </span>
    ),
  },
  {
    key: 'resource_name',
    header: 'RESOURCE',
    render: (r) => <span className="text-kya-text-primary">{r.resource_name}</span>,
  },
  {
    key: 'resource_type',
    header: 'TYPE',
    width: 'w-32',
    render: (r) => (
      <span className="uppercase text-kya-text-secondary">{r.resource_type}</span>
    ),
  },
  {
    key: 'effective_actions',
    header: 'ACTIONS',
    render: (r) => (
      <span className="kya-data text-xs text-kya-text-secondary">
        {r.effective_actions.join(', ')}
      </span>
    ),
  },
  {
    key: 'access_paths',
    header: 'VIA',
    render: (r) => (
      <span className="kya-data text-xs text-kya-text-muted">
        {r.access_paths.join(', ')}
      </span>
    ),
  },
];
