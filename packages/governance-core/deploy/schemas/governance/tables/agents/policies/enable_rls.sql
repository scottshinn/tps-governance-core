-- Deploy schemas/governance/tables/agents/policies/enable_rls to pg

-- requires: schemas/governance/tables/agents/table

BEGIN;

ALTER TABLE governance.agents ENABLE ROW LEVEL SECURITY;

COMMIT;
