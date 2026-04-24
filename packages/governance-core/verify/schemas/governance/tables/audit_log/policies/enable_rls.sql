-- Verify schemas/governance/tables/audit_log/policies/enable_rls on pg

BEGIN;

SELECT verify_security('governance.audit_log');

ROLLBACK;
