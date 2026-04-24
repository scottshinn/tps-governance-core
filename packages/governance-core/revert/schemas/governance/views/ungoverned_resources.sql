-- Revert schemas/governance/views/ungoverned_resources from pg

BEGIN;

DROP VIEW governance.ungoverned_resources;

COMMIT;
