# pgpm Conventions for TPS governance-core

This document captures the patterns learned from the `pgpm-modules` reference repository and the pgpm CLI documentation. Every developer working on this module must read this before writing any SQL.

## What Is pgpm?

pgpm is a PostgreSQL package manager modeled on npm/Sqitch concepts. It manages database schema changes as versioned, reversible, verifiable triplets. Each change has three SQL files: deploy (apply it), verify (prove it worked), revert (undo it). The `pgpm.plan` file declares the full migration graph with dependencies.

---

## Module File Layout

```
packages/<module-name>/
  deploy/             # SQL files that apply changes
  verify/             # SQL files that prove changes applied
  revert/             # SQL files that undo changes
  seed/               # Reference data (not in pgpm.plan, applied separately)
  __tests__/          # TypeScript tests using pgsql-test
  pgpm.plan           # Migration graph
  <name>.control      # Module metadata and dependencies
  package.json        # npm package
  jest.config.js      # Test configuration
  Makefile            # (Optional) convenience commands
```

The directory structure inside `deploy/`, `verify/`, and `revert/` **must be identical**. Every `deploy/path/to/thing.sql` must have a corresponding `verify/path/to/thing.sql` and `revert/path/to/thing.sql`.

---

## Path Conventions

The file path inside `deploy/` determines the plan entry path. The path encodes the schema, object type, and name in a hierarchical structure:

| Object Type | Path Pattern | Example |
|---|---|---|
| Schema | `schemas/<schema>/schema.sql` | `schemas/governance/schema.sql` |
| Enum type | `schemas/<schema>/types/<name>.sql` | `schemas/governance/types/enums.sql` |
| Table | `schemas/<schema>/tables/<name>/table.sql` | `schemas/governance/tables/agents/table.sql` |
| Table trigger | `schemas/<schema>/tables/<name>/triggers/<tg>.sql` | `schemas/.../tables/agents/triggers/audit_tg.sql` |
| Table index | `schemas/<schema>/tables/<name>/indexes/<idx>.sql` | `schemas/.../tables/agents/indexes/lifecycle_idx.sql` |
| Table policy | `schemas/<schema>/tables/<name>/policies/<name>.sql` | `schemas/.../tables/agents/policies/enable_rls.sql` |
| Schema-level trigger function | `schemas/<schema>/triggers/<name>.sql` | `schemas/app_jobs/triggers/tg_update_timestamps.sql` |
| Function/procedure | `schemas/<schema>/functions/<name>.sql` | `schemas/governance/functions/effective_permissions.sql` |
| View | `schemas/<schema>/views/<name>.sql` | `schemas/governance/views/agent_summary.sql` |
| Schema-level index | `schemas/<schema>/indexes/<name>.sql` | `schemas/governance/indexes/performance_indexes.sql` |
| Grant | `schemas/<schema>/tables/<name>/grants/<name>.sql` | `schemas/.../tables/agents/grants/grant_select.sql` |

The plan entry path is the file path without the `deploy/` prefix and without the `.sql` extension.

---

## The Deploy/Verify/Revert Triplet

### Deploy File Format

```sql
-- Deploy schemas/governance/tables/agents/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums

BEGIN;

CREATE TABLE governance.agents (
  ...
);

COMMIT;
```

Rules:
- First line is the comment: `-- Deploy <path> to pg`
- Dependencies are declared as `-- requires: <path>` comments (these are for documentation; the actual dependency order comes from `pgpm.plan`)
- Wrap in `BEGIN; ... COMMIT;`

### Verify File Format

```sql
-- Verify schemas/governance/tables/agents/table on pg

BEGIN;

SELECT verify_table('governance.agents');

ROLLBACK;
```

Rules:
- First line: `-- Verify <path> on pg`
- Use `ROLLBACK` (not `COMMIT`) — verify scripts must not change state
- Use the `pgpm-verify` helper functions (see below)

### Revert File Format

```sql
-- Revert schemas/governance/tables/agents/table from pg

BEGIN;

DROP TABLE governance.agents;

COMMIT;
```

