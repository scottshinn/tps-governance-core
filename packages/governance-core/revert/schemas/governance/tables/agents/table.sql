-- Revert schemas/governance/tables/agents/table from pg

BEGIN;

DROP TABLE governance.agents;

COMMIT;
