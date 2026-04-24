-- Revert schemas/governance_private/schema from pg

BEGIN;

DROP SCHEMA governance_private CASCADE;

COMMIT;
