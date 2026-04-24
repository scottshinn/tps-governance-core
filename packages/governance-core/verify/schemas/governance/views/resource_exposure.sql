-- Verify schemas/governance/views/resource_exposure on pg

BEGIN;

SELECT verify_view('governance.resource_exposure');

ROLLBACK;
