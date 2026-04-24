-- Verify schemas/governance_private/schema on pg

BEGIN;

SELECT verify_schema('governance_private');

ROLLBACK;
