-- Revert schemas/governance/tables/audit_log/table from pg

BEGIN;

DROP TABLE governance.audit_log;

COMMIT;
