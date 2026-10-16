-- S-003/S-007 hardening. Apply after 001_initial_schema.sql.
BEGIN;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

ALTER TABLE facility_responses
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION app.prevent_user_privilege_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF app.current_role() NOT IN ('moderator', 'admin')
    AND (
      OLD.auth_subject IS DISTINCT FROM NEW.auth_subject
      OR OLD.role IS DISTINCT FROM NEW.role
      OR OLD.status IS DISTINCT FROM NEW.status
    ) THEN
    RAISE EXCEPTION 'users cannot change authentication identity, role, or status';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.prevent_observation_moderation_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF app.current_role() NOT IN ('moderator', 'admin')
    AND (
      OLD.contributor_id IS DISTINCT FROM NEW.contributor_id
      OR OLD.visibility IS DISTINCT FROM NEW.visibility
      OR OLD.moderation_status IS DISTINCT FROM NEW.moderation_status
      OR OLD.source_type IS DISTINCT FROM NEW.source_type
      OR OLD.client_request_id IS DISTINCT FROM NEW.client_request_id
    ) THEN
    RAISE EXCEPTION 'contributors cannot change observation moderation or identity fields';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.prevent_facility_claim_privilege_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF app.current_role() NOT IN ('moderator', 'admin')
    AND (
      OLD.user_id IS DISTINCT FROM NEW.user_id
      OR OLD.status IS DISTINCT FROM NEW.status
      OR OLD.reviewed_by IS DISTINCT FROM NEW.reviewed_by
    ) THEN
    RAISE EXCEPTION 'facility claim approval is controlled by moderators';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_prevent_privilege_change ON users;
CREATE TRIGGER users_prevent_privilege_change
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION app.prevent_user_privilege_change();

DROP TRIGGER IF EXISTS observations_prevent_moderation_change ON observations;
CREATE TRIGGER observations_prevent_moderation_change
BEFORE UPDATE ON observations
FOR EACH ROW EXECUTE FUNCTION app.prevent_observation_moderation_change();

DROP TRIGGER IF EXISTS facility_claims_prevent_privilege_change ON facility_claims;
CREATE TRIGGER facility_claims_prevent_privilege_change
BEFORE UPDATE ON facility_claims
FOR EACH ROW EXECUTE FUNCTION app.prevent_facility_claim_privilege_change();

DROP POLICY IF EXISTS users_self_update ON users;
CREATE POLICY users_self_update_safe
  ON users FOR UPDATE
  USING (id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'))
  WITH CHECK (id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'));

DROP POLICY IF EXISTS claims_public_read ON claims;
CREATE POLICY claims_public_read
  ON claims FOR SELECT
  USING (is_public = true OR app.current_role() IN ('moderator', 'admin'));

DROP POLICY IF EXISTS facility_responses_public_read ON facility_responses;
CREATE POLICY facility_responses_public_read
  ON facility_responses FOR SELECT
  USING (is_public = true OR app.current_role() IN ('moderator', 'admin'));

ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE user_access_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE observations FORCE ROW LEVEL SECURITY;
ALTER TABLE claims FORCE ROW LEVEL SECURITY;
ALTER TABLE verification_events FORCE ROW LEVEL SECURITY;
ALTER TABLE route_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE evidence_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE facility_claims FORCE ROW LEVEL SECURITY;
ALTER TABLE facility_responses FORCE ROW LEVEL SECURITY;
ALTER TABLE moderation_items FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS worker_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_event_id uuid REFERENCES outbox_events(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_dead_letters_payload_check CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT worker_dead_letters_attempts_check CHECK (attempt_count >= 0)
);

ALTER TABLE worker_dead_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_dead_letters FORCE ROW LEVEL SECURITY;
CREATE POLICY worker_dead_letters_operator_access
  ON worker_dead_letters FOR ALL
  USING (app.current_role() IN ('moderator', 'admin'))
  WITH CHECK (app.current_role() IN ('moderator', 'admin'));

COMMIT;
