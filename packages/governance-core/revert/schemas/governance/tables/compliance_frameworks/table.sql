-- Revert schemas/governance/tables/compliance_frameworks/table from pg

BEGIN;

DROP TABLE governance.compliance_frameworks;

COMMIT;
