-- Revert schemas/governance_private/functions/audit_trigger from pg

BEGIN;

DROP FUNCTION governance_private.tg_audit_log();

COMMIT;
