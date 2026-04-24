-- Deploy schemas/governance/tables/rule_sets/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums

BEGIN;

CREATE TABLE governance.rule_sets (
  id               uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text                    NOT NULL,
  description      text,
  scope            governance.scope_level  NOT NULL DEFAULT 'global',
  -- scope_entity_id: ID of the product/agent this rule set is bound to when scope != global
  scope_entity_id  uuid,
  created_at       timestamptz             NOT NULL DEFAULT now(),
  updated_at       timestamptz             NOT NULL DEFAULT now(),
  CONSTRAINT uq_rule_sets_name UNIQUE (name),
  CONSTRAINT chk_rule_sets_scope_entity CHECK (
    (scope = 'global' AND scope_entity_id IS NULL)
    OR (scope != 'global' AND scope_entity_id IS NOT NULL)
  )
);

COMMENT ON TABLE governance.rule_sets IS 'Composable collections of rules that can be applied at different scopes. A rule set bound to a product automatically applies to all agents in that product.';
COMMENT ON COLUMN governance.rule_sets.scope_entity_id IS 'UUID of the product or agent this rule set is bound to. NULL for global rule sets.';

COMMIT;
