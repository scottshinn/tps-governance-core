import type { AgentToolInventoryRow } from '@tpsdev/governance-engine';

import { Breadcrumb } from '@/components/Breadcrumb';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { getDefaultContext, getTpsClient } from '@/lib/tps';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ToolsPage({ params }: PageProps) {
  const { id } = await params;
  const tps = getTpsClient();
  const ctx = getDefaultContext();

  const [agent, tools] = await Promise.all([
    tps.agents.get(ctx, id),
    tps.intelligence.toolInventory(ctx, id),
  ]);

  const rows = tools.map((r) => ({ ...r, id: r.tool_id }));

  return (
    <div className="px-6 py-4 space-y-3">
      <Breadcrumb
        items={[
          { label: 'AGENTS', href: '/agents' },
          { label: agent.name, href: `/agents/${id}` },
          { label: 'TOOLS' },
        ]}
      />
      <h1 className="kya-data text-xl text-kya-text-primary">TOOL INVENTORY</h1>
      <p className="kya-data text-xs text-kya-text-muted max-w-2xl">
        Tools the agent can use, resolved through the role hierarchy. Allow-only —
        tools blocked by deny grants are not shown (D025).
      </p>

      {rows.length === 0 ? (
        <EmptyState message="agent has no tools granted" />
      ) : (
        <DataTable columns={COLUMNS} rows={rows} />
      )}
    </div>
  );
}

const COLUMNS: DataTableColumn<AgentToolInventoryRow & { id: string }>[] = [
  {
    key: 'tool_name',
    header: 'NAME',
    render: (r) => <span className="text-kya-text-primary">{r.tool_name}</span>,
  },
  {
    key: 'tool_type',
    header: 'TYPE',
    width: 'w-32',
    render: (r) => (
      <span className="uppercase text-kya-text-secondary">{r.tool_type}</span>
    ),
  },
  {
    key: 'mcp_server_name',
    header: 'SERVER',
    width: 'w-40',
    render: (r) => (
      <span className="text-kya-text-secondary">{r.mcp_server_name ?? '—'}</span>
    ),
  },
  {
    key: 'is_destructive',
    header: 'DESTRUCT',
    width: 'w-24',
    render: (r) =>
      r.is_destructive ? (
        <span className="text-kya-status-critical">YES ●</span>
      ) : (
        <span className="text-kya-text-muted">no</span>
      ),
  },
  {
    key: 'is_idempotent',
    header: 'IDEMP',
    width: 'w-20',
    render: (r) =>
      r.is_idempotent ? (
        <span className="text-kya-status-low">yes</span>
      ) : (
        <span className="text-kya-text-muted">no</span>
      ),
  },
  {
    key: 'resource_count',
    header: 'RES',
    width: 'w-16',
    align: 'right',
    render: (r) => <span>{r.resource_count}</span>,
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
    key: 'granted_via_role_name',
    header: 'GRANTED VIA',
    width: 'w-48',
    render: (r) => (
      <span className="text-kya-text-secondary">
        {r.granted_via_role_name}
        <span className="text-kya-text-muted ml-1">d{r.granted_via_role_depth}</span>
      </span>
    ),
  },
];
