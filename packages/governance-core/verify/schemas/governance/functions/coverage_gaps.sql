-- Verify schemas/governance/functions/coverage_gaps on pg

BEGIN;

SELECT verify_function('governance.coverage_gaps');

ROLLBACK;
