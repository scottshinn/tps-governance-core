-- Revert schemas/governance/tables/roles/table from pg

BEGIN;

DROP TABLE governance.roles;

COMMIT;
