-- Verify schemas/governance/views/sod_violations on pg

BEGIN;

SELECT verify_view('governance.sod_violations');

ROLLBACK;
