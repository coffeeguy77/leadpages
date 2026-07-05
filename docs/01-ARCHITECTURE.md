# LeadPages Architecture

LeadPages is a serverless multi-tenant SaaS platform deployed on Vercel and backed by Supabase.

## Core Architecture

The project uses three major layers:

1. Presentation layer
2. Rendering layer
3. Backend/API layer

## Presentation Layer

Root-level HTML files provide the marketing site and admin dashboards.

Important examples:

- `home.html`
- `manage.html`
- `billing.html`
- `partner-dashboard.html`
- `builder.html`
- `admin.html`

The main production editor is `manage.html`.

## Rendering Layer

Public tenant websites are rendered mainly by `api/render.js`.

The renderer:

- Looks up a tenant site.
- Loads the correct template.
- Injects site config.
- Applies token replacement.
- Handles preview/live status.
- Handles custom domains.
- Handles draft/preview gates.

## Backend/API Layer

The `api/` folder contains Vercel serverless functions.

Major API areas:

- Rendering
- Leads
- Events/analytics
- Billing
- Domains
- Partners
- Instagram
- Cloudinary
- Cron jobs
- Trade pack generation

## Data Layer

Supabase provides:

- Postgres database
- Auth
- REST access
- Row Level Security where configured

The central table is `sites`.

Most site content is stored in `sites.config` as JSONB.

## External Services

LeadPages uses:

- Supabase — database and auth
- Vercel — hosting and serverless functions
- Stripe — billing
- Dreamscape — domains and DNS
- Cloudinary — images
- Resend — email
- Anthropic/Claude — AI writing/generation
- Instagram Graph API — social/project feeds

## Important Architectural Principle

The system is intentionally pragmatic. It is not currently a full React app. Do not rewrite it into a framework unless explicitly approved.

Safe evolution should focus on:

- Documentation
- Modular extraction
- Shared utilities
- Testing
- Schema versioning
- Safer auth helpers
