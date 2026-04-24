-- Revert schemas/governance/schema from pg

BEGIN;

DROP SCHEMA governance CASCADE;

COMMIT;
