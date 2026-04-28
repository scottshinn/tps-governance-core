import type { ActionType, GrantType, NetPermission } from '@tpsdev/governance-engine';

import { Breadcrumb } from '@/components/Breadcrumb';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { getDefaultContext, getTpsClient } from '@/lib/tps';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PermissionsPage({ params }: PageProps) {
  const { id } = await params;
  const tps = getTpsClient();
  const ctx = getDefaultContext();

  const [agent, netPerms] = await Promise.all([
    tps.agents.get(ctx, id),
    tps.intelligence.netEffectivePermissions(ctx, id),
  ]);

  const rows = netPerms.map((r, i) => ({
    ...r,
    id: `${r.resource_id}-${r.tool_id ?? 'null'}-${i}`,
  }));

  return (
    <div className="px-6 py-4 space-y-3">
      <Breadcrumb
        items={[
          { label: 'AGENTS', href: '/agents' },
          { label: agent.name, href: `/agents/${id}` },
          { label: 'PERMISSIONS' },
        ]}
      />
      <h1 className="kya-data text-xl text-kya-text-primary">NET PERMISSIONS</h1>
      <p className="kya-data text-xs text-kya-text-muted max-w-2xl">
        Resolved from raw <code>governance.effective_permissions(...)</code> using the
        deny-overrides-allow rule (D002). A <code>tool_id IS NULL</code> deny on a
        resource overrides every specific-tool allow on the same resource.
      </p>

      {rows.length === 0 ? (
        <EmptyState message="agent has no effective permissions" />
      ) : (
        <PermissionsDetail rows={rows} />
      )}
    </div>
  );
}

interface NetPermissionRow extends NetPermission {
  id: string;
}

const COLUMNS: DataTableColumn<NetPermissionRow>[] = [
  {
    key: 'resource_id',
    header: 'RESOURCE',
    render: (r) => <span className="text-kya-text-primary">{r.resource_id}</span>,
  },
  {
    key: 'tool_id',
    header: 'TOOL',
    width: 'w-48',
    render: (r) =>
      r.tool_id ? (
        <span className="text-kya-text-secondary">{r.tool_id}</span>
      ) : (
        <span className="text-kya-text-muted italic">any tool</span>
      ),
  },
  {
    key: 'allowed_actions',
    header: 'ALLOWED',
    render: (r) => <Actions actions={r.allowed_actions} variant="allow" />,
  },
  {
    key: 'denied_actions',
    header: 'DENIED',
    render: (r) => <Actions actions={r.denied_actions} variant="deny" />,
  },
  {
    key: 'net_actions',
    header: 'NET',
    render: (r) => <Actions actions={r.net_actions} variant="net" />,
  },
];

function Actions({ actions, variant }: { actions: ActionType[]; variant: 'allow' | 'deny' | 'net' }) {
  if (actions.length === 0) {
    return <span className="text-kya-text-muted">—</span>;
  }
  const cls =
    variant === 'allow'
      ? 'bg-kya-accent-dim text-kya-accent-primary'
      : variant === 'deny'
        ? 'bg-kya-status-critical/20 text-kya-status-critical'
        : 'text-kya-text-primary border border-kya-border-default';
  return (
    <span className="kya-data text-xs">
      {actions.map((a) => (
        <span key={a} className={`inline-block px-1 py-px mr-1 ${cls}`}>
          {a}
        </span>
      ))}
    </span>
  );
}

function PermissionsDetail({ rows }: { rows: NetPermissionRow[] }) {
  return (
    <div className="space-y-3">
      <DataTable columns={COLUMNS} rows={rows} />
      <details className="border border-kya-border-default bg-kya-bg-secondary px-3 py-2">
        <summary className="cursor-pointer kya-data text-xs uppercase text-kya-text-secondary">
          GRANT LINEAGE — every allow / deny that contributed
        </summary>
        <div className="mt-2 space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="kya-data text-xs">
              <div className="text-kya-text-secondary mb-1">
                {r.resource_id} {r.tool_id ? `via ${r.tool_id}` : '(any tool)'}
              </div>
              <ul>
                {r.grant_lineage.map((l, i) => (
                  <Lineage key={i} lineage={l} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function Lineage({
  lineage,
}: {
  lineage: NetPermissionRow['grant_lineage'][number];
}) {
  const cls =
    (lineage.grant_type as GrantType) === 'allow'
      ? 'text-kya-status-low'
      : 'text-kya-status-critical';
  return (
    <li className="flex items-baseline gap-2 py-0.5 border-b border-kya-border-default">
      <span className={cls}>{lineage.grant_type.toUpperCase()}</span>
      <span className="text-kya-text-primary">{lineage.action}</span>
      <span className="text-kya-text-muted">via</span>
      <span className="text-kya-text-secondary">{lineage.role_name}</span>
      <span className="text-kya-text-muted">depth {lineage.role_depth}</span>
      {lineage.any_tool && (
        <span className="text-kya-text-muted italic">(any-tool grant)</span>
      )}
    </li>
  );
}
