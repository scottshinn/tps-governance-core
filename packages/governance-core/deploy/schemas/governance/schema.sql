-- Deploy schemas/governance/schema to pg

BEGIN;

CREATE SCHEMA IF NOT EXISTS governance;

COMMENT ON SCHEMA governance IS 'TPS — Tool Permission System. Governance data layer for AI agent permissions, access control, and compliance management.';

GRANT USAGE ON SCHEMA governance TO authenticated, anonymous;

ALTER DEFAULT PRIVILEGES IN SCHEMA governance
  GRANT EXECUTE ON FUNCTIONS TO authenticated;

COMMIT;
