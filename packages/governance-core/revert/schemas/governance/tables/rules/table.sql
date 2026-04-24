-- Revert schemas/governance/tables/rules/table from pg

BEGIN;

DROP TABLE governance.rules;

COMMIT;
