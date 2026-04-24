-- Deploy schemas/governance_private/schema to pg

-- requires: schemas/governance/schema

BEGIN;

CREATE SCHEMA IF NOT EXISTS governance_private;

COMMENT ON SCHEMA governance_private IS 'Internal implementation functions for the governance schema — not exposed to application code.';

COMMIT;
