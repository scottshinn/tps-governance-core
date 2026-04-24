-- Deploy schemas/governance/tables/agents/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums
-- requires: schemas/governance/tables/products/table

BEGIN;

CREATE TABLE governance.agents (
  id                    uuid                             PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text                             NOT NULL,
  version               text,
  description           text,
  purpose               text                             NOT NULL,
  lifecycle_state       governance.agent_lifecycle_state NOT NULL DEFAULT 'proposed',
  agent_type            governance.agent_type            NOT NULL,
  parent_agent_id       uuid                             REFERENCES governance.agents(id) ON DELETE RESTRICT,
  product_id            uuid                             REFERENCES governance.products(id) ON DELETE RESTRICT,
  -- delegation_scope: JSON description of what this agent may delegate to sub-agents
  delegation_scope      jsonb,
  owner                 text                             NOT NULL,
  contact               text,
  last_review_at        timestamptz,
  review_cycle_days     integer                          CHECK (review_cycle_days > 0),
  metadata              jsonb,
  created_at            timestamptz                      NOT NULL DEFAULT now(),
  updated_at            timestamptz                      NOT NULL DEFAULT now(),
  CONSTRAINT uq_agents_name_version UNIQUE (name, version)
);

COMMENT ON TABLE governance.agents IS 'AI agents registered for governance oversight. Each agent has a declared purpose, lifecycle state, and optional reporting chain.';
COMMENT ON COLUMN governance.agents.purpose IS 'Declared mission — what this agent is designed to do. Used for coverage gap analysis.';
COMMENT ON COLUMN governance.agents.lifecycle_state IS 'State machine: proposed → under_review → approved → active → suspended → decommissioned.';
COMMENT ON COLUMN governance.agents.parent_agent_id IS 'Orchestrator agent that this agent reports to. NULL for top-level agents.';
COMMENT ON COLUMN governance.agents.delegation_scope IS 'JSON description of the permission subset this agent may delegate to its sub-agents.';
COMMENT ON COLUMN governance.agents.review_cycle_days IS 'How often (in days) this agent''s permissions must be re-reviewed. NULL = no scheduled review.';

CREATE INDEX idx_agents_lifecycle_state ON governance.agents (lifecycle_state);
CREATE INDEX idx_agents_parent_agent_id ON governance.agents (parent_agent_id);
CREATE INDEX idx_agents_product_id ON governance.agents (product_id);

COMMIT;
