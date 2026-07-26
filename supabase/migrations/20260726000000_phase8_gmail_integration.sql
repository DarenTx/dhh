-- =============================================================================
-- Phase 8: Gmail Integration
-- Tables: gmail_config, gmail_allow_list, gmail_processed_messages
-- Functions: private.upsert_gmail_refresh_token, private.get_gmail_refresh_token
-- Storage: Expand documents bucket MIME types
-- =============================================================================

-- ── gmail_config (single row) ─────────────────────────────────────────────
CREATE TABLE public.gmail_config (
  id                    integer     PRIMARY KEY DEFAULT 1,
  auth_status           text        NOT NULL DEFAULT 'disconnected'
                          CHECK (auth_status IN ('connected', 'reauth_required', 'disconnected')),
  owner_user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at          timestamptz,
  last_token_refresh_at timestamptz,
  last_history_id       text,
  CONSTRAINT gmail_config_single_row CHECK (id = 1)
);

INSERT INTO public.gmail_config (id) VALUES (1);

ALTER TABLE public.gmail_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gmail_config_select"
  ON public.gmail_config FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
    AND ((auth.jwt() -> 'app_metadata' ->> 'is_active'))::boolean = true
  );

CREATE POLICY "gmail_config_update"
  ON public.gmail_config FOR UPDATE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── gmail_allow_list ──────────────────────────────────────────────────────
CREATE TABLE public.gmail_allow_list (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern    text        NOT NULL UNIQUE,
  label      text        NOT NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TRIGGER set_updated_at_gmail_allow_list
  BEFORE UPDATE ON public.gmail_allow_list
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.gmail_allow_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gmail_allow_list_select"
  ON public.gmail_allow_list FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
    AND ((auth.jwt() -> 'app_metadata' ->> 'is_active'))::boolean = true
  );

CREATE POLICY "gmail_allow_list_insert"
  ON public.gmail_allow_list FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
    AND ((auth.jwt() -> 'app_metadata' ->> 'is_active'))::boolean = true
  );

CREATE POLICY "gmail_allow_list_update"
  ON public.gmail_allow_list FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
    AND ((auth.jwt() -> 'app_metadata' ->> 'is_active'))::boolean = true
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
    AND ((auth.jwt() -> 'app_metadata' ->> 'is_active'))::boolean = true
  );

CREATE POLICY "gmail_allow_list_delete"
  ON public.gmail_allow_list FOR DELETE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
    AND ((auth.jwt() -> 'app_metadata' ->> 'is_active'))::boolean = true
  );

-- ── gmail_processed_messages ──────────────────────────────────────────────
CREATE TABLE public.gmail_processed_messages (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id           text        NOT NULL UNIQUE,
  status               text        NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','completed','skipped_no_match','skipped_not_allowed','error','permanently_failed')),
  error_detail         text,
  retry_count          integer     NOT NULL DEFAULT 0,
  last_error_at        timestamptz,
  matched_property_ids uuid[]      NOT NULL DEFAULT '{}',
  processed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gmail_processed_messages_status_retry_idx
  ON public.gmail_processed_messages (status, retry_count)
  WHERE status = 'error';
CREATE INDEX gmail_processed_messages_created_at_idx
  ON public.gmail_processed_messages (created_at DESC);

ALTER TABLE public.gmail_processed_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gmail_processed_messages_select"
  ON public.gmail_processed_messages FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
    AND ((auth.jwt() -> 'app_metadata' ->> 'is_active'))::boolean = true
  );

-- ── Vault helpers (SECURITY DEFINER in private schema) ───────────────────
CREATE OR REPLACE FUNCTION private.upsert_gmail_refresh_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, vault, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'GMAIL_REFRESH_TOKEN' LIMIT 1;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(p_token, 'GMAIL_REFRESH_TOKEN', 'Gmail OAuth refresh token');
  ELSE
    PERFORM vault.update_secret(v_id, p_token);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_gmail_refresh_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, vault, public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'GMAIL_REFRESH_TOKEN';
$$;

-- ── Expand documents bucket MIME types ───────────────────────────────────
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif'
]
WHERE id = 'documents';

-- ── Public RPC wrappers for Vault (service_role only) ────────────────────
CREATE OR REPLACE FUNCTION public.upsert_gmail_refresh_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, vault, public
AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: service role required';
  END IF;
  PERFORM private.upsert_gmail_refresh_token(p_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_gmail_refresh_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, vault, public
AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: service role required';
  END IF;
  RETURN private.get_gmail_refresh_token();
END;
$$;
