-- Revert schemas/governance/functions/blast_radius from pg

BEGIN;

DROP FUNCTION governance.blast_radius;

COMMIT;
