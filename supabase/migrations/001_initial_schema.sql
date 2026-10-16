-- AccessMap S-002 foundation schema.
-- PostgreSQL 16 + PostGIS, SRID 4326, distances in metres.
-- This migration is intentionally portable SQL and does not assume Supabase's
-- auth.users table or auth.uid() function. The application may set app.user_id
-- and app.role on a database session when enforcing the policies below.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.current_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.role', true), '');
$$;

CREATE TABLE place_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT place_categories_code_check CHECK (code ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT place_categories_name_check CHECK (length(btrim(name)) > 0)
);

CREATE TABLE accessibility_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  category text NOT NULL,
  label text NOT NULL,
  description text,
  input_type text NOT NULL,
  freshness_days integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accessibility_features_code_check CHECK (code ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT accessibility_features_category_check CHECK (category IN (
    'entrance', 'building', 'toilet', 'outdoor', 'transport', 'communication', 'sensory', 'cognitive'
  )),
  CONSTRAINT accessibility_features_input_type_check CHECK (input_type IN (
    'boolean', 'enum', 'measurement', 'text', 'multi_select'
  )),
  CONSTRAINT accessibility_features_freshness_check CHECK (freshness_days > 0),
  CONSTRAINT accessibility_features_label_check CHECK (length(btrim(label)) > 0)
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject text NOT NULL UNIQUE,
  email text,
  display_name text,
  role text NOT NULL DEFAULT 'user',
  status text NOT NULL DEFAULT 'active',
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN ('user', 'moderator', 'admin', 'facility_manager')),
  CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'deleted')),
  CONSTRAINT users_auth_subject_check CHECK (length(btrim(auth_subject)) > 0)
);

CREATE TABLE user_access_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mobility_needs jsonb NOT NULL DEFAULT '[]'::jsonb,
  visual_needs jsonb NOT NULL DEFAULT '[]'::jsonb,
  hearing_needs jsonb NOT NULL DEFAULT '[]'::jsonb,
  sensory_needs jsonb NOT NULL DEFAULT '[]'::jsonb,
  cognitive_needs jsonb NOT NULL DEFAULT '[]'::jsonb,
  toilet_needs jsonb NOT NULL DEFAULT '[]'::jsonb,
  transport_needs jsonb NOT NULL DEFAULT '[]'::jsonb,
  requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  profile_version integer NOT NULL DEFAULT 1,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_access_profiles_json_arrays_check CHECK (
    jsonb_typeof(mobility_needs) = 'array' AND
    jsonb_typeof(visual_needs) = 'array' AND
    jsonb_typeof(hearing_needs) = 'array' AND
    jsonb_typeof(sensory_needs) = 'array' AND
    jsonb_typeof(cognitive_needs) = 'array' AND
    jsonb_typeof(toilet_needs) = 'array' AND
    jsonb_typeof(transport_needs) = 'array' AND
    jsonb_typeof(requirements) = 'array'
  ),
  CONSTRAINT user_access_profiles_version_check CHECK (profile_version > 0)
);

CREATE TABLE places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_id uuid NOT NULL REFERENCES place_categories(id) ON DELETE RESTRICT,
  description text,
  address text NOT NULL,
  city text NOT NULL,
  postal_code text,
  latitude numeric(9, 6) NOT NULL,
  longitude numeric(9, 6) NOT NULL,
  geom geography(Point, 4326) NOT NULL,
  phone text,
  website text,
  opening_hours jsonb,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT places_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT places_longitude_check CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT places_source_check CHECK (source IN ('admin', 'community', 'import', 'facility')),
  CONSTRAINT places_status_check CHECK (status IN (
    'active', 'pending_review', 'temporarily_closed', 'permanently_closed', 'duplicate'
  )),
  CONSTRAINT places_name_check CHECK (length(btrim(name)) > 0),
  CONSTRAINT places_address_check CHECK (length(btrim(address)) > 0),
  CONSTRAINT places_city_check CHECK (length(btrim(city)) > 0),
  CONSTRAINT places_website_check CHECK (website IS NULL OR website ~* '^https?://')
);

