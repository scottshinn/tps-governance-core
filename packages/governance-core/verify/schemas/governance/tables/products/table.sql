-- Verify schemas/governance/tables/products/table on pg

BEGIN;

SELECT verify_table('governance.products');

ROLLBACK;
