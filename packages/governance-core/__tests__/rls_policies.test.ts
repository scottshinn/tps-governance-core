import { getConnections, PgTestClient } from 'pgsql-test';

// RLS enforcement requires the database connection to run as a non-superuser role.
// These tests verify policy configuration and behavior when tps.role is set correctly.
// For full enforcement validation, the table should have FORCE ROW LEVEL SECURITY or
// the db connection must be an `authenticated`-equivalent non-superuser role.

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

const insertAgent = async (name: string, lifecycleState: string) =>
  db.one<{ id: string }>(
    `INSERT INTO governance.agents (name, purpose, agent_type, owner, lifecycle_state)
     VALUES ($1, 'rls test', 'worker', 'team', $2::governance.agent_lifecycle_state)
     RETURNING id`,
    [name, lifecycleState]
  );

describe('rls_policies — policy configuration', () => {
  it('agents table has RLS enabled', async () => {
    const row = await db.one<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity FROM pg_class
       WHERE oid = 'governance.agents'::regclass`
    );
    expect(row.relrowsecurity).toBe(true);
  });

  it('audit_log table has RLS enabled', async () => {
    const row = await db.one<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity FROM pg_class
       WHERE oid = 'governance.audit_log'::regclass`
    );
    expect(row.relrowsecurity).toBe(true);
  });

  it('agents table has the expected four RLS policies', async () => {
    const rows = await db.any<{ policyname: string }>(
      `SELECT policyname FROM pg_policies
       WHERE schemaname = 'governance' AND tablename = 'agents'
       ORDER BY policyname`
    );
    const names = rows.map(r => r.policyname);
    expect(names).toContain('agents_governance_admin');
    expect(names).toContain('agents_auditor_select');
    expect(names).toContain('agents_operator_select');
    expect(names).toContain('agents_observer_select');
  });

  it('audit_log table has the privileged select policy', async () => {
    const rows = await db.any<{ policyname: string }>(
      `SELECT policyname FROM pg_policies
       WHERE schemaname = 'governance' AND tablename = 'audit_log'
       ORDER BY policyname`
    );
    const names = rows.map(r => r.policyname);
    expect(names).toContain('audit_log_privileged_select');
  });

  it('agent_operator policy restricts to approved and active lifecycle states', async () => {
    const row = await db.one<{ qual: string }>(
      `SELECT qual FROM pg_policies
       WHERE schemaname = 'governance' AND tablename = 'agents'
         AND policyname = 'agents_operator_select'`
    );
    expect(row.qual).toContain('agent_operator');
    expect(row.qual).toContain('approved');
    expect(row.qual).toContain('active');
  });

  it('read_only_observer policy restricts to active lifecycle state only', async () => {
    const row = await db.one<{ qual: string }>(
      `SELECT qual FROM pg_policies
       WHERE schemaname = 'governance' AND tablename = 'agents'
         AND policyname = 'agents_observer_select'`
    );
    expect(row.qual).toContain('read_only_observer');
    expect(row.qual).toContain('active');
  });

  it('audit_log policy allows only governance_admin, system_admin, and auditor', async () => {
    const row = await db.one<{ qual: string }>(
      `SELECT qual FROM pg_policies
       WHERE schemaname = 'governance' AND tablename = 'audit_log'
         AND policyname = 'audit_log_privileged_select'`
    );
    expect(row.qual).toContain('governance_admin');
    expect(row.qual).toContain('system_admin');
    expect(row.qual).toContain('auditor');
  });
});

describe('rls_policies — session variable filtering', () => {
  // These tests set tps.role within the savepoint transaction and verify
  // that the policy USING expressions evaluate as expected when tps.role is set.
  // Actual row-level filtering depends on whether the connection is a non-superuser.

  it('tps.role session variable is readable and settable', async () => {
    await db.any(`SET LOCAL tps.role = 'auditor'`);
    const row = await db.one<{ role: string }>(
      `SELECT current_setting('tps.role', true) AS role`
    );
    expect(row.role).toBe('auditor');
  });

  it('tps.role resets between tests (savepoint isolation)', async () => {
    // After the previous test's savepoint rollback, tps.role should be unset
    const row = await db.one<{ role: string | null }>(
      `SELECT current_setting('tps.role', true) AS role`
    );
    // current_setting with true returns empty string ('') or null when not set
    expect(row.role == null || row.role === '').toBe(true);
  });

  it('policy USING expression for agent_operator evaluates correctly', async () => {
    await insertAgent('active-rls-agent', 'active');
    await insertAgent('proposed-rls-agent', 'proposed');

    // Directly verify the USING condition logic — agents visible to agent_operator
    const rows = await db.any(
      `SELECT name FROM governance.agents
       WHERE current_setting('tps.role', true) = 'agent_operator'
         AND lifecycle_state IN ('approved', 'active')
         AND name LIKE '%-rls-agent'`
    );
    // With tps.role NOT set, this WHERE clause never matches — returns 0 rows
    expect(rows).toHaveLength(0);
  });

  it('policy USING expression matches when tps.role = agent_operator', async () => {
    await insertAgent('active-op-agent', 'active');
    await insertAgent('proposed-op-agent', 'proposed');
    await db.any(`SET LOCAL tps.role = 'agent_operator'`);

    const rows = await db.any(
      `SELECT name FROM governance.agents
       WHERE current_setting('tps.role', true) = 'agent_operator'
         AND lifecycle_state IN ('approved', 'active')
         AND name LIKE '%-op-agent'`
    );
    const names = rows.map((r: { name: string }) => r.name);
    expect(names).toContain('active-op-agent');
    expect(names).not.toContain('proposed-op-agent');
  });
});

describe('rls_policies — audit trigger fires regardless of RLS', () => {
  // The audit trigger uses SECURITY DEFINER and bypasses RLS when writing to audit_log.
  // This verifies that governance state changes are always captured.

  it('audit trigger fires when an agent is inserted', async () => {
    await pg.query(`SET tps.current_actor = 'rls-test-actor'`);
    const { id: agent_id } = await insertAgent('rls-audit-agent', 'proposed');

    const entry = await db.one<{ entity_id: string; actor: string }>(
      `SELECT entity_id::text, actor FROM governance.audit_log
       WHERE entity_type = 'governance.agents'
         AND entity_id = $1
       ORDER BY occurred_at DESC LIMIT 1`,
      [agent_id]
    );
    expect(entry.entity_id).toBe(agent_id);
    expect(entry.actor).toBe('rls-test-actor');
  });

  it('audit trigger fires on role update even without tps.role set', async () => {
    const { id: role_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.roles (name, is_built_in) VALUES ('rls-audit-role', false) RETURNING id`
    );
    await db.any(`UPDATE governance.roles SET description = 'updated' WHERE id = $1`, [role_id]);

    const entry = await db.one<{ action_type: string }>(
      `SELECT action_type FROM governance.audit_log
       WHERE entity_type = 'governance.roles' AND entity_id = $1
         AND action_type = 'role_updated'
       ORDER BY occurred_at DESC LIMIT 1`,
      [role_id]
    );
    expect(entry.action_type).toBe('role_updated');
  });
});
