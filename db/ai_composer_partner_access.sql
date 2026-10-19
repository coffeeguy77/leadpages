-- AI Composer partner access (Oct 2026)
--
-- partners.composer_access
--   'standard' (default) — partners build demo sites from a design with the AI Composer
--   'trusted'            — full mode: also copy from a URL and create new layouts
--   'off'                — no AI Composer
-- partners.composer_monthly_limit — design analyses per calendar month; NULL = the
--   default (env AI_COMPOSER_PARTNER_MONTHLY / AI_COMPOSER_TRUSTED_MONTHLY, 15 / 60).
--
-- Usage is counted from ai_requests (Brain logs each composer.design_plan call with the
-- partner's id). Super admins set these columns in Partners admin or SQL; partners
-- cannot change them (writes go through the service role only).

ALTER TABLE partners ADD COLUMN IF NOT EXISTS composer_access text NOT NULL DEFAULT 'standard';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS composer_monthly_limit integer;

DO $$ BEGIN
  ALTER TABLE partners ADD CONSTRAINT partners_composer_access_chk
    CHECK (composer_access IN ('off', 'standard', 'trusted'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE partners ADD CONSTRAINT partners_composer_monthly_limit_chk
    CHECK (composer_monthly_limit IS NULL OR composer_monthly_limit >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS ai_requests_partner_task_created_idx
  ON ai_requests (partner_id, task_id, created_at);
