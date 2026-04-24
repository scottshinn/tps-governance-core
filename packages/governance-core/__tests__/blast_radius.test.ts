import { getConnections, PgTestClient } from 'pgsql-test';

let db: PgTestClient;
let pg: PgTestClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  ({ pg, db, teardown } = await getConnections());
});

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await db.beforeEach();
});

afterEach(async () => {
  await db.afterEach();
});

const insertResource = async (name: string, sensitivity = 'internal') =>
  db.one<{ id: string }>(
    `INSERT INTO governance.resources (name, resource_type, sensitivity, supported_actions)
     VALUES ($1, 'database', $2::governance.sensitivity_classification,
             ARRAY['read','write','delete']::governance.action_type[]) RETURNING id`,
    [name, sensitivity]
  );

describe('blast_radius', () => {
  it('returns directly-permissioned resources', async () => {
    const { id: resource_id } = await insertResource('direct-resource');
    const { id: role_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.roles (name, is_built_in) VALUES ('blast-role', false) RETURNING id`
    );
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions)
       VALUES ($1, $2, ARRAY['read']::governance.action_type[])`,
      [role_id, resource_id]
    );
    const { id: agent_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.agents (name, purpose, agent_type, owner)
       VALUES ('blast-agent', 'testing', 'worker', 'team') RETURNING id`
    );
    await db.any(
      `INSERT INTO governance.agent_role_assignments (agent_id, role_id, assigned_by)
       VALUES ($1, $2, 'test')`,
      [agent_id, role_id]
    );

    const radius = await db.any(
      `SELECT * FROM governance.blast_radius($1)`,
      [agent_id]
    );
    expect(radius).toHaveLength(1);
    expect(radius[0].resource_id).toBe(resource_id);
    expect(radius[0].effective_actions).toContain('read');
    expect(radius[0].access_paths).toContain('direct_permission');
  });

  it('includes resources reachable via tools', async () => {
    const { id: direct_resource_id } = await insertResource('tool-permission-resource');
    const { id: indirect_resource_id } = await insertResource('tool-accessed-resource', 'confidential');

    const { id: mcp_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.mcp_servers (name, endpoint_url, status)
       VALUES ('test-mcp', 'http://localhost:3000', 'active') RETURNING id`
    );
    const { id: tool_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.tools (name, tool_type, mcp_server_id, is_idempotent)
       VALUES ('query-tool', 'mcp_tool', $1, true) RETURNING id`,
      [mcp_id]
    );
    await db.any(
      `INSERT INTO governance.tool_resources (tool_id, resource_id, actions)
       VALUES ($1, $2, ARRAY['read']::governance.action_type[])`,
      [tool_id, indirect_resource_id]
    );

    const { id: role_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.roles (name, is_built_in) VALUES ('tool-role', false) RETURNING id`
    );
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, tool_id, actions)
       VALUES ($1, $2, $3, ARRAY['execute']::governance.action_type[])`,
      [role_id, direct_resource_id, tool_id]
    );

    const { id: agent_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.agents (name, purpose, agent_type, owner)
       VALUES ('tool-blast-agent', 'testing', 'worker', 'team') RETURNING id`
    );
    await db.any(
      `INSERT INTO governance.agent_role_assignments (agent_id, role_id, assigned_by)
       VALUES ($1, $2, 'test')`,
      [agent_id, role_id]
    );

    const radius = await db.any(
      `SELECT * FROM governance.blast_radius($1)`,
      [agent_id]
    );
    const resourceIds = radius.map((r: { resource_id: string }) => r.resource_id);
    expect(resourceIds).toContain(indirect_resource_id);
    const indirect = radius.find((r: { resource_id: string }) => r.resource_id === indirect_resource_id);
    expect(indirect.access_paths.some((p: string) => p.startsWith('via_tool:'))).toBe(true);
  });

  it('returns results ordered by sensitivity descending', async () => {
    const { id: critical_id } = await insertResource('secret-store', 'critical');
    const { id: public_id } = await insertResource('public-api', 'public');

    const { id: role_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.roles (name, is_built_in) VALUES ('multi-role', false) RETURNING id`
    );
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions) VALUES ($1, $2, ARRAY['read']::governance.action_type[])`,
      [role_id, critical_id]
    );
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions) VALUES ($1, $2, ARRAY['read']::governance.action_type[])`,
      [role_id, public_id]
    );

    const { id: agent_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.agents (name, purpose, agent_type, owner)
       VALUES ('ordering-agent', 'testing', 'worker', 'team') RETURNING id`
    );
    await db.any(
      `INSERT INTO governance.agent_role_assignments (agent_id, role_id, assigned_by) VALUES ($1, $2, 'test')`,
      [agent_id, role_id]
    );

    const radius = await db.any(`SELECT * FROM governance.blast_radius($1)`, [agent_id]);
    expect(radius[0].sensitivity).toBe('critical');
  });
});
