-- Deploy schemas/governance/tables/rules/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums

BEGIN;

CREATE TABLE governance.rules (
  id                uuid                         PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text                         NOT NULL,
  description       text,
  rule_type         governance.rule_type         NOT NULL,
  -- condition: structured JSON representation of what this rule checks.
  -- DECISION: JSON object with a "type" discriminant and type-specific fields.
  -- Layer 2 is responsible for evaluating this condition against live data.
  -- Example: {"type": "no_access_to_resource_type", "resource_type": "secret_store", "except_actions": ["read"]}
  condition         jsonb                        NOT NULL,
  violation_action  governance.violation_action  NOT NULL DEFAULT 'flag_for_review',
  severity          governance.severity          NOT NULL DEFAULT 'medium',
  status            governance.rule_status       NOT NULL DEFAULT 'draft',
  scope             governance.scope_level       NOT NULL DEFAULT 'global',
  -- scope_entity_id: ID of the product/agent/resource this rule applies to when scope != global
  scope_entity_id   uuid,
  created_at        timestamptz                  NOT NULL DEFAULT now(),
  updated_at        timestamptz                  NOT NULL DEFAULT now(),
  CONSTRAINT uq_rules_name UNIQUE (name),
  -- scope_entity_id must be set for non-global rules
  CONSTRAINT chk_rules_scope_entity CHECK (
    (scope = 'global' AND scope_entity_id IS NULL)
    OR (scope != 'global' AND scope_entity_id IS NOT NULL)
  )
);

COMMENT ON TABLE governance.rules IS 'Evaluable governance checks that assess the current state of the permission model. Rules link to compliance requirements and produce violations when their condition is met.';
COMMENT ON COLUMN governance.rules.condition IS 'JSON condition evaluated by Layer 2. Must include a "type" field identifying the evaluation strategy. Intentionally schema-flexible to support diverse rule types without DDL changes.';
COMMENT ON COLUMN governance.rules.violation_action IS 'What Layer 2 / enforcement layer should do when this rule fires: deny, flag, require approval, alert, or log.';
COMMENT ON COLUMN governance.rules.scope IS 'Scope at which this rule applies. global = all agents; product/agent/resource = scoped by scope_entity_id.';
COMMENT ON COLUMN governance.rules.scope_entity_id IS 'UUID of the scoped entity (product_id, agent_id, or resource_id). Must match the scope field semantically — enforced by application code.';

CREATE INDEX idx_rules_rule_type ON governance.rules (rule_type);
CREATE INDEX idx_rules_status ON governance.rules (status);
CREATE INDEX idx_rules_severity ON governance.rules (severity);
CREATE INDEX idx_rules_scope ON governance.rules (scope);
CREATE INDEX idx_rules_scope_entity_id ON governance.rules (scope_entity_id) WHERE scope_entity_id IS NOT NULL;

COMMIT;
