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

const insertProduct = async (name = 'Test Product') =>
  db.one<{ id: string }>(
    `INSERT INTO governance.products (name, owner) VALUES ($1, 'test-team') RETURNING id`,
    [name]
  );

const insertAgent = async (overrides: Record<string, unknown> = {}) => {
  const { id: product_id } = await insertProduct();
  return db.one<{ id: string }>(
    `INSERT INTO governance.agents (name, purpose, agent_type, product_id, owner)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      overrides.name ?? 'test-agent',
      overrides.purpose ?? 'Runs automated governance checks',
      overrides.agent_type ?? 'worker',
      product_id,
      overrides.owner ?? 'platform-team',
    ]
  );
};

describe('agents', () => {
  it('inserts with default lifecycle_state of proposed', async () => {
    const { id } = await insertAgent();
    const agent = await db.one(
      `SELECT lifecycle_state FROM governance.agents WHERE id = $1`,
      [id]
    );
    expect(agent.lifecycle_state).toBe('proposed');
  });

  it('enforces unique name+version constraint', async () => {
    await insertAgent({ name: 'duplicate-agent' });
    await expect(insertAgent({ name: 'duplicate-agent' })).rejects.toThrow();
  });

  it('allows self-referential parent_agent_id for orchestrator trees', async () => {
    const { id: parent_id } = await insertAgent({ name: 'orchestrator', agent_type: 'orchestrator' });
    const { id: child_id } = await db.one<{ id: string }>(
      `INSERT INTO governance.agents (name, purpose, agent_type, owner, parent_agent_id)
       VALUES ('worker-1', 'does work', 'worker', 'team', $1) RETURNING id`,
      [parent_id]
    );
    const { parent_agent_id } = await db.one(
      `SELECT parent_agent_id FROM governance.agents WHERE id = $1`,
      [child_id]
    );
    expect(parent_agent_id).toBe(parent_id);
  });

  it('prevents deletion of a product that has agents (ON DELETE RESTRICT)', async () => {
    await insertAgent();
    const agents = await db.any(`SELECT product_id FROM governance.agents LIMIT 1`);
    const product_id = agents[0].product_id;
    await expect(
      db.any(`DELETE FROM governance.products WHERE id = $1`, [product_id])
    ).rejects.toThrow();
  });
});
