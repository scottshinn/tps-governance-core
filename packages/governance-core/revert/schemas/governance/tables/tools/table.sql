-- Revert schemas/governance/tables/tools/table from pg

BEGIN;

DROP TABLE governance.tools;

COMMIT;
