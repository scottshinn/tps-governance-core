-- Verify schemas/governance_private/functions/audit_trigger on pg

BEGIN;

SELECT verify_function('governance_private.tg_audit_log');

ROLLBACK;
