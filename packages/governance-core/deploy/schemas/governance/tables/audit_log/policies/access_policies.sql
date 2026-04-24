-- Deploy schemas/governance/tables/audit_log/policies/access_policies to pg

-- requires: schemas/governance/tables/audit_log/table
-- requires: schemas/governance/tables/audit_log/policies/enable_rls

BEGIN;

-- governance_admin and auditor: read access to full audit log
CREATE POLICY audit_log_privileged_select ON governance.audit_log
  FOR SELECT
  USING (current_setting('tps.role', true) IN ('governance_admin', 'system_admin', 'auditor'));

-- Inserts are performed by the audit trigger function (SECURITY DEFINER) — no direct insert policy needed
-- No UPDATE or DELETE policies — the audit log is append-only by policy

GRANT SELECT ON TABLE governance.audit_log TO authenticated;

COMMIT;
