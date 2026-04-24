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

const insertRole = async (name: string, parentName?: string) => {
  const parentRow = parentName
    ? await db.one<{ id: string }>(`SELECT id FROM governance.roles WHERE name = $1`, [parentName])
    : null;
  return db.one<{ id: string }>(
    `INSERT INTO governance.roles (name, parent_role_id, is_built_in)
     VALUES ($1, $2, false) RETURNING id`,
    [name, parentRow?.id ?? null]
  );
};

const insertResource = async () =>
  db.one<{ id: string }>(
    `INSERT INTO governance.resources (name, resource_type, supported_actions)
     VALUES ('test-db', 'database', ARRAY['read','write']::governance.action_type[]) RETURNING id`
  );

const grantPermission = async (roleId: string, resourceId: string, actions: string[]) =>
  db.one<{ id: string }>(
    `INSERT INTO governance.permissions (role_id, resource_id, actions)
     VALUES ($1, $2, $3::governance.action_type[]) RETURNING id`,
    [roleId, resourceId, `{${actions.join(',')}}`]
  );

const assignRole = async (agentId: string, roleId: string) =>
  db.any(
    `INSERT INTO governance.agent_role_assignments (agent_id, role_id, assigned_by)
     VALUES ($1, $2, 'test')`,
    [agentId, roleId]
  );

const insertAgent = async () =>
  db.one<{ id: string }>(
    `INSERT INTO governance.agents (name, purpose, agent_type, owner)
     VALUES ('role-test-agent', 'testing roles', 'worker', 'team') RETURNING id`
  );

describe('role hierarchy resolution (effective_permissions)', () => {
  it('returns direct role permissions', async () => {
    const { id: agent_id } = await insertAgent();
    const { id: role_id } = await insertRole('direct-role');
    const { id: resource_id } = await insertResource();
    await grantPermission(role_id, resource_id, ['read']);
    await assignRole(agent_id, role_id);

    const perms = await db.any(
      `SELECT * FROM governance.effective_permissions($1)`,
      [agent_id]
    );
    expect(perms).toHaveLength(1);
    expect(perms[0].role_depth).toBe(0);
    expect(perms[0].actions).toContain('read');
  });

  it('resolves inherited permissions from parent role (depth=1)', async () => {
    const { id: agent_id } = await insertAgent();
    const { id: resource_id } = await insertResource();
    await insertRole('parent-role');
    const { id: parent_id } = await db.one<{ id: string }>(
      `SELECT id FROM governance.roles WHERE name = 'parent-role'`
    );
    await grantPermission(parent_id, resource_id, ['write']);
    const { id: child_id } = await insertRole('child-role', 'parent-role');
    await assignRole(agent_id, child_id);

    const perms = await db.any(
      `SELECT * FROM governance.effective_permissions($1)`,
      [agent_id]
    );
    expect(perms).toHaveLength(1);
    expect(perms[0].role_depth).toBe(1);
    expect(perms[0].actions).toContain('write');
  });

  it('resolves permissions through a 3-level role hierarchy', async () => {
    const { id: agent_id } = await insertAgent();
    const { id: resource_id } = await insertResource();

    await insertRole('grandparent-role');
    const { id: gp_id } = await db.one<{ id: string }>(
      `SELECT id FROM governance.roles WHERE name = 'grandparent-role'`
    );
    await grantPermission(gp_id, resource_id, ['admin']);

    await insertRole('parent-role-2', 'grandparent-role');
    await insertRole('child-role-2', 'parent-role-2');
    const { id: child_id } = await db.one<{ id: string }>(
      `SELECT id FROM governance.roles WHERE name = 'child-role-2'`
    );
    await assignRole(agent_id, child_id);

    const perms = await db.any(
      `SELECT * FROM governance.effective_permissions($1) ORDER BY role_depth`,
      [agent_id]
    );
    expect(perms.length).toBeGreaterThanOrEqual(1);
    expect(perms.some((p: { actions: string[] }) => p.actions.includes('admin'))).toBe(true);
  });

  it('excludes expired assignments', async () => {
    const { id: agent_id } = await insertAgent();
    const { id: role_id } = await insertRole('expired-role');
    const { id: resource_id } = await insertResource();
    await grantPermission(role_id, resource_id, ['read']);
    await db.any(
      `INSERT INTO governance.agent_role_assignments (agent_id, role_id, assigned_by, expires_at)
       VALUES ($1, $2, 'test', now() - interval '1 day')`,
      [agent_id, role_id]
    );

    const perms = await db.any(
      `SELECT * FROM governance.effective_permissions($1)`,
      [agent_id]
    );
    expect(perms).toHaveLength(0);
  });
});
