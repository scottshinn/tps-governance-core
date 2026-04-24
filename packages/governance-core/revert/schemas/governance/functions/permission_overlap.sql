-- Revert schemas/governance/functions/permission_overlap from pg

BEGIN;

DROP FUNCTION governance.permission_overlap;

COMMIT;
