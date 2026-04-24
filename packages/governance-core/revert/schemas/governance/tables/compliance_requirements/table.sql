-- Revert schemas/governance/tables/compliance_requirements/table from pg

BEGIN;

DROP TABLE governance.compliance_requirements;

COMMIT;
