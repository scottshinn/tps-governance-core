-- Verify schemas/governance/tables/audit_log/policies/access_policies on pg

BEGIN;

SELECT verify_policy('audit_log_privileged_select', 'governance.audit_log');

ROLLBACK;
