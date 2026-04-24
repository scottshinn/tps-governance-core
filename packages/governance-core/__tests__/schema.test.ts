import { getConnections, PgTestClient } from 'pgsql-test';

let pg: PgTestClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  ({ pg, teardown } = await getConnections());
});

afterAll(async () => {
  await teardown();
});

describe('schema integrity', () => {
  it('governance schema exists', async () => {
    const { count } = await pg.one<{ count: string }>(
      `SELECT count(*)::text FROM information_schema.schemata WHERE schema_name = 'governance'`
    );
    expect(count).toBe('1');
  });

  it('governance_private schema exists', async () => {
    const { count } = await pg.one<{ count: string }>(
      `SELECT count(*)::text FROM information_schema.schemata WHERE schema_name = 'governance_private'`
    );
    expect(count).toBe('1');
  });

  it('all expected tables exist', async () => {
    const tables = await pg.any<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'governance'
       ORDER BY table_name`
    );
    const names = tables.map(t => t.table_name);
    expect(names).toContain('agents');
    expect(names).toContain('resources');
    expect(names).toContain('tools');
    expect(names).toContain('roles');
    expect(names).toContain('permissions');
    expect(names).toContain('agent_role_assignments');
    expect(names).toContain('resource_data_categories');
    expect(names).toContain('tool_resources');
    expect(names).toContain('compliance_frameworks');
    expect(names).toContain('compliance_requirements');
    expect(names).toContain('rules');
    expect(names).toContain('rule_sets');
    expect(names).toContain('rule_set_rules');
    expect(names).toContain('rule_compliance_reqs');
    expect(names).toContain('sod_constraints');
    expect(names).toContain('sod_constraint_permissions');
    expect(names).toContain('audit_log');
    expect(names).toContain('risk_assessments');
    expect(names).toContain('products');
    expect(names).toContain('mcp_servers');
  });

  it('all expected enum types exist', async () => {
    const types = await pg.any<{ typname: string }>(
      `SELECT typname FROM pg_type
       JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
       WHERE nspname = 'governance' AND typtype = 'e'
       ORDER BY typname`
    );
    const names = types.map(t => t.typname);
    expect(names).toContain('agent_lifecycle_state');
    expect(names).toContain('agent_type');
    expect(names).toContain('resource_type');
    expect(names).toContain('sensitivity_classification');
    expect(names).toContain('data_category');
    expect(names).toContain('action_type');
    expect(names).toContain('grant_type');
    expect(names).toContain('severity');
    expect(names).toContain('audit_action_type');
    expect(names).toContain('risk_level');
  });

  it('all governance intelligence functions exist', async () => {
    const fns = await pg.any<{ proname: string }>(
      `SELECT proname FROM pg_proc
       JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
       WHERE nspname = 'governance'
       ORDER BY proname`
    );
    const names = fns.map(f => f.proname);
    expect(names).toContain('effective_permissions');
    expect(names).toContain('sod_check');
    expect(names).toContain('blast_radius');
    expect(names).toContain('permission_overlap');
    expect(names).toContain('coverage_gaps');
  });

  it('audit trigger function exists in governance_private', async () => {
    const { count } = await pg.one<{ count: string }>(
      `SELECT count(*)::text FROM pg_proc
       JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
       WHERE nspname = 'governance_private' AND proname = 'tg_audit_log'`
    );
    expect(count).toBe('1');
  });
});