CREATE TABLE observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE RESTRICT,
  feature_id uuid NOT NULL REFERENCES accessibility_features(id) ON DELETE RESTRICT,
  contributor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  value text NOT NULL,
  details text,
  measured_value jsonb,
  observed_at timestamptz NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  source_type text NOT NULL DEFAULT 'community',
  client_request_id text,
  visibility text NOT NULL DEFAULT 'public',
  moderation_status text NOT NULL DEFAULT 'pending',
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT observations_value_check CHECK (value IN (
    'yes', 'no', 'partial', 'temporarily_unavailable', 'unknown'
  )),
  CONSTRAINT observations_source_type_check CHECK (source_type IN (
    'community', 'facility', 'admin', 'import'
  )),
  CONSTRAINT observations_visibility_check CHECK (visibility IN ('public', 'limited', 'hidden', 'deleted')),
  CONSTRAINT observations_moderation_check CHECK (
    moderation_status IN ('pending', 'approved', 'rejected', 'changes_requested')
  ),
  CONSTRAINT observations_client_request_id_check CHECK (
    client_request_id IS NULL OR length(btrim(client_request_id)) BETWEEN 8 AND 128
  )
);

CREATE TABLE claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES accessibility_features(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'not_assessed',
  summary_value text NOT NULL DEFAULT 'unknown',
  latest_observed_at timestamptz,
  freshness_state text NOT NULL DEFAULT 'needs_reverification',
  supporting_count integer NOT NULL DEFAULT 0,
  disputing_count integer NOT NULL DEFAULT 0,
  calculation_version integer NOT NULL DEFAULT 1,
  claims_version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_sample boolean NOT NULL DEFAULT false,
  CONSTRAINT claims_place_feature_unique UNIQUE (place_id, feature_id),
  CONSTRAINT claims_status_check CHECK (status IN (
    'not_assessed', 'community_reported', 'recently_observed', 'community_corroborated',
    'facility_confirmed', 'temporarily_unavailable', 'conflicting_information',
    'needs_reverification', 'resolved'
  )),
  CONSTRAINT claims_summary_value_check CHECK (summary_value IN (
    'yes', 'no', 'partial', 'temporarily_unavailable', 'unknown'
  )),
  CONSTRAINT claims_freshness_check CHECK (freshness_state IN ('fresh', 'stale', 'needs_reverification')),
  CONSTRAINT claims_counts_check CHECK (supporting_count >= 0 AND disputing_count >= 0),
  CONSTRAINT claims_versions_check CHECK (calculation_version > 0 AND claims_version > 0)
);

CREATE TABLE verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL REFERENCES observations(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  comment text,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verification_events_type_check CHECK (event_type IN (
    'confirmed', 'disputed', 'outdated', 'helpful'
  )),
  CONSTRAINT verification_events_unique_actor UNIQUE (observation_id, user_id, event_type)
);

CREATE TABLE access_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid REFERENCES places(id) ON DELETE SET NULL,
  node_type text NOT NULL,
  label text NOT NULL,
  floor text,
  geom geography(Point, 4326) NOT NULL,
  status text NOT NULL DEFAULT 'active',
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_nodes_type_check CHECK (node_type IN (
    'entrance', 'lift', 'toilet', 'stop', 'crossing', 'room', 'connector'
  )),
  CONSTRAINT access_nodes_status_check CHECK (status IN ('active', 'closed', 'pending_review', 'unknown')),
  CONSTRAINT access_nodes_label_check CHECK (length(btrim(label)) > 0)
);

CREATE TABLE access_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id uuid NOT NULL REFERENCES access_nodes(id) ON DELETE RESTRICT,
  to_node_id uuid NOT NULL REFERENCES access_nodes(id) ON DELETE RESTRICT,
  geometry geography(LineString, 4326) NOT NULL,
  surface_type text,
  width_meters numeric(5, 2),
  slope_percent numeric(5, 2),
  stairs boolean,
  step_free boolean,
  last_observed_at timestamptz,
  status text NOT NULL DEFAULT 'unknown',
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_edges_distinct_nodes_check CHECK (from_node_id <> to_node_id),
  CONSTRAINT access_edges_width_check CHECK (width_meters IS NULL OR width_meters >= 0),
  CONSTRAINT access_edges_slope_check CHECK (slope_percent IS NULL OR slope_percent >= 0),
  CONSTRAINT access_edges_status_check CHECK (status IN ('active', 'blocked', 'closed', 'unknown'))
);

