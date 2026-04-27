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

const insertActiveAgent = async (name: string) =>
  db.one<{ id: string }>(
    `INSERT INTO governance.agents (name, purpose, agent_type, owner, lifecycle_state)
     VALUES ($1, 'testing', 'worker', 'team', 'active') RETURNING id`,
    [name]
  );

const insertResource = async (name: string) =>
  db.one<{ id: string }>(
    `INSERT INTO governance.resources (name, resource_type, sensitivity, supported_actions)
     VALUES ($1, 'database', 'internal', ARRAY['read','write']::governance.action_type[]) RETURNING id`,
    [name]
  );

const insertRole = async (name: string) =>
  db.one<{ id: string }>(
    `INSERT INTO governance.roles (name, is_built_in) VALUES ($1, false) RETURNING id`,
    [name]
  );

const grantRole = async (agentId: string, roleId: string) =>
  db.any(
    `INSERT INTO governance.agent_role_assignments (agent_id, role_id, assigned_by)
     VALUES ($1, $2, 'test')`,
    [agentId, roleId]
  );

describe('permission_overlap', () => {
  it('returns both agents that have allow permissions on the same resource', async () => {
    const { id: resource_id } = await insertResource('shared-db');
    const { id: role_a } = await insertRole('overlap-role-a');
    const { id: role_b } = await insertRole('overlap-role-b');

    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions)
       VALUES ($1, $2, ARRAY['read']::governance.action_type[])`,
      [role_a, resource_id]
    );
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions)
       VALUES ($1, $2, ARRAY['write']::governance.action_type[])`,
      [role_b, resource_id]
    );

    const { id: agent_a } = await insertActiveAgent('overlap-agent-a');
    const { id: agent_b } = await insertActiveAgent('overlap-agent-b');
    await grantRole(agent_a, role_a);
    await grantRole(agent_b, role_b);

    const rows = await db.any(
      `SELECT agent_id FROM governance.permission_overlap($1) ORDER BY agent_name`,
      [resource_id]
    );
    const ids = rows.map((r: { agent_id: string }) => r.agent_id);
    expect(ids).toContain(agent_a);
    expect(ids).toContain(agent_b);
  });

  it('does not return an agent with only a deny grant on the resource', async () => {
    const { id: resource_id } = await insertResource('deny-resource');
    const { id: role_allow } = await insertRole('allow-role');
    const { id: role_deny } = await insertRole('deny-role');

    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions, grant_type)
       VALUES ($1, $2, ARRAY['read']::governance.action_type[], 'allow')`,
      [role_allow, resource_id]
    );
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions, grant_type)
       VALUES ($1, $2, ARRAY['read']::governance.action_type[], 'deny')`,
      [role_deny, resource_id]
    );

    const { id: agent_allow } = await insertActiveAgent('agent-allow');
    const { id: agent_deny } = await insertActiveAgent('agent-deny');
    await grantRole(agent_allow, role_allow);
    await grantRole(agent_deny, role_deny);

    const rows = await db.any(
      `SELECT agent_id FROM governance.permission_overlap($1)`,
      [resource_id]
    );
    const ids = rows.map((r: { agent_id: string }) => r.agent_id);
    expect(ids).toContain(agent_allow);
    expect(ids).not.toContain(agent_deny);
  });

  it('does not return an agent with an expired role assignment', async () => {
    const { id: resource_id } = await insertResource('expired-resource');
    const { id: role_id } = await insertRole('expired-role');

    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions)
       VALUES ($1, $2, ARRAY['read']::governance.action_type[])`,
      [role_id, resource_id]
    );

    const { id: agent_id } = await insertActiveAgent('expired-agent');
    await db.any(
      `INSERT INTO governance.agent_role_assignments (agent_id, role_id, assigned_by, expires_at)
       VALUES ($1, $2, 'test', now() - interval '1 day')`,
      [agent_id, role_id]
    );

    const rows = await db.any(
      `SELECT * FROM governance.permission_overlap($1)`,
      [resource_id]
    );
    expect(rows).toHaveLength(0);
  });

  it('returns empty for a resource with no permissions', async () => {
    const { id: resource_id } = await insertResource('ungoverned-resource');
    const rows = await db.any(
      `SELECT * FROM governance.permission_overlap($1)`,
      [resource_id]
    );
    expect(rows).toHaveLength(0);
  });

  it('returns the union of effective actions for each agent', async () => {
    const { id: resource_id } = await insertResource('multi-action-resource');
    const { id: role_id } = await insertRole('multi-action-role');

    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions)
       VALUES ($1, $2, ARRAY['read','write']::governance.action_type[])`,
      [role_id, resource_id]
    );

    const { id: agent_id } = await insertActiveAgent('multi-action-agent');
    await grantRole(agent_id, role_id);

    const rows = await db.any(
      `SELECT * FROM governance.permission_overlap($1)`,
      [resource_id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].effective_actions).toContain('read');
    expect(rows[0].effective_actions).toContain('write');
  });
});
