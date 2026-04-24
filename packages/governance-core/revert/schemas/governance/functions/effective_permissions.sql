-- Revert schemas/governance/functions/effective_permissions from pg

BEGIN;

DROP FUNCTION governance.effective_permissions;

COMMIT;
