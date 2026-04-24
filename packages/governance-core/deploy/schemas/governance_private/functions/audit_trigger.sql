-- Deploy schemas/governance_private/functions/audit_trigger to pg

-- requires: schemas/governance_private/schema
-- requires: schemas/governance/tables/audit_log/table
-- requires: schemas/governance/types/enums

BEGIN;

CREATE FUNCTION governance_private.tg_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _action_type text;
  _entity_id   uuid;
BEGIN
  _action_type := CASE TG_OP
    WHEN 'INSERT' THEN TG_ARGV[0]
    WHEN 'UPDATE' THEN TG_ARGV[1]
    WHEN 'DELETE' THEN TG_ARGV[2]
  END;

  -- Skip audit if no action type is configured for this operation
  IF _action_type IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  _entity_id := CASE
    WHEN TG_OP = 'DELETE' THEN (OLD).id
    ELSE (NEW).id
  END;

  INSERT INTO governance.audit_log (
    actor,
    action_type,
    entity_type,
    entity_id,
    previous_state,
    new_state
  ) VALUES (
    current_setting('tps.current_actor', true),
    _action_type::governance.audit_action_type,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
    _entity_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION governance_private.tg_audit_log() IS
  'Generic audit trigger. Attach to any governance table with three TG_ARGV values: insert_action_type, update_action_type, delete_action_type (any may be NULL to skip that operation). Reads actor from session variable tps.current_actor. Uses SECURITY DEFINER to bypass RLS on audit_log.';

COMMIT;