Rules:
- First line: `-- Revert <path> from pg`
- Must exactly undo what deploy did — no more, no less
- Use `CASCADE` with caution; prefer `RESTRICT` or explicit dependency ordering

---

## Verify Helper Functions

These are provided by the `pgpm-verify` package (`public.verify_*`):

| Function | Usage |
|---|---|
| `verify_schema('schema_name')` | Schema exists |
| `verify_table('schema.table')` | Table exists |
| `verify_function('schema.function')` | Function exists |
| `verify_view('schema.view')` | View exists |
| `verify_trigger('schema.trigger')` | Trigger exists |
| `verify_index('schema.table', 'index_name')` | Index exists on table |
| `verify_type('schema.type_name')` | Type (enum, domain, composite) exists |
| `verify_policy('policy_name', 'schema.table')` | RLS policy exists on table |
| `verify_security('schema.table')` | RLS is enabled on table |
| `verify_domain('schema.domain')` | Domain type exists |
| `verify_role('role_name')` | Database role exists |
| `verify_constraint('constraint_name', 'schema.table')` | Constraint exists |
| `verify_extension('extension_name')` | PostgreSQL extension is installed |

All these functions raise an exception (causing the verify script to fail) if the object doesn't exist.

---

## The pgpm.plan File

### Header

```
%syntax-version=1.0.0
%project=governance-core
%uri=governance-core
```

### Entry Format

```
<path> [<dep1> <dep2> ...] <timestamp> <author> <<email>> # <comment>
```

Example:
```
schemas/governance/tables/agents/table [schemas/governance/schema schemas/governance/types/enums schemas/governance/tables/products/table] 2026-04-23T00:00:00Z Scott Shinn <sshinn@gmail.com> # add agents table
```

Rules:
- `<path>` = the plan entry path (no `deploy/` prefix, no `.sql`)
- Dependencies in `[...]` are space-separated plan entry paths
- Dependencies from other modules use `<module-name>:<path>` (e.g., `pgpm-jwt-claims:schemas/jwt_public/procedures/current_user_id`)
- Timestamp is ISO 8601 UTC
- Comment after `#` is a brief description of the change
- Entries are processed in dependency order — pgpm resolves the DAG

### Dependency Rules

1. Schema must be declared before anything in that schema
2. Tables must be declared before functions, views, or triggers that reference them
3. Trigger functions must be declared before the trigger attachment entries
4. Policies/RLS enable must be two separate entries (enable, then create policies)
5. Indexes that span multiple tables should depend on all referenced tables
6. Junction tables depend on both referenced tables

---

## The `.control` File

Controls module metadata and declares extension dependencies (pgpm resolves these):

```
# governance-core extension
comment = 'governance-core extension'
default_version = '0.0.1'
module_pathname = '$libdir/governance-core'
requires = 'pgcrypto,uuid-ossp,citext,pg_trgm,btree_gist,plpgsql'
relocatable = false
superuser = false
```

The `requires` field is a comma-separated list of PostgreSQL extension names OR other pgpm module names. pgpm resolves module dependencies recursively.

---

## SQL Style Conventions

Learned from pgpm-modules source:

### Types

