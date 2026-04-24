-- Revert schemas/governance/tables/sod_constraint_permissions/table from pg

BEGIN;

DROP TABLE governance.sod_constraint_permissions;

COMMIT;
