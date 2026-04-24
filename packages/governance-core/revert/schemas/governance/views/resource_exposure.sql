-- Revert schemas/governance/views/resource_exposure from pg

BEGIN;

DROP VIEW governance.resource_exposure;

COMMIT;
