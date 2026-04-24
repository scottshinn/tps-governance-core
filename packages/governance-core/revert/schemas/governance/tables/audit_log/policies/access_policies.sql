-- Revert schemas/governance/tables/audit_log/policies/access_policies from pg

BEGIN;

DROP POLICY audit_log_privileged_select ON governance.audit_log;

REVOKE SELECT ON TABLE governance.audit_log FROM authenticated;

COMMIT;