| Data | Type |
|---|---|
| Primary keys | `uuid DEFAULT gen_random_uuid()` (or `uuidv7()` if the module provides it) |
| Timestamps | `timestamptz NOT NULL DEFAULT now()` |
| Text strings | `text` (not `varchar(n)` unless there's a specific length reason) |
| Flexible metadata | `jsonb` |
| Fixed taxonomies | `CREATE TYPE schema.name AS ENUM (...)` |
| Boolean flags | `boolean NOT NULL DEFAULT false` |
| Arrays | `type[]` with GIN index when queried with `@>` or `= ANY()` |

### Naming

- Tables: `snake_case`, plural (`agents`, `agent_role_assignments`)
- Columns: `snake_case`
- Indexes: `idx_<table>_<column(s)>` (e.g., `idx_agents_lifecycle_state`)
- Constraints: `uq_<table>_<columns>`, `fk_<table>_<ref>`, `chk_<table>_<description>`
- Triggers: `tg_<purpose>_<table>` (e.g., `tg_audit_agents`)
- Trigger functions: `schema_private.tg_<function_name>()` (prefix with `tg_`)
- Views: descriptive noun phrases (`agent_summary`, `resource_exposure`)

### Comments

Every table and non-obvious column must have `COMMENT ON TABLE` and `COMMENT ON COLUMN`. Functions must have `COMMENT ON FUNCTION`.

### Grants

Schema-level:
```sql
GRANT USAGE ON SCHEMA governance TO authenticated, anonymous;
ALTER DEFAULT PRIVILEGES IN SCHEMA governance GRANT EXECUTE ON FUNCTIONS TO authenticated;
```

Table-level grants go in the policy files (if RLS is used) or a separate `grants/` directory entry.

### Partial Indexes

Use `WHERE` clauses to create partial indexes for hot paths:
```sql
CREATE INDEX idx_agent_role_assignments_active_live
  ON governance.agent_role_assignments (agent_id, role_id)
  WHERE status = 'active' AND expires_at IS NULL;
```

---

## Schema Split: public vs private

Follow the pgpm-modules pattern of splitting schemas by exposure level:

- `governance` — public API: tables, public functions, views
- `governance_private` — internal implementation: trigger functions, helper procedures not meant for external callers

The private schema is created after the public schema (dependency in pgpm.plan). Functions in `governance_private` are `SECURITY DEFINER` when they need elevated privileges (e.g., writing to tables with RLS that would block the caller).

---

## Testing with pgsql-test

### Test Harness Pattern

```typescript
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
  await db.beforeEach();  // starts a savepoint
});

afterEach(async () => {
  await db.afterEach();   // rolls back to savepoint (test isolation)
});
```

### Two Connection Pattern

- `pg` — superuser/privileged connection for setup
- `db` — application-level connection for testing RLS and normal access paths

### Key Methods

| Method | Purpose |
|---|---|
| `pg.one<T>(sql, params)` | Execute query, expect exactly one row |
| `pg.any<T>(sql, params)` | Execute query, expect zero or more rows |
| `db.beforeEach()` | Open savepoint for per-test isolation |
| `db.afterEach()` | Roll back to savepoint |
| `pg.setContext({...})` | Set session variables (JWT claims, custom vars) |
| `snapshot(obj)` | Serialize for Jest snapshot comparison |

### jest.config.js

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  maxWorkers: 1,  // CRITICAL: database tests must be serial
  testMatch: ['**/?(*.)+(test|spec).{ts,tsx,js,jsx}'],
  testPathIgnorePatterns: ['/dist/', '\\.d\\.ts$'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
```

`maxWorkers: 1` is **required** for database integration tests. Parallel test workers will corrupt each other's database state.

### Test Environment

pgsql-test expects these environment variables (typically set via `eval "$(pgpm env)"`):
- `PGHOST` — database host
- `PGPORT` — database port
- `PGDATABASE` — target database name
- `PGUSER` — database user
- `PGPASSWORD` — database password

---

## CLI Workflow

```bash
# Start local Postgres
pgpm docker start
eval "$(pgpm env)"

# Deploy the full module (creates db if needed)
pgpm deploy --createdb --database governance_dev

# Run verify scripts
pgpm verify --database governance_dev

# Add a new change
pgpm add schemas/governance/tables/new_table/table

# Revert the last change
pgpm revert --database governance_dev

# Run tests
cd packages/governance-core
pnpm test
```

The `pgpm add <path>` command creates the deploy/verify/revert file triplet and adds the entry to pgpm.plan. The timestamp and author are populated automatically.

---

## Cross-Module Dependencies

When depending on another pgpm module (e.g., `@pgpm/verify`), declare it in:
1. The `.control` file `requires` field
2. The pgpm.plan entries that use it: `[pgpm-verify:@0.1.0]` or `[pgpm-verify:schemas/verify_schema/procedures/verify]`
3. `package.json` `dependencies` (for npm resolution)

The pgpm CLI resolves cross-module paths by installing the package and reading its plan.
