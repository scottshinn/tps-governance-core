-- Revert schemas/governance/views/sod_violations from pg

BEGIN;

DROP VIEW governance.sod_violations;

COMMIT;
