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
             ARRAY['read','write']::governance.action_type[]) RETURNING id`,
    [name, sensitivity]
  );

const attachActivePermission = async (resourceId: string) => {
  const { id: role_id } = await db.one<{ id: string }>(
    `INSERT INTO governance.roles (name, is_built_in) VALUES (gen_random_uuid()::text, false) RETURNING id`
  );
  await db.any(
    `INSERT INTO governance.permissions (role_id, resource_id, actions)
     VALUES ($1, $2, ARRAY['read']::governance.action_type[])`,
    [role_id, resourceId]
  );
};

const attachActiveRule = async (resourceId: string) => {
  await db.any(
    `INSERT INTO governance.rules (name, rule_type, condition, scope, scope_entity_id, status)
     VALUES (gen_random_uuid()::text, 'access_control',
             '{"type":"test_rule"}'::jsonb, 'resource', $1, 'active')`,
    [resourceId]
  );
};

describe('coverage_gaps', () => {
  it('returns a resource that has no permissions and no rules', async () => {
    const { id: resource_id } = await insertResource('ungoverned-resource');

    const rows = await db.any(`SELECT * FROM governance.coverage_gaps()`);
    const found = rows.find((r: { resource_id: string }) => r.resource_id === resource_id);
    expect(found).toBeDefined();
    expect(found.has_permission).toBe(false);
    expect(found.has_rule).toBe(false);
  });

  it('returns a resource with an active permission but no rule', async () => {
    const { id: resource_id } = await insertResource('no-rule-resource');
    await attachActivePermission(resource_id);

    const rows = await db.any(`SELECT * FROM governance.coverage_gaps()`);
    const found = rows.find((r: { resource_id: string }) => r.resource_id === resource_id);
    expect(found).toBeDefined();
    expect(found.has_permission).toBe(true);
    expect(found.has_rule).toBe(false);
  });

  it('returns a resource with an active rule but no permission', async () => {
    const { id: resource_id } = await insertResource('no-permission-resource');
    await attachActiveRule(resource_id);

    const rows = await db.any(`SELECT * FROM governance.coverage_gaps()`);
    const found = rows.find((r: { resource_id: string }) => r.resource_id === resource_id);
    expect(found).toBeDefined();
    expect(found.has_permission).toBe(false);
    expect(found.has_rule).toBe(true);
  });

  it('does not return a resource that has both an active permission and an active rule', async () => {
    const { id: resource_id } = await insertResource('fully-governed-resource');
    await attachActivePermission(resource_id);
    await attachActiveRule(resource_id);

    const rows = await db.any(`SELECT * FROM governance.coverage_gaps()`);
    const found = rows.find((r: { resource_id: string }) => r.resource_id === resource_id);
    expect(found).toBeUndefined();
  });

  it('does not count a disabled rule as coverage', async () => {
    const { id: resource_id } = await insertResource('disabled-rule-resource');
    await attachActivePermission(resource_id);
    // Insert a disabled (not active) rule — should not count
    await db.any(
      `INSERT INTO governance.rules (name, rule_type, condition, scope, scope_entity_id, status)
       VALUES (gen_random_uuid()::text, 'access_control',
               '{"type":"test_rule"}'::jsonb, 'resource', $1, 'disabled')`,
      [resource_id]
    );

    const rows = await db.any(`SELECT * FROM governance.coverage_gaps()`);
    const found = rows.find((r: { resource_id: string }) => r.resource_id === resource_id);
    expect(found).toBeDefined();
    expect(found.has_rule).toBe(false);
  });

  it('does not count an expired permission as coverage', async () => {
    const { id: resource_id } = await insertResource('expired-perm-resource');
    const { id: role_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.roles (name, is_built_in) VALUES ('exp-perm-role', false) RETURNING id`
    );
    await db.any(
      `INSERT INTO governance.permissions (role_id, resource_id, actions, expires_at)
       VALUES ($1, $2, ARRAY['read']::governance.action_type[], now() - interval '1 day')`,
      [role_id, resource_id]
    );
    await attachActiveRule(resource_id);

    const rows = await db.any(`SELECT * FROM governance.coverage_gaps()`);
    const found = rows.find((r: { resource_id: string }) => r.resource_id === resource_id);
    expect(found).toBeDefined();
    expect(found.has_permission).toBe(false);
  });

  it('orders results by sensitivity descending', async () => {
    const { id: critical_id } = await insertResource('critical-ungov', 'critical');
    const { id: public_id } = await insertResource('public-ungov', 'public');

    const rows = await db.any(`SELECT * FROM governance.coverage_gaps()`);
    const criticalIdx = rows.findIndex((r: { resource_id: string }) => r.resource_id === critical_id);
    const publicIdx = rows.findIndex((r: { resource_id: string }) => r.resource_id === public_id);
    expect(criticalIdx).toBeGreaterThanOrEqual(0);
    expect(publicIdx).toBeGreaterThanOrEqual(0);
    expect(criticalIdx).toBeLessThan(publicIdx);
  });

  it('ungoverned_resources view mirrors coverage_gaps()', async () => {
    const { id: resource_id } = await insertResource('mirror-test-resource');

    const fromFn = await db.any(`SELECT * FROM governance.coverage_gaps() WHERE resource_id = $1`, [resource_id]);
    const fromView = await db.any(`SELECT * FROM governance.ungoverned_resources WHERE resource_id = $1`, [resource_id]);

    expect(fromView).toHaveLength(fromFn.length);
    if (fromFn.length > 0) {
      expect(fromView[0].resource_id).toBe(fromFn[0].resource_id);
      expect(fromView[0].has_permission).toBe(fromFn[0].has_permission);
    }
  });
});
