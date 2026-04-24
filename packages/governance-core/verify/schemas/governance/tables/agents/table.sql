-- Verify schemas/governance/tables/agents/table on pg

BEGIN;

SELECT verify_table('governance.agents');

ROLLBACK;
