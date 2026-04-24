-- Deploy schemas/governance/tables/audit_log/policies/enable_rls to pg

-- requires: schemas/governance/tables/audit_log/table

BEGIN;

ALTER TABLE governance.audit_log ENABLE ROW LEVEL SECURITY;

COMMIT;