CREATE TABLE barrier_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid REFERENCES places(id) ON DELETE SET NULL,
  access_node_id uuid REFERENCES access_nodes(id) ON DELETE SET NULL,
  access_edge_id uuid REFERENCES access_edges(id) ON DELETE SET NULL,
  feature_id uuid REFERENCES accessibility_features(id) ON DELETE SET NULL,
  reported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  incident_type text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'reported',
  description text,
  geom geography(Geometry, 4326),
  starts_at timestamptz NOT NULL,
  review_at timestamptz NOT NULL,
  resolved_at timestamptz,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT barrier_events_target_check CHECK (
    num_nonnulls(place_id, access_node_id, access_edge_id, feature_id, geom) > 0
  ),
  CONSTRAINT barrier_events_severity_check CHECK (severity IN (
    'informational', 'warning', 'major', 'critical'
  )),
  CONSTRAINT barrier_events_status_check CHECK (status IN (
    'reported', 'validated', 'published', 'disputed', 'resolved', 'archived'
  )),
  CONSTRAINT barrier_events_review_check CHECK (review_at >= starts_at),
  CONSTRAINT barrier_events_resolution_check CHECK (
    resolved_at IS NULL OR resolved_at >= starts_at
  )
);

CREATE TABLE route_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_private boolean NOT NULL DEFAULT true,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT route_profiles_constraints_check CHECK (jsonb_typeof(constraints) = 'object'),
  CONSTRAINT route_profiles_name_check CHECK (length(btrim(name)) > 0)
);

CREATE TABLE evidence_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE,
  public_key text,
  media_type text NOT NULL,
  moderation_status text NOT NULL DEFAULT 'pending',
  alt_text text,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidence_assets_media_type_check CHECK (media_type IN ('image', 'document')),
  CONSTRAINT evidence_assets_moderation_check CHECK (
    moderation_status IN ('pending', 'approved', 'rejected', 'redacted')
  ),
  CONSTRAINT evidence_assets_key_check CHECK (length(btrim(storage_key)) > 0),
  CONSTRAINT evidence_assets_public_key_check CHECK (
    moderation_status <> 'approved' OR (public_key IS NOT NULL AND alt_text IS NOT NULL)
  )
);

CREATE TABLE facility_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  organization_name text NOT NULL,
  verification_method text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facility_claims_place_user_unique UNIQUE (place_id, user_id),
  CONSTRAINT facility_claims_method_check CHECK (verification_method IN (
    'official_email', 'phone_callback', 'document_review', 'admin_invitation'
  )),
  CONSTRAINT facility_claims_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  CONSTRAINT facility_claims_org_check CHECK (length(btrim(organization_name)) > 0)
);

CREATE TABLE facility_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE RESTRICT,
  feature_id uuid REFERENCES accessibility_features(id) ON DELETE SET NULL,
  manager_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  response text NOT NULL,
  status_value text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facility_responses_response_check CHECK (length(btrim(response)) > 0),
  CONSTRAINT facility_responses_evidence_check CHECK (jsonb_typeof(evidence) = 'object')
);

CREATE TABLE moderation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  reason text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  resolution text,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT moderation_items_entity_check CHECK (entity_type IN (
    'observation', 'evidence', 'place', 'claim', 'facility_claim', 'user'
  )),
  CONSTRAINT moderation_items_reason_check CHECK (reason IN (
    'spam', 'privacy', 'abuse', 'duplicate', 'conflict', 'sensitive_image', 'other'
  )),
  CONSTRAINT moderation_items_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT moderation_items_status_check CHECK (status IN ('open', 'assigned', 'resolved', 'escalated')),
  CONSTRAINT moderation_items_resolution_check CHECK (
    resolved_at IS NULL OR status = 'resolved'
  )
);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outbox_events_payload_check CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT outbox_events_attempts_check CHECK (attempt_count >= 0)
);

CREATE TABLE webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  secret_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_delivery_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_subscriptions_endpoint_unique UNIQUE (owner_id, endpoint),
  CONSTRAINT webhook_subscriptions_endpoint_check CHECK (endpoint ~* '^https://'),
  CONSTRAINT webhook_subscriptions_events_check CHECK (jsonb_typeof(events) = 'array'),
  CONSTRAINT webhook_subscriptions_status_check CHECK (status IN ('active', 'paused', 'revoked')),
  CONSTRAINT webhook_subscriptions_failures_check CHECK (failure_count >= 0)
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_metadata_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX places_geom_gist ON places USING gist (geom);
CREATE INDEX places_category_status_idx ON places (category_id, status);
CREATE INDEX places_city_idx ON places (city);

CREATE INDEX access_nodes_geom_gist ON access_nodes USING gist (geom);
CREATE INDEX access_nodes_place_status_idx ON access_nodes (place_id, status);
CREATE INDEX access_edges_geometry_gist ON access_edges USING gist (geometry);
CREATE INDEX access_edges_node_status_idx ON access_edges (from_node_id, to_node_id, status);

CREATE INDEX observations_place_feature_recent_idx
  ON observations (place_id, feature_id, observed_at DESC)
  WHERE visibility <> 'deleted';
