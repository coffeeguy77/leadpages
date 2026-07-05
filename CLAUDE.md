# LeadPages AI Instructions

This file is the first document any coding AI should read before changing LeadPages.

## Core Rule

Do not edit code until you have read the relevant files, explained the current implementation, identified risks, and produced a file-by-file implementation plan for approval.

## What LeadPages Is

LeadPages is a multi-tenant SaaS platform for building SEO landing pages and small business websites for Australian tradies, brokers, service businesses, partners, and agencies.

The core model is simple:

- One tenant site is stored as one row in the `sites` table.
- Most editable content lives inside the `sites.config` JSONB column.
- Templates are rendered through Vercel serverless functions.
- Supabase is the source of truth for auth, database, leads, events, partners, and site configuration.
- Vercel handles hosting, rewrites, serverless APIs, and tenant rendering.

## Non-Negotiable Rules

- Never delete functionality unless explicitly instructed.
- Never remove editor options because they look unused.
- Never simplify features without approval.
- Never hardcode client-specific values.
- Never break backwards compatibility for existing sites.
- Never rename API routes without approval.
- Never change authentication logic without approval.
- Never change billing, domain, or partner logic without approval.
- Never modify database structure without a migration plan.
- Never remove existing config fields from `sites.config`.
- Never overwrite client content.
- Never remove custom themes, trade packs, or partner-specific features.
- Never convert the project to a new framework without explicit approval.
- Always preserve current workflows first, then improve them.

## Preferred AI Workflow

Before making changes:

1. Read all relevant files.
2. Summarise the current system.
3. List the files involved.
4. Identify risks.
5. Propose the smallest safe change.
6. Wait for approval.
7. Edit only the approved files.
8. Explain exactly what changed.
9. Suggest tests.

## Project Priorities

LeadPages must remain:

- Fast
- Simple to deploy
- Modular
- Settings-driven
- Partner-friendly
- Mobile-first
- SEO-focused
- Easy for non-technical users
- Safe for AI-assisted development
- Backwards compatible with existing customer sites

## Architecture Summary

LeadPages uses:

- Static root-level HTML files for dashboards and admin UIs.
- `api/render.js` for tenant site rendering.
- `api/**/*.js` serverless functions for backend logic.
- Supabase Postgres + Auth.
- Stripe for billing.
- Dreamscape for domain search, registration, and DNS.
- Cloudinary for image uploads.
- Resend for email.
- Anthropic/Claude for AI features.
- Instagram Graph API for social/project feed sync.

## Important Files And Areas

Common major files and folders:

- `manage.html` — main production editor / app command centre.
- `builder.html` — legacy site creation flow.
- `admin.html` — legacy/shared admin tooling.
- `api/render.js` — main public rendering engine.
- `api/leads.js` — public lead capture.
- `api/events.js` — analytics/event tracking.
- `api/create-site.js` — site creation endpoint.
- `api/billing/` — Stripe billing and subscription logic.
- `api/domains/` — Dreamscape domain functionality.
- `api/partner/` — partner dashboard and partner CRUD.
- `api/instagram/` — Instagram OAuth.
- `api/cron/` — scheduled workers.
- `app/[site]/[suburb]/route.js` — suburb SEO pages.
- `app/seo-sitemap.xml/route.js` — dynamic SEO sitemap.
- `trade.template.json` — main tradie template.
- `broker.template.json` — broker lead-gen template.
- `brokerapp.template.json` — broker app template.
- `agency.template.json` — partner/agency homepage template.
- `vercel.json` — routing and cron configuration.

## Business Logic Context

LeadPages is not just a website builder. It is also a partner/reseller platform.

Key business concepts:

- Partners can sell websites to clients.
- Clients may see the partner as their support person.
- LeadPages remains the platform owner in the background.
- Partner accounts may need to be transferred if a partner stops supporting a client.
- Theme packs and trade packs are important because they allow sites to be generated quickly.
- Customers should be able to upload photos, turn sections on/off, and avoid developer involvement.
- The platform should support recurring income, one-off build fees, partner commissions, and optional marketplace features.

## Editor Philosophy

The editor must feel like a professional app, not a hacked-together form.

Rules:

- Group settings logically.
- Keep actions where users expect them.
- Avoid floating controls that feel disconnected.
- Do not hide important settings.
- Do not remove options; reorganise instead.
- Keep sign-out/account controls accessible but not visually dominant.
- Use clear section names.
- Prefer professional dashboard-style UI.
- Reduce clutter without reducing power.

## Template And Theme Philosophy

Templates and themes must be reusable across many businesses.

Rules:

- Do not bake one business into a template.
- Keep content configurable.
- Keep design separate from data.
- Every visual section should tolerate missing images and text.
- Theme packs should include colours, typography, section defaults, services, icons, and copy style.
- Changes to templates must not break existing customer sites.

## Database Rules

- Treat Supabase as the source of truth.
- `sites.config` is critical and must be preserved.
- New persistent features should be represented in config or a clearly named table.
- Schema changes require SQL migrations.
- Never rely only on undocumented manual Supabase changes.
- Document new tables, columns, and expected RLS behaviour.

## Security Rules

- Prefer Supabase Auth over shared passwords.
- Service-role endpoints must be protected.
- Public endpoints must validate input.
- Admin-only actions must verify admin status.
- Partner actions must verify active partner ownership.
- Never expose service role keys client-side.
- Never assume anon key access is secure without RLS.

## Deployment Rules

- GitHub is the source of truth.
- Vercel deploys from GitHub.
- Environment variables live in Vercel/Supabase/third-party dashboards.
- Do not assume local-only changes are deployed.
- Any routing change must be checked against `vercel.json`.
- Any new scheduled task must be added to Vercel cron if it needs to run automatically.

## Testing Checklist For AI Changes

After changes, check:

- Login still works.
- Site list loads.
- Existing site config loads.
- Autosave works.
- Preview works.
- Public rendered site works.
- Lead forms submit.
- Images still upload.
- Partner dashboard still works if touched.
- Billing/domain functionality still works if touched.
- No console errors.
- No broken Vercel rewrites.

## Improvement Strategy

Safe improvements are preferred over rewrites.

Good first steps:

- Document architecture.
- Add `.env.example`.
- Add database migrations.
- Add shared auth helpers.
- Add tests for render/leads/billing.
- Extract reusable JS/CSS from large HTML files.
- Add clear docs for each subsystem.

Risky changes that require explicit approval:

- Rewriting `manage.html` into React/Vue/Svelte.
- Replacing Supabase auth.
- Changing renderer routing.
- Changing the `sites.config` structure.
- Changing billing or domain flows.
- Changing template format.
