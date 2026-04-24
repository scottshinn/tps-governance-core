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
  await pg.query(`SET tps.current_actor = 'test-user'`);
});

afterEach(async () => {
  await db.afterEach();
});

describe('audit trail', () => {
  it('creates an audit_log entry on agent INSERT', async () => {
    await db.any(
      `INSERT INTO governance.agents (name, purpose, agent_type, owner)
       VALUES ('audit-test-agent', 'testing audit', 'worker', 'team')`
    );
    const entry = await db.one<{
      action_type: string;
      entity_type: string;
      new_state: Record<string, unknown>;
    }>(
      `SELECT action_type, entity_type, new_state
       FROM governance.audit_log
       WHERE entity_type = 'governance.agents'
       ORDER BY occurred_at DESC LIMIT 1`
    );
    expect(entry.action_type).toBe('agent_registered');
    expect(entry.entity_type).toBe('governance.agents');
    expect(entry.new_state).toHaveProperty('name', 'audit-test-agent');
  });

  it('captures previous_state and new_state on UPDATE', async () => {
    await db.any(
      `INSERT INTO governance.agents (name, purpose, agent_type, owner)
       VALUES ('update-audit-agent', 'testing', 'worker', 'team')`
    );
    await db.any(
      `UPDATE governance.agents SET lifecycle_state = 'under_review' WHERE name = 'update-audit-agent'`
    );
    const entry = await db.one<{
      action_type: string;
      previous_state: Record<string, unknown>;
      new_state: Record<string, unknown>;
    }>(
      `SELECT action_type, previous_state, new_state
       FROM governance.audit_log
       WHERE entity_type = 'governance.agents' AND action_type = 'agent_updated'
       ORDER BY occurred_at DESC LIMIT 1`
    );
    expect(entry.action_type).toBe('agent_updated');
    expect(entry.previous_state).toHaveProperty('lifecycle_state', 'proposed');
    expect(entry.new_state).toHaveProperty('lifecycle_state', 'under_review');
  });

  it('captures DELETE event with previous_state only', async () => {
    await db.any(
      `INSERT INTO governance.roles (name, description, is_built_in) VALUES ('temp-role', 'deletable', false)`
    );
    await db.any(`DELETE FROM governance.roles WHERE name = 'temp-role'`);
    const entry = await db.one<{
      action_type: string;
      previous_state: Record<string, unknown>;
      new_state: unknown;
    }>(
      `SELECT action_type, previous_state, new_state
       FROM governance.audit_log
       WHERE entity_type = 'governance.roles' AND action_type = 'role_deleted'
       ORDER BY occurred_at DESC LIMIT 1`
    );
    expect(entry.action_type).toBe('role_deleted');
    expect(entry.previous_state).toHaveProperty('name', 'temp-role');
    expect(entry.new_state).toBeNull();
  });

  it('records the actor from tps.current_actor session variable', async () => {
    await pg.query(`SET tps.current_actor = 'alice@example.com'`);
    await db.any(
      `INSERT INTO governance.roles (name, is_built_in) VALUES ('actor-test-role', false)`
    );
    const entry = await db.one<{ actor: string }>(
      `SELECT actor FROM governance.audit_log
       WHERE entity_type = 'governance.roles' AND action_type = 'role_created'
       ORDER BY occurred_at DESC LIMIT 1`
    );
    expect(entry.actor).toBe('alice@example.com');
  });
});
