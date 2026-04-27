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

const insertResource = async (name: string) =>
  db.one<{ id: string }>(
    `INSERT INTO governance.resources (name, resource_type, supported_actions)
     VALUES ($1, 'database', ARRAY['read','write','delete']::governance.action_type[]) RETURNING id`,
    [name]
  );

const insertRole = async (name: string) =>
  db.one<{ id: string }>(
    `INSERT INTO governance.roles (name, is_built_in) VALUES ($1, false) RETURNING id`,
    [name]
  );

const insertAgent = async (name: string) =>
  db.one<{ id: string }>(
    `INSERT INTO governance.agents (name, purpose, agent_type, owner)
     VALUES ($1, 'testing', 'worker', 'team') RETURNING id`,
    [name]
  );

const grantRole = async (agentId: string, roleId: string, expiresAt?: string) =>
  db.any(
    `INSERT INTO governance.agent_role_assignments (agent_id, role_id, assigned_by, expires_at)
     VALUES ($1, $2, 'test', $3)`,
    [agentId, roleId, expiresAt ?? null]
  );

describe('permissions — grant/deny mechanics', () => {
  it('an allow permission appears in effective_permissions with grant_type = allow', async () => {
    const { id: resource_id } = await insertResource('allow-resource');
    const { id: role_id } = await insertRole('allow-role');
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions, grant_type)
       VALUES ($1, $2, ARRAY['read']::governance.action_type[], 'allow')`,
      [role_id, resource_id]
    );
    const { id: agent_id } = await insertAgent('allow-agent');
    await grantRole(agent_id, role_id);

    const perms = await db.any(
      `SELECT grant_type, actions FROM governance.effective_permissions($1)`,
      [agent_id]
    );
    expect(perms).toHaveLength(1);
    expect(perms[0].grant_type).toBe('allow');
    expect(perms[0].actions).toContain('read');
  });

  it('a deny permission on the same resource appears with grant_type = deny', async () => {
    const { id: resource_id } = await insertResource('deny-resource');
    const { id: role_id } = await insertRole('deny-role');
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions, grant_type)
       VALUES ($1, $2, ARRAY['delete']::governance.action_type[], 'deny')`,
      [role_id, resource_id]
    );
    const { id: agent_id } = await insertAgent('deny-agent');
    await grantRole(agent_id, role_id);

    const perms = await db.any(
      `SELECT grant_type FROM governance.effective_permissions($1)`,
      [agent_id]
    );
    expect(perms).toHaveLength(1);
    expect(perms[0].grant_type).toBe('deny');
  });

  it('an expired permission does not appear in effective_permissions', async () => {
    const { id: resource_id } = await insertResource('expired-perm-resource');
    const { id: role_id } = await insertRole('expired-perm-role');
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions, expires_at)
       VALUES ($1, $2, ARRAY['read']::governance.action_type[], now() - interval '1 hour')`,
      [role_id, resource_id]
    );
    const { id: agent_id } = await insertAgent('expired-perm-agent');
    await grantRole(agent_id, role_id);

    const perms = await db.any(
      `SELECT * FROM governance.effective_permissions($1)`,
      [agent_id]
    );
    expect(perms).toHaveLength(0);
  });

  it('a future-expiring permission is still active', async () => {
    const { id: resource_id } = await insertResource('future-exp-resource');
    const { id: role_id } = await insertRole('future-exp-role');
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions, expires_at)
       VALUES ($1, $2, ARRAY['read']::governance.action_type[], now() + interval '30 days')`,
      [role_id, resource_id]
    );
    const { id: agent_id } = await insertAgent('future-exp-agent');
    await grantRole(agent_id, role_id);

    const perms = await db.any(
      `SELECT * FROM governance.effective_permissions($1)`,
      [agent_id]
    );
    expect(perms).toHaveLength(1);
  });

  it('a permission with null tool_id applies to the resource regardless of tool path', async () => {
    const { id: resource_id } = await insertResource('notool-resource');
    const { id: role_id } = await insertRole('notool-role');
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, tool_id, actions)
       VALUES ($1, $2, NULL, ARRAY['read']::governance.action_type[])`,
      [role_id, resource_id]
    );
    const { id: agent_id } = await insertAgent('notool-agent');
    await grantRole(agent_id, role_id);

    const perms = await db.any(
      `SELECT tool_id, resource_id FROM governance.effective_permissions($1)`,
      [agent_id]
    );
    expect(perms).toHaveLength(1);
    expect(perms[0].tool_id).toBeNull();
    expect(perms[0].resource_id).toBe(resource_id);
  });

  it('a permission with a specific tool_id is scoped to that tool path', async () => {
    const { id: resource_id } = await insertResource('tool-scoped-resource');
    const { id: mcp_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.mcp_servers (name, endpoint_url, status)
       VALUES ('perm-test-mcp', 'http://localhost:9000', 'active') RETURNING id`
    );
    const { id: tool_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.tools (name, tool_type, mcp_server_id, is_idempotent)
       VALUES ('perm-test-tool', 'mcp_tool', $1, true) RETURNING id`,
      [mcp_id]
    );
    const { id: role_id } = await insertRole('tool-scoped-role');
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, tool_id, actions)
       VALUES ($1, $2, $3, ARRAY['execute']::governance.action_type[])`,
      [role_id, resource_id, tool_id]
    );
    const { id: agent_id } = await insertAgent('tool-scoped-agent');
    await grantRole(agent_id, role_id);

    const perms = await db.any(
      `SELECT tool_id, resource_id FROM governance.effective_permissions($1)`,
      [agent_id]
    );
    expect(perms).toHaveLength(1);
    expect(perms[0].tool_id).toBe(tool_id);
    expect(perms[0].resource_id).toBe(resource_id);
  });
});

