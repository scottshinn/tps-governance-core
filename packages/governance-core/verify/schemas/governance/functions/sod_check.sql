-- Verify schemas/governance/functions/sod_check on pg

BEGIN;

SELECT verify_function('governance.sod_check');

ROLLBACK;
