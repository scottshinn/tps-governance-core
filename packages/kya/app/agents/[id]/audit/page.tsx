import { AuditEvent } from '@/components/AuditEvent';
import { Breadcrumb } from '@/components/Breadcrumb';
import { EmptyState } from '@/components/EmptyState';
import { getDefaultContext, getTpsClient } from '@/lib/tps';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cursor?: string }>;
}

export default async function AgentAuditPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const tps = getTpsClient();
  const ctx = getDefaultContext();

  const [agent, page] = await Promise.all([
    tps.agents.get(ctx, id),
    tps.audit.list(ctx, {
      entity_type: 'governance.agents',
      entity_id: id,
      limit: 50,
      cursor: sp.cursor,
    }),
  ]);

  return (
    <div className="px-6 py-4 space-y-3">
      <Breadcrumb
        items={[
          { label: 'AGENTS', href: '/agents' },
          { label: agent.name, href: `/agents/${id}` },
          { label: 'AUDIT' },
        ]}
      />
      <h1 className="kya-data text-xl text-kya-text-primary">AUDIT — {agent.name}</h1>

      {page.items.length === 0 ? (
        <EmptyState message="no audit events for this agent" />
      ) : (
        <div className="border border-kya-border-default bg-kya-bg-secondary">
          {page.items.map((e) => (
            <AuditEvent key={e.id} event={e} />
          ))}
        </div>
      )}

      {page.next_cursor && (
        <div className="flex justify-center">
          <a
            href={`?cursor=${encodeURIComponent(page.next_cursor)}`}
            className="kya-data text-xs px-3 py-1 border border-kya-border-default text-kya-text-secondary hover:border-kya-accent-primary hover:text-kya-accent-primary"
          >
            LOAD MORE
          </a>
        </div>
      )}
    </div>
  );
}
