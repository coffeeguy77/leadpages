# 🚀 LeadPages

**LeadPages** is a multi-tenant SaaS website builder built specifically for Australian trades, service businesses, mortgage brokers and partner agencies.

The platform allows users to build, manage and publish high-performance SEO websites in minutes without requiring a web developer.

---

# Vision

LeadPages aims to become the fastest and most intelligent website platform for small businesses.

The philosophy is simple:

- Fast
- Beautiful
- SEO-first
- AI-assisted
- Modular
- Expandable
- Zero coding required

Everything in the platform should be configurable, reusable and future-proof.

---

# Core Features

- Website Builder
- Landing Page Builder
- Multi-page Websites
- AI Content Generation
- SEO Optimisation
- Local Area Landing Pages
- Lead Tracking
- CRM
- Domain Registration
- Hosting
- Partner Program
- Marketplace
- Email Marketing
- Analytics
- Theme Packs
- Service Packs
- Project Gallery
- Instagram Integration
- AI Assisted Editing

---

# Technology Stack

Frontend

- HTML
- CSS
- Vanilla JavaScript

Backend

- Vercel Serverless Functions
- Next.js App Router (SEO Routes)
- Supabase
- PostgreSQL

Services

- Stripe
- Dreamscape Domains
- Cloudinary
- Resend
- LeadPages Brain (Anthropic / OpenAI / Gemini)
- Instagram Graph API

Hosting

- Vercel

---

# Repository Structure

```
api/
    Serverless Functions

app/
    NextJS SEO Routes

db/
    SQL

docs/
    Complete platform documentation

lib/
    Shared libraries

marketplace/
    Marketplace components

CLAUDE.md
AI development rules

AGENTS.md
AI operating instructions
```

---

# Documentation

The complete project documentation lives inside the **docs** folder.

| Document | Description |
|----------|-------------|
| 00-VISION | Product vision and philosophy |
| 01-ARCHITECTURE | Overall platform architecture |
| 02-DATABASE | Database structure |
| 03-TEMPLATE-SYSTEM | Template engine |
| 04-SITE-BUILDER | Site builder architecture |
| 05-PARTNERS | Partner system |
| 06-DOMAINS | Domain management |
| 07-TRACKING | Analytics & tracking |
| 08-SEO | SEO engine |
| 09-CRM | Lead management |
| 10-EDITOR | Editor documentation |
| 11-DESIGN-SYSTEM | UI standards |
| 12-CODING-STANDARDS | Development rules |
| 13-ROADMAP | Future roadmap |

---

# AI Documentation

Before making any code changes, every AI agent should read:

1. CLAUDE.md
2. AGENTS.md
3. `docs/INDEX.md`
4. **If touching AI:** `docs/AI/00-STATUS.md` (Brain phases, flags, migration matrix)
5. Relevant documentation inside `/docs` (feature manuals under `docs/features/`)

LeadPages Brain (Phases 1–7) lives in `lib/brain/`. Control Centre: `/brain-admin`. Landing drafts: `BRAIN_LANDING_DRAFT=1`.

---

# Development Principles

LeadPages follows several core principles.

## Never remove functionality

Clients rely on existing functionality.

Assume every feature exists because someone requested it.

---

## Configuration over hard coding

Everything should be configurable.

Avoid hardcoded values whenever possible.

---

## Backwards compatibility

Existing customer websites should continue working after every update.

---

## Modular design

Every new feature should be capable of being enabled or disabled without affecting unrelated systems.

---

## Performance first

Simple, maintainable code is preferred over clever code.

Fast websites are critical.

---

## AI Friendly

The repository is structured to allow AI development.

Documentation should always be updated whenever significant functionality changes.

---

# Deployment

Platform deployments are handled through Vercel.

Source of truth:

GitHub

Deployment:

GitHub → Vercel

Database:

Supabase

---

# Current Status

LeadPages is under active development.

The platform currently includes:

- Website Builder
- Theme Engine
- Template Engine
- Domain Registration
- Partner Portal
- CRM
- Marketplace
- Analytics
- SEO Landing Pages
- AI Content Tools

Additional systems are continuously being developed.

---

# Contributing

When implementing new functionality:

- Read CLAUDE.md first.
- Follow AGENTS.md.
- Review relevant documentation.
- Preserve backwards compatibility.
- Keep code modular.
- Update documentation after implementation.

---

# Philosophy

> Build once.
>
> Reuse everywhere.
>
> Keep it configurable.
>
> Let AI do the heavy lifting.
>
> Never sacrifice simplicity.
