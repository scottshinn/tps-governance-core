-- Revert schemas/governance/tables/audit_log/policies/enable_rls from pg

BEGIN;

ALTER TABLE governance.audit_log DISABLE ROW LEVEL SECURITY;

COMMIT;
