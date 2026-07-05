# LeadPages Database

LeadPages uses Supabase Postgres.

## Central Table: `sites`

Each tenant site is represented by one row in `sites`.

Important fields inferred from the project:

- `id`
- `slug`
- `business_name`
- `vertical`
- `template`
- `theme`
- `config`
- `status`
- `custom_domain`
- `owner_email`
- `owner_user_id`
- `billing_status`
- `preview_password`
- partner/demo fields

## `config` JSONB

The `config` column is critical.

It may contain:

- Hero content
- Services
- Sections
- Images
- SEO settings
- Form settings
- Pages
- Theme settings
- Tracking settings
- Marketplace app settings
- Trade pack defaults

Rules:

- Never wipe `config`.
- Never remove unknown fields.
- Preserve backwards compatibility.
- When adding fields, use clear names and defaults.
- Document new config structures.

## Other Tables

Known table areas include:

- `profiles`
- `leads`
- `events`
- `email_optouts`
- `partners`
- `partner_profiles`
- `partner_leads`
- `partner_onboarding`
- `partner_directory`
- `billing_plans`
- `contra_accounts`
- `site_apps`
- `app_registry`
- `partner_templates`
- `service_packs`
- `domains`
- `domain_pricing`
- `system_pages`
- `site_backups`
- `demo_themes`
- `suburb_intros`
- `ig_connections`

## Migration Rules

- New tables require SQL migration files.
- New columns require SQL migration files.
- RLS policies should be documented.
- Do not rely only on manual Supabase console edits.
- Keep migrations in `db/` or `db/migrations/`.

## AI Rules

Before changing database logic, the AI must explain:

- Existing table usage
- Current access pattern
- Whether browser, serverless, or service-role access is used
- Required migration
- Rollback plan
