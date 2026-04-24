-- Verify schemas/governance/tables/agents/policies/enable_rls on pg

BEGIN;

SELECT verify_security('governance.agents');

ROLLBACK;
