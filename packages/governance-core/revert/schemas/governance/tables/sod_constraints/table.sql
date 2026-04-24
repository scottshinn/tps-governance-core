-- Revert schemas/governance/tables/sod_constraints/table from pg

BEGIN;

DROP TABLE governance.sod_constraints;

COMMIT;