CREATE INDEX observations_contributor_status_idx
  ON observations (contributor_id, moderation_status, created_at DESC);
CREATE UNIQUE INDEX observations_idempotency_idx
  ON observations (contributor_id, client_request_id)
  WHERE contributor_id IS NOT NULL AND client_request_id IS NOT NULL;

CREATE INDEX claims_current_idx ON claims (place_id, status, freshness_state);
CREATE INDEX claims_feature_idx ON claims (feature_id, status);

CREATE INDEX barrier_events_geom_gist ON barrier_events USING gist (geom);
CREATE INDEX barrier_events_active_idx
  ON barrier_events (place_id, status, review_at)
  WHERE status IN ('reported', 'validated', 'published', 'disputed');

CREATE INDEX moderation_items_queue_idx
  ON moderation_items (status, priority, created_at)
  WHERE status IN ('open', 'assigned', 'escalated');
CREATE INDEX moderation_items_entity_idx ON moderation_items (entity_type, entity_id);

CREATE INDEX outbox_events_pending_idx
  ON outbox_events (created_at)
  WHERE published_at IS NULL;
CREATE INDEX outbox_events_aggregate_idx ON outbox_events (aggregate_type, aggregate_id, created_at);

CREATE INDEX evidence_assets_observation_idx ON evidence_assets (observation_id, moderation_status);
CREATE INDEX facility_responses_place_idx ON facility_responses (place_id, feature_id, created_at DESC);
CREATE INDEX verification_events_observation_idx ON verification_events (observation_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at DESC);

CREATE OR REPLACE FUNCTION app.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.sync_place_geometry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.geom := ST_SetSRID(
    ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision),
    4326
  )::geography;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.prevent_observation_identity_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.place_id IS DISTINCT FROM NEW.place_id
    OR OLD.feature_id IS DISTINCT FROM NEW.feature_id
    OR OLD.contributor_id IS DISTINCT FROM NEW.contributor_id
    OR OLD.value IS DISTINCT FROM NEW.value
    OR OLD.observed_at IS DISTINCT FROM NEW.observed_at THEN
    RAISE EXCEPTION 'observation identity and original meaning are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.prevent_self_verification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  observation_contributor uuid;
BEGIN
  SELECT contributor_id
    INTO observation_contributor
    FROM observations
   WHERE id = NEW.observation_id;

  IF observation_contributor IS NOT NULL AND observation_contributor = NEW.user_id THEN
    RAISE EXCEPTION 'contributors cannot verify their own observations';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.require_approved_facility_claim()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM facility_claims
     WHERE place_id = NEW.place_id
       AND user_id = NEW.manager_id
       AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'facility manager does not have an approved claim for this place';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER place_categories_touch_updated_at
BEFORE UPDATE ON place_categories
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER accessibility_features_touch_updated_at
BEFORE UPDATE ON accessibility_features
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER users_touch_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER user_access_profiles_touch_updated_at
BEFORE UPDATE ON user_access_profiles
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER places_sync_geometry
BEFORE INSERT OR UPDATE OF latitude, longitude ON places
FOR EACH ROW EXECUTE FUNCTION app.sync_place_geometry();

CREATE TRIGGER places_touch_updated_at
BEFORE UPDATE ON places
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER observations_immutable_identity
BEFORE UPDATE ON observations
FOR EACH ROW EXECUTE FUNCTION app.prevent_observation_identity_change();

CREATE TRIGGER observations_touch_updated_at
BEFORE UPDATE ON observations
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER verification_events_no_self_verification
BEFORE INSERT OR UPDATE ON verification_events
FOR EACH ROW EXECUTE FUNCTION app.prevent_self_verification();

CREATE TRIGGER access_nodes_touch_updated_at
BEFORE UPDATE ON access_nodes
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER access_edges_touch_updated_at
BEFORE UPDATE ON access_edges
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER barrier_events_touch_updated_at
BEFORE UPDATE ON barrier_events
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER route_profiles_touch_updated_at
BEFORE UPDATE ON route_profiles
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER evidence_assets_touch_updated_at
BEFORE UPDATE ON evidence_assets
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER facility_claims_touch_updated_at
BEFORE UPDATE ON facility_claims
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER facility_responses_require_claim
BEFORE INSERT OR UPDATE ON facility_responses
FOR EACH ROW EXECUTE FUNCTION app.require_approved_facility_claim();

CREATE TRIGGER facility_responses_touch_updated_at
BEFORE UPDATE ON facility_responses
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER webhook_subscriptions_touch_updated_at
BEFORE UPDATE ON webhook_subscriptions
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE place_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_access_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE barrier_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY place_categories_public_read
  ON place_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY accessibility_features_public_read
  ON accessibility_features FOR SELECT
  USING (is_active = true);

