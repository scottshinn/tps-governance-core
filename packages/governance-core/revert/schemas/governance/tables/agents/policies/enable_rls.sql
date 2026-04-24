-- Revert schemas/governance/tables/agents/policies/enable_rls from pg

BEGIN;

ALTER TABLE governance.agents DISABLE ROW LEVEL SECURITY;

COMMIT;