describe('permissions — schema constraints', () => {
  it('rejects a permission with an empty actions array', async () => {
    const { id: resource_id } = await insertResource('empty-actions-resource');
    const { id: role_id } = await insertRole('empty-actions-role');

    await expect(
      db.any(
        `INSERT INTO governance.permissions (role_id, resource_id, actions)
         VALUES ($1, $2, ARRAY[]::governance.action_type[])`,
        [role_id, resource_id]
      )
    ).rejects.toThrow();
  });

  it('rejects a duplicate (role_id, resource_id, tool_id, grant_type) combination', async () => {
    const { id: resource_id } = await insertResource('dup-perm-resource');
    const { id: role_id } = await insertRole('dup-perm-role');

    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions)
       VALUES ($1, $2, ARRAY['read']::governance.action_type[])`,
      [role_id, resource_id]
    );

    await expect(
      db.any(
        `INSERT INTO governance.permissions (role_id, resource_id, actions)
         VALUES ($1, $2, ARRAY['write']::governance.action_type[])`,
        [role_id, resource_id]
      )
    ).rejects.toThrow();
  });

  it('allows an allow and a deny permission on the same role+resource', async () => {
    const { id: resource_id } = await insertResource('allow-deny-resource');
    const { id: role_id } = await insertRole('allow-deny-role');

    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions, grant_type)
       VALUES ($1, $2, ARRAY['read']::governance.action_type[], 'allow')`,
      [role_id, resource_id]
    );
    await expect(
      db.any(
        `INSERT INTO governance.permissions (role_id, resource_id, actions, grant_type)
         VALUES ($1, $2, ARRAY['read']::governance.action_type[], 'deny')`,
        [role_id, resource_id]
      )
    ).resolves.not.toThrow();
  });
});

describe('permissions — expiration via role assignment', () => {
  it('does not return permissions when the role assignment is expired', async () => {
    const { id: resource_id } = await insertResource('assignment-expired-resource');
    const { id: role_id } = await insertRole('assignment-expired-role');
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions)
       VALUES ($1, $2, ARRAY['read']::governance.action_type[])`,
      [role_id, resource_id]
    );
    const { id: agent_id } = await insertAgent('assignment-expired-agent');
    await grantRole(agent_id, role_id, new Date(Date.now() - 86400000).toISOString());

    const perms = await db.any(
      `SELECT * FROM governance.effective_permissions($1)`,
      [agent_id]
    );
    expect(perms).toHaveLength(0);
  });
});