CREATE POLICY users_self_read
  ON users FOR SELECT
  USING (id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'));

CREATE POLICY users_self_update
  ON users FOR UPDATE
  USING (id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'))
  WITH CHECK (id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'));

CREATE POLICY user_access_profiles_owner
  ON user_access_profiles FOR ALL
  USING (user_id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'))
  WITH CHECK (user_id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'));

CREATE POLICY places_public_read
  ON places FOR SELECT
  USING (status IN ('active', 'temporarily_closed'));

CREATE POLICY places_moderator_all
  ON places FOR ALL
  USING (app.current_role() IN ('moderator', 'admin'))
  WITH CHECK (app.current_role() IN ('moderator', 'admin'));

CREATE POLICY observations_public_or_owner_read
  ON observations FOR SELECT
  USING (
    (visibility = 'public' AND moderation_status = 'approved')
    OR contributor_id = app.current_user_id()
    OR app.current_role() IN ('moderator', 'admin')
  );

CREATE POLICY observations_owner_write
  ON observations FOR INSERT
  WITH CHECK (contributor_id = app.current_user_id());

CREATE POLICY observations_owner_update
  ON observations FOR UPDATE
  USING (contributor_id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'))
  WITH CHECK (contributor_id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'));

CREATE POLICY observations_moderator_all
  ON observations FOR ALL
  USING (app.current_role() IN ('moderator', 'admin'))
  WITH CHECK (app.current_role() IN ('moderator', 'admin'));

CREATE POLICY claims_public_read
  ON claims FOR SELECT
  USING (true);

CREATE POLICY verification_events_owner_or_moderator
  ON verification_events FOR ALL
  USING (user_id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'))
  WITH CHECK (user_id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'));

CREATE POLICY access_nodes_public_read
  ON access_nodes FOR SELECT
  USING (status IN ('active', 'unknown'));

CREATE POLICY access_edges_public_read
  ON access_edges FOR SELECT
  USING (status IN ('active', 'unknown'));

CREATE POLICY barrier_events_public_read
  ON barrier_events FOR SELECT
  USING (status IN ('published', 'resolved', 'archived'));

CREATE POLICY route_profiles_owner
  ON route_profiles FOR ALL
  USING (user_id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'))
  WITH CHECK (user_id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'));

CREATE POLICY evidence_assets_safe_public_read
  ON evidence_assets FOR SELECT
  USING (
    (moderation_status = 'approved' AND public_key IS NOT NULL)
    OR EXISTS (
      SELECT 1
        FROM observations
       WHERE observations.id = evidence_assets.observation_id
         AND observations.contributor_id = app.current_user_id()
    )
    OR app.current_role() IN ('moderator', 'admin')
  );

CREATE POLICY facility_claims_owner_or_moderator
  ON facility_claims FOR ALL
  USING (user_id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'))
  WITH CHECK (user_id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'));

CREATE POLICY facility_responses_public_read
  ON facility_responses FOR SELECT
  USING (true);

CREATE POLICY facility_responses_manager_write
  ON facility_responses FOR INSERT
  WITH CHECK (manager_id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'));

CREATE POLICY facility_responses_manager_update
  ON facility_responses FOR UPDATE
  USING (manager_id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'))
  WITH CHECK (manager_id = app.current_user_id() OR app.current_role() IN ('moderator', 'admin'));

CREATE POLICY moderation_private_role_read
  ON moderation_items FOR SELECT
  USING (app.current_role() IN ('moderator', 'admin'));

CREATE POLICY moderation_private_role_write
  ON moderation_items FOR ALL
  USING (app.current_role() IN ('moderator', 'admin'))
  WITH CHECK (app.current_role() IN ('moderator', 'admin'));

CREATE POLICY outbox_private_role_access
  ON outbox_events FOR ALL
  USING (app.current_role() IN ('moderator', 'admin'))
  WITH CHECK (app.current_role() IN ('moderator', 'admin'));

CREATE POLICY webhook_owner_or_admin_access
  ON webhook_subscriptions FOR ALL
  USING (owner_id = app.current_user_id() OR app.current_role() IN ('admin', 'moderator'))
  WITH CHECK (owner_id = app.current_user_id() OR app.current_role() IN ('admin', 'moderator'));

CREATE POLICY audit_private_role_read
  ON audit_logs FOR SELECT
  USING (app.current_role() IN ('moderator', 'admin'));

COMMIT;
