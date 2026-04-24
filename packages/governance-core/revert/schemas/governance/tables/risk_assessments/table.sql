-- Revert schemas/governance/tables/risk_assessments/table from pg

BEGIN;

DROP TABLE governance.risk_assessments;

COMMIT;
