-- Revert schemas/governance/functions/coverage_gaps from pg

BEGIN;

DROP FUNCTION governance.coverage_gaps;

COMMIT;
