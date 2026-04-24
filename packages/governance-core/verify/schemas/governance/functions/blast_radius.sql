-- Verify schemas/governance/functions/blast_radius on pg

BEGIN;

SELECT verify_function('governance.blast_radius');

ROLLBACK;
