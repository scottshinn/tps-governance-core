-- Revert schemas/governance/tables/resources/table from pg

BEGIN;

DROP TABLE governance.resources;

COMMIT;
