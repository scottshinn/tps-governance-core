-- Verify schemas/governance/views/ungoverned_resources on pg

BEGIN;

SELECT verify_view('governance.ungoverned_resources');

ROLLBACK;
