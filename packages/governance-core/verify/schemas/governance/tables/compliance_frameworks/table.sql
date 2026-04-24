-- Verify schemas/governance/tables/compliance_frameworks/table on pg

BEGIN;

SELECT verify_table('governance.compliance_frameworks');

ROLLBACK;
