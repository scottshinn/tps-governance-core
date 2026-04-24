-- Verify schemas/governance/tables/audit_log/table on pg

BEGIN;

SELECT verify_table('governance.audit_log');

ROLLBACK;
