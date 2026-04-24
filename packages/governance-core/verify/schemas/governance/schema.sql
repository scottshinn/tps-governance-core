-- Verify schemas/governance/schema on pg

BEGIN;

SELECT verify_schema('governance');

ROLLBACK;
