-- Revert schemas/governance/functions/sod_check from pg

BEGIN;

DROP FUNCTION governance.sod_check;

COMMIT;
