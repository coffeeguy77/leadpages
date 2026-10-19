-- AI Composer design blocks (Oct 2026): new layouts for existing apps, created by AI
-- Composer in full mode (super admins, trusted partners) when no layout matches a design.
-- A block is data — an HTML template + scoped CSS checked by lib/ai-composer/blocks.js —
-- rendered by /assets/lp-blocks.js from the app's own fields. Sites that use a block
-- carry a copy in sites.config.blockLayouts, so pages never read this table.
--
-- status: 'approved' — offered to every AI Composer run (super admin blocks start here)
--         'site'     — only on the site it was made for, until a super admin approves it
--         'hidden'   — not offered any more (sites that use it keep their copy)

CREATE TABLE IF NOT EXISTS composer_layouts (
  id uuid PRIMARY KEY,
  app_key text NOT NULL,
  name text NOT NULL,
  looks text NOT NULL DEFAULT '',
  template text NOT NULL,
  css text NOT NULL DEFAULT '',
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'site' CHECK (status IN ('approved', 'site', 'hidden')),
  created_by uuid,
  partner_id uuid,
  site_slug text,
  design_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);
CREATE INDEX IF NOT EXISTS composer_layouts_app_status_idx ON composer_layouts (app_key, status);

-- Service role only (the APIs check access); no browser reads or writes.
ALTER TABLE composer_layouts ENABLE ROW LEVEL SECURITY;
