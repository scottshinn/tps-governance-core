-- Deploy schemas/governance/views/ungoverned_resources to pg

-- requires: schemas/governance/functions/coverage_gaps

BEGIN;

CREATE VIEW governance.ungoverned_resources AS
  SELECT * FROM governance.coverage_gaps();

COMMENT ON VIEW governance.ungoverned_resources IS
  'Resources lacking full governance coverage — either no active permissions or no active resource-scoped rules. A thin wrapper over coverage_gaps() for convenient querying.';

COMMIT;
