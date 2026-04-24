-- Deploy schemas/governance/tables/audit_log/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums

BEGIN;

CREATE TABLE governance.audit_log (
  id               uuid                          PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at      timestamptz                   NOT NULL DEFAULT now(),
  -- actor: human user ID, system process identifier, or agent ID that performed the action
  actor            text,
  action_type      governance.audit_action_type  NOT NULL,
  entity_type      text                          NOT NULL,
  entity_id        uuid                          NOT NULL,
  previous_state   jsonb,
  new_state        jsonb,
  reason           text,
  -- correlation_id: groups related audit events from a single operation
  correlation_id   uuid,
  metadata         jsonb
);

COMMENT ON TABLE governance.audit_log IS 'Immutable record of every governance-relevant state change. Append-only — no UPDATE or DELETE triggers are attached. Used for point-in-time reconstruction and compliance audits.';
COMMENT ON COLUMN governance.audit_log.actor IS 'Who performed the action: a human user ID (from tps.current_actor session variable), a system process name, or an agent ID.';
COMMENT ON COLUMN governance.audit_log.entity_type IS 'Schema-qualified table name of the affected entity (e.g., "governance.agents").';
COMMENT ON COLUMN governance.audit_log.previous_state IS 'JSON snapshot of the entity before the change. NULL for INSERT events.';
COMMENT ON COLUMN governance.audit_log.new_state IS 'JSON snapshot of the entity after the change. NULL for DELETE events.';
COMMENT ON COLUMN governance.audit_log.correlation_id IS 'Groups multiple audit entries from a single logical operation (e.g., assigning a role and updating an agent lifecycle state in one request).';

-- Partition by occurred_at in high-volume deployments — not implemented here
-- ASSUMPTION: audit_log will grow large; consider pg_partman partitioning in production

CREATE INDEX idx_audit_log_entity ON governance.audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_action_type ON governance.audit_log (action_type);
CREATE INDEX idx_audit_log_actor ON governance.audit_log (actor) WHERE actor IS NOT NULL;
CREATE INDEX idx_audit_log_occurred_at ON governance.audit_log (occurred_at DESC);
CREATE INDEX idx_audit_log_correlation_id ON governance.audit_log (correlation_id) WHERE correlation_id IS NOT NULL;

COMMIT;
