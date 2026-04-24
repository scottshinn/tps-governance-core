-- Revert schemas/governance/tables/permissions/table from pg

BEGIN;

DROP TABLE governance.permissions;

COMMIT;
