-- Verify schemas/governance/functions/effective_permissions on pg

BEGIN;

SELECT verify_function('governance.effective_permissions');

ROLLBACK;
