-- Verify schemas/governance/tables/resource_data_categories/table on pg

BEGIN;

SELECT verify_table('governance.resource_data_categories');

ROLLBACK;
