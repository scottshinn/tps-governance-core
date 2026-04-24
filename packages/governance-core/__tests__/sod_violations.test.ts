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

const setup = async () => {
  const { id: resource_id } = await db.one<{ id: string }>(
    `INSERT INTO governance.resources (name, resource_type, supported_actions)
     VALUES ('financial-db', 'database', ARRAY['read','write','delete','approve']::governance.action_type[]) RETURNING id`
  );

  const { id: role_initiator } = await db.one<{ id: string }>(
    `INSERT INTO governance.roles (name, is_built_in) VALUES ('initiator', false) RETURNING id`
  );
  const { id: role_approver } = await db.one<{ id: string }>(
    `INSERT INTO governance.roles (name, is_built_in) VALUES ('approver', false) RETURNING id`
  );

  const { id: perm_initiate } = await db.one<{ id: string }>(
    `INSERT INTO governance.permissions (role_id, resource_id, actions)
     VALUES ($1, $2, ARRAY['write']::governance.action_type[]) RETURNING id`,
    [role_initiator, resource_id]
  );
  const { id: perm_approve } = await db.one<{ id: string }>(
    `INSERT INTO governance.permissions (role_id, resource_id, actions)
     VALUES ($1, $2, ARRAY['approve']::governance.action_type[]) RETURNING id`,
    [role_approver, resource_id]
  );

  const { id: constraint_id } = await db.one<{ id: string }>(
    `INSERT INTO governance.sod_constraints (name, constraint_type, severity, is_active)
     VALUES ('initiate-approve', 'same_agent', 'critical', true) RETURNING id`
  );

  await db.any(
    `INSERT INTO governance.sod_constraint_permissions (constraint_id, permission_id, side) VALUES ($1, $2, 'a')`,
    [constraint_id, perm_initiate]
  );
  await db.any(
    `INSERT INTO governance.sod_constraint_permissions (constraint_id, permission_id, side) VALUES ($1, $2, 'b')`,
    [constraint_id, perm_approve]
  );

  const { id: agent_id } = await db.one<{ id: string }>(
    `INSERT INTO governance.agents (name, purpose, agent_type, owner)
     VALUES ('sod-test-agent', 'testing', 'worker', 'team') RETURNING id`
  );

  return { agent_id, role_initiator, role_approver, constraint_id };
};

describe('sod_check', () => {
  it('returns no violations when agent holds only one side', async () => {
    const { agent_id, role_initiator } = await setup();
    await db.any(
      `INSERT INTO governance.agent_role_assignments (agent_id, role_id, assigned_by)
       VALUES ($1, $2, 'test')`,
      [agent_id, role_initiator]
    );
    const violations = await db.any(
      `SELECT * FROM governance.sod_check($1)`,
      [agent_id]
    );
    expect(violations).toHaveLength(0);
  });

  it('returns violation when agent holds both sides', async () => {
    const { agent_id, role_initiator, role_approver } = await setup();
    await db.any(
      `INSERT INTO governance.agent_role_assignments (agent_id, role_id, assigned_by)
       VALUES ($1, $2, 'test')`,
      [agent_id, role_initiator]
    );
    await db.any(
      `INSERT INTO governance.agent_role_assignments (agent_id, role_id, assigned_by)
       VALUES ($1, $2, 'test')`,
      [agent_id, role_approver]
    );
    const violations = await db.any(
      `SELECT * FROM governance.sod_check($1)`,
      [agent_id]
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].constraint_name).toBe('initiate-approve');
    expect(violations[0].severity).toBe('critical');
    expect(violations[0].side_a_perm_ids).toBeDefined();
    expect(violations[0].side_b_perm_ids).toBeDefined();
  });

  it('sod_violations view shows violations for active agents', async () => {
    const { agent_id, role_initiator, role_approver } = await setup();
    await db.any(
      `UPDATE governance.agents SET lifecycle_state = 'active' WHERE id = $1`,
      [agent_id]
    );
    await db.any(
      `INSERT INTO governance.agent_role_assignments (agent_id, role_id, assigned_by) VALUES ($1, $2, 'test')`,
      [agent_id, role_initiator]
    );
    await db.any(
      `INSERT INTO governance.agent_role_assignments (agent_id, role_id, assigned_by) VALUES ($1, $2, 'test')`,
      [agent_id, role_approver]
    );
    const violations = await db.any(
      `SELECT * FROM governance.sod_violations WHERE agent_id = $1`,
      [agent_id]
    );
    expect(violations).toHaveLength(1);
  });
});
