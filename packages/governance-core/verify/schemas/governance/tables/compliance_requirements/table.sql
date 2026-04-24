-- Verify schemas/governance/tables/compliance_requirements/table on pg

BEGIN;

SELECT verify_table('governance.compliance_requirements');

ROLLBACK;
