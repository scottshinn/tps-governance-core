-- Verify schemas/governance/tables/risk_assessments/table on pg

BEGIN;

SELECT verify_table('governance.risk_assessments');

ROLLBACK;
