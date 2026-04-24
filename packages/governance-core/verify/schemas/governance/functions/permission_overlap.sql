-- Verify schemas/governance/functions/permission_overlap on pg

BEGIN;

SELECT verify_function('governance.permission_overlap');

ROLLBACK;
