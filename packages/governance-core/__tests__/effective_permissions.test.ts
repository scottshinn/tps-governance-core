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

describe('effective_permissions', () => {
  it('returns empty set for agent with no role assignments', async () => {
    const { id: agent_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.agents (name, purpose, agent_type, owner)
       VALUES ('no-roles-agent', 'nothing', 'worker', 'team') RETURNING id`
    );
    const perms = await db.any(
      `SELECT * FROM governance.effective_permissions($1)`,
      [agent_id]
    );
    expect(perms).toHaveLength(0);
  });

  it('returns both allow and deny grants', async () => {
    const { id: resource_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.resources (name, resource_type, supported_actions)
       VALUES ('mixed-resource', 'database', ARRAY['read','delete']::governance.action_type[]) RETURNING id`
    );
    const { id: role_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.roles (name, is_built_in) VALUES ('mixed-role', false) RETURNING id`
    );
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions, grant_type)
       VALUES ($1, $2, ARRAY['read']::governance.action_type[], 'allow')`,
      [role_id, resource_id]
    );
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions, grant_type)
       VALUES ($1, $2, ARRAY['delete']::governance.action_type[], 'deny')`,
      [role_id, resource_id]
    );
    const { id: agent_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.agents (name, purpose, agent_type, owner)
       VALUES ('mixed-agent', 'testing', 'worker', 'team') RETURNING id`
    );
    await db.any(
      `INSERT INTO governance.agent_role_assignments (agent_id, role_id, assigned_by)
       VALUES ($1, $2, 'test')`,
      [agent_id, role_id]
    );

    const perms = await db.any(
      `SELECT grant_type FROM governance.effective_permissions($1) ORDER BY grant_type`,
      [agent_id]
    );
    const grantTypes = perms.map((p: { grant_type: string }) => p.grant_type);
    expect(grantTypes).toContain('allow');
    expect(grantTypes).toContain('deny');
  });

  it('excludes permissions from revoked role assignments', async () => {
    const { id: resource_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.resources (name, resource_type, supported_actions)
       VALUES ('revoked-resource', 'database', ARRAY['read']::governance.action_type[]) RETURNING id`
    );
    const { id: role_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.roles (name, is_built_in) VALUES ('revoked-role', false) RETURNING id`
    );
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions) VALUES ($1, $2, ARRAY['read']::governance.action_type[])`,
      [role_id, resource_id]
    );
    const { id: agent_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.agents (name, purpose, agent_type, owner)
       VALUES ('revoked-agent', 'testing', 'worker', 'team') RETURNING id`
    );
    await db.any(
      `INSERT INTO governance.agent_role_assignments (agent_id, role_id, assigned_by, status)
       VALUES ($1, $2, 'test', 'revoked')`,
      [agent_id, role_id]
    );

    const perms = await db.any(
      `SELECT * FROM governance.effective_permissions($1)`,
      [agent_id]
    );
    expect(perms).toHaveLength(0);
  });
});
