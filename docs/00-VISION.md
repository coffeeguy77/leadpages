# LeadPages — Platform Vision

**Document:** `00-VISION`  
**Status:** Foundational reference  
**Audience:** Engineers, product owners, partners, and operators  
**Entity:** Bean Culture Pty Ltd trading as Web Culture (ABN 33 600 754 676)  
**Tagline:** *Smart sites. More leads. Built in Canberra, Australia.*

---

## Preface

This document is the opening chapter of the LeadPages engineering and product canon. It describes *why* the platform exists, *who* it serves, and *what* we are building toward — before any discussion of folders, APIs, or deployment mechanics.

LeadPages is not a generic website builder. It is an Australian platform purpose-built to connect three constituencies: local businesses that need to win work online, capable people who want to run a web design business from home, and the infrastructure that makes both outcomes reliable without requiring developers, designers, or agency overhead.

Everything in the codebase — from lead capture that never fails silently, to suburb SEO pages that refuse to generate for areas a tradie does not serve — should be read in light of the principles set out here.

---

## What LeadPages Is

LeadPages is a **multi-tenant, lead-focused website platform** for the Australian market. It provides:

- **Industry-ready websites** that launch in hours, not months, pre-filled with professional copy, sections, and conversion patterns appropriate to each vertical.
- **A partner distribution model** that lets non-technical operators sell, customise, and care for client sites under their own brand and pricing.
- **Built-in business outcomes** — quote forms, call tracking, lead inboxes, analytics, email campaigns, Instagram feeds, and local SEO — without plugins or third-party tool sprawl.
- **End-to-end operations** — hosting, SSL, domains (`.com.au`), billing, and support escalation — so partners focus on relationships, not infrastructure.

At its core, LeadPages stores each tenant as a single `sites` record in Supabase. Page content lives in a flexible `config` document; HTML templates are rendered server-side and hydrated in the browser. The platform is deployed on Vercel as static admin pages, serverless API functions, and a small Next.js slice for programmatic local SEO.

The product promise, repeated across marketing and product copy, is simple: **professional websites that make the phone ring.**

---

## Who It Is For

LeadPages serves four distinct audiences. Each has different needs; the architecture must satisfy all of them without compromise.

### 1. LeadPages Partners (primary growth engine)

People who want to **start or grow a web design business from home** — without learning to code. Partners:

- Find local businesses with weak or absent web presence.
- Generate a branded site in minutes using industry templates and AI-assisted content.
- Charge their own setup fees and monthly care plans.
- Earn commission on client revenue while LeadPages handles the platform.

Typical partner profiles include stay-at-home parents, career changers, side hustlers, local networkers, retired business owners, community connectors, and designers who want faster delivery.

### 2. End-customer businesses

Local Australian businesses that need a website that **captures enquiries and builds trust**:

- **Tradies** — plumbers, electricians, landscapers, and 50+ other trade types.
- **Service businesses** — salons, cleaners, personal trainers, photographers.
- **Professional services** — mortgage brokers (including calculator suites), financial advisers.
- **Hospitality and retail** — cafés, florists, studios.

These customers may arrive via a partner, through the Find-a-Partner matching flow, or directly (e.g. the tradies storefront).

### 3. Site owners and operators

Business owners who manage their own site through `/manage` — the App Command Centre. They edit content, review captured leads, run campaigns, connect Instagram, and monitor analytics without touching code.

### 4. Platform operators

Web Culture / LeadPages staff and super-admins who manage partners, billing, marketplace features, domain resale, content packs, and quality standards.

---

## Business Philosophy

### Local relationships beat anonymous agencies

LeadPages does not compete on being the cheapest global page builder. It competes on **local trust**: a real person the business owner knows, backed by a platform that actually works. Partners are the face; LeadPages is the engine.

### Outcomes over aesthetics

A beautiful site that does not generate calls has failed. Every template, section, and marketplace feature is judged by whether it moves a visitor toward **calling, quoting, or enquiring**. Analytics, call-click tracking, and lead capture are first-class — not afterthoughts.

### The partner owns the client relationship

Partners set their own prices, invoice their own clients, and build their own brands. LeadPages is a **supplier, not a middleman**. There are no revenue splits on what partners charge; platform costs are flat and predictable. This philosophy is explicit in partner onboarding copy: *"You keep everything you charge."*

### Never lose a lead

The lead pipeline (`/api/leads`) is designed to **always return success to the visitor** even when backend operations fail. Storing the lead is the priority; email notification is best-effort. A real enquiry must never bounce because of a server error. This is a product ethic encoded in engineering behaviour.

### Quality protects everyone

Partners must meet service standards. LeadPages retains the ability to assist, reassign, or transfer accounts so **no customer is left stranded**. The platform owns the underlying customer relationship; partners earn commission for generation and first-line support. Standards exist to protect end-customers and the LeadPages brand alike.

### Australian-first

Hosting, support, domain tooling (`.com.au`), copy tone, and trade content packs are oriented toward **Australian businesses and regulations**. Content generation prompts use location tokens (`{city}`, `{suburb}`, `{region}`) rather than hardcoded foreign locales. The company is built in Canberra; the product voice is local, direct, and practical.

### Show, don't describe

Sales philosophy (documented in partner resources) emphasises **demo sites over slide decks**. The platform is built to make spinning up a prospect's industry demo fast — because seeing their name on a professional site closes deals that words cannot.

---

## Platform Goals

### Near-term operational goals

| Goal | Description |
|------|-------------|
| **Instant credible presence** | Any business type can go from zero to a live, professional site in a single session. |
| **Partner self-sufficiency** | A new partner can complete training, build a demo, and land a first client without engineering support. |
| **Measurable lead attribution** | Site owners see which calls, forms, and pages produced enquiries. |
| **Recurring revenue mechanics** | Care plans, hosting subscriptions, and partner commissions create predictable monthly income. |
| **Unified operations** | Domains, billing, media uploads, campaigns, and site editing live in one platform — no plugin ecosystem. |

### Technical goals

| Goal | Description |
|------|-------------|
| **Config-driven rendering** | One renderer (`api/render.js`) serves all tenant pages from database config and template selection. |
| **Safe multi-tenancy** | Custom domains, slug routing, preview gates, and billing suspension are enforced at render time. |
| **Extensibility without fragility** | Marketplace apps attach to sites via `site_apps` and registry patterns rather than per-tenant code forks. |
| **AI as accelerator, not autopilot** | Claude generates trade packs, suburb intros, and copy drafts; humans polish and approve. |
| **Honest SEO** | Suburb pages generate only for declared service areas — preventing doorway-page abuse. |

---

## Long-Term Vision

LeadPages aims to become **Australia's default infrastructure for local web presence** — the platform behind thousands of small businesses that would never hire a traditional agency and would never succeed with DIY drag-and-drop tools.

### The three-layer future

```
┌─────────────────────────────────────────────────────────────┐
│  LOCAL FACE          Partners & studios with their brands   │
├─────────────────────────────────────────────────────────────┤
│  PLATFORM LAYER      Sites, leads, SEO, apps, domains, AI   │
├─────────────────────────────────────────────────────────────┤
│  OUTCOME LAYER       Calls, quotes, reviews, repeat work    │
└─────────────────────────────────────────────────────────────┘
```

**Partners scale geographically.** Every suburb and region can have trusted local operators building sites for businesses on their street. Find-a-Partner matching, partner showcases (`slug.leadpages.com.au`), and directory listings make the network discoverable.

**The content library compounds.** AI-generated trade packs, variant libraries, and partner contributions expand the industry catalogue automatically. New trades and business types become buildable without engineering intervention.

**Local SEO becomes a moat.** Per-suburb landing pages with unique AI intros, canonical URLs, and service-area gating give tradies legitimate geographic reach that generic builders cannot replicate with a single homepage.

**Marketplace apps deepen value.** Instagram galleries, project feeds, email campaigns, reviews, certifications, and finance widgets turn a "website" into an **operating system for local customer acquisition** — still without plugins.

**The dual channel converges.** Partners serve relationship-driven sales; direct channels (e.g. tradies storefront, future vertical landing pages) serve self-serve buyers. Both run on the same rendering engine and data model.

---

## Target Market

### Geographic focus

- **Primary:** Australia, with strong roots in Canberra and the ACT.
- **Expansion pattern:** Partner-led growth into any Australian suburb or region where local operators enrol.
- **Domain emphasis:** `.com.au` and Australian business identity.

### Vertical focus

| Tier | Verticals | Maturity |
|------|-----------|----------|
| **Core** | Trades (plumbing, electrical, landscaping, etc.) | Deep — trade packs, themes, suburb SEO, tradies storefront |
| **Established** | Mortgage brokers | Broker landing pages, full calculator app suite |
| **Growing** | Salons, cafés, cleaners, personal trainers, photographers | Industry themes and marketplace features |
| **Platform** | Partner agency homepages | Agency template, showcase sites, onboarding |

### Economic profile

- **End-customers:** Small businesses with $800–$1,500 setup budget tolerance and $49–$99/month ongoing care plan capacity.
- **Partners:** Individuals seeking $10k–$50k+ annual side income or full-time studio revenue, working school hours or evenings.
- **Competitive alternative:** DIY Squarespace/Wix (too hard, poor results), Facebook-only presence (no capture), or local agencies ($5k+, months of delivery).

---

## Competitive Advantages

### 1. Business-in-a-box for partners

Competitors sell tools. LeadPages sells **a complete business**: builder, hosting, leads, domains, training, sales scripts, commission tracking, and support escalation. Partners are not assembling a stack; they are opening a studio.

### 2. Industry content out of the box

Fifty-plus trade and business themes ship with **professional copy, sections, and conversion layout already written**. Partners customise; they do not draft from a blank canvas. AI generates new trade packs on demand, with variant libraries for freshness.

### 3. Lead infrastructure is native

Quote forms, call-click analytics, lead inbox, email campaigns, and unsubscribe handling are **built into the platform** — not bolted on via Zapier, Typeform, or Mailchimp. Every feature in the Marketplace is included; there are no plugin subscriptions.

### 4. Local SEO with integrity

The suburb page generator (`app/[site]/[suburb]`) produces localised titles, descriptions, AI-written intros, and canonical URLs — but **only for suburbs listed in a site's service areas**. This is a deliberate product decision: geographic SEO must reflect genuine service coverage.

### 5. Australian domain and hosting integration

Dreamscape-powered domain search, registration, DNS, and Stripe checkout are integrated into the same dashboard where partners build sites. Partners do not context-switch to registrars or cPanels.

### 6. Partner economics aligned with retention

Commission on upfront build fees and ongoing monthly subscriptions rewards partners for **keeping clients happy and live** — not just for one-off sales.

### 7. Speed to demo and speed to live

Sites generate in seconds; demos close deals in person; production sites publish the same day. The tradies channel promises **live in 24 hours** for done-for-you purchases.

### 8. Human support with platform depth

Canberra-based support, training centre content, help articles with role-aware AI assistant, and technical escalation mean partners are never alone — but clients still see a local contact.

---

## Core Principles

These principles govern product and engineering decisions. When in doubt, defer to them.

### 1. Leads are sacred

Never sacrifice a captured enquiry to an error response, a missing API key, or a logging failure. Store first; notify second; report silently.

### 2. Config is the product

The `sites.config` document is the source of truth for page content. Templates are shells; config is the business. Editors write config; renderers read config.

### 3. Templates are chosen, not forked

Tenant customisation happens through config, theme tokens, and marketplace apps — not through per-client HTML forks. One trade template serves thousands of plumbers.

### 4. Preview is not production

Draft sites require explicit preview mode. Non-live sites are `noindex` and uncached. Publishing is a deliberate `status: live` transition.

### 5. Billing state is enforced

Suspended sites show a professional unavailable page — not a broken render or a stale cache. The platform protects revenue and sets clear expectations.

### 6. Partners are force multipliers

Features that help partners sell, demo, quote, onboard, and support clients are as important as features that help site owners edit pages.

### 7. AI writes drafts; humans own truth

Generated copy, suburb intros, and trade packs are starting points. Licences, prices, credentials, and claims must be verified by the business owner or partner.

### 8. No doorway pages

Geographic SEO pages must correspond to real service areas. If a suburb is not in `config.sections.serviceAreas`, it does not get a page.

### 9. Flat platform cost, partner-owned margin

The platform does not tax partner creativity on pricing. Revenue model clarity builds trust and attracts operators.

### 10. Australian practical tone

Copy, defaults, and UX assume an Australian reader: direct language, realistic pricing examples, `.com.au` domains, and local trust signals.

---

## Product Roadmap

The roadmap below reflects the current codebase trajectory and stated product direction. It is organised by theme, not by calendar quarter. Items marked **Shipped** exist in production code; **Active** are partially built or expanding; **Planned** are natural next steps consistent with vision.

### Foundation — **Shipped**

- Multi-template rendering (trade, broker-leads, broker-app, agency)
- Supabase-backed sites, leads, events, and auth
- App Command Centre (`/manage`) with live preview and autosave
- Partner dashboard, onboarding, and application flow
- Stripe billing (hosting, apps, partner checkout)
- Dreamscape domain search, purchase, and DNS
- Cloudinary media pipeline
- Email campaigns and lead notifications (Resend)
- Marketplace catalogue and installable site apps
- Instagram OAuth connect and project feed sync
- AI trade pack generation (Claude) with variant library
- Suburb SEO pages with cached AI intros
- Help centre with role-aware AI assistant

### Partner growth — **Active**

- Find-a-Partner directory and lead matching
- Partner showcase sites on subdomains
- Commission dashboard and payout cycles
- Training centre and sales resources
- Quote creation and public quote pages
- Mockup sites for prospect demos
- Expand partner directory self-service listings

### Vertical depth — **Active**

- Tradie storefront with theme gallery and cart checkout
- Broker calculator suite with rate overrides and demo themes
- Service pack library growth (50+ trades target)
- Conversion presets and layout variants in editor
- Service area maps and suburb token SEO in main editor

### Platform maturity — **Planned**

- Consolidated admin authorisation (`is_super_admin` + email allowlist)
- Full database schema versioning in repository
- Scheduled crons for email send-due and Instagram sync (wired in `vercel.json`)
- Unified site creation path (retire legacy password-gated builder)
- Component-level template architecture (reduce monolithic JSON templates)
- Expanded rate limiting and abuse protection on public endpoints
- Dynamic `seo-sitemap.xml` linked from `robots.txt`
- Resolve routing precedence between render sub-pages and suburb SEO routes

### Network effects — **Planned**

- Partner density maps and territory tooling
- Client referral flows between partners and direct channels
- Review and testimonial syndication across marketplace
- Vertical-specific direct storefronts beyond tradies
- White-label partner branding depth (studio sites, proposal PDFs)

### Outcome layer — **Planned**

- Deeper CRM: lead stages, follow-up reminders, SMS notifications
- Ad platform integrations (Google Business Profile, Meta pixel management)
- Revenue reporting for site owners ("jobs won from site")
- A/B testing of hero and CTA variants per site

---

## What Makes LeadPages Unique

Most website platforms answer the question: *"How do I build a page?"*

LeadPages answers: *"How does a local business get more work — and how does a capable person build a business around delivering that outcome?"*

The distinction shows up everywhere:

| Typical builder | LeadPages |
|-----------------|-----------|
| Blank canvas | Industry-ready draft |
| User figures out hosting | Hosting included |
| Plugins for forms | Lead capture built in |
| User learns SEO | Service-area suburb pages generated with guardrails |
| SaaS subscription for one site | Partner economics with commission and care plans |
| Global, generic | Australian, local, practical |
| Developer or designer required | Partner with relationships required |
| Analytics optional | Call clicks and form submits are core |

LeadPages is unique because it is **a distribution platform disguised as a site builder**. The renderer, the templates, the marketplace, the billing engine, and the partner program are one integrated system designed to make *local web services* scalable — without making them generic.

---

## Closing

LeadPages exists to close a gap that marketing copy states plainly: good local businesses are losing work to competitors who simply show up better online, while capable people nearby lack the technical means to help them.

The platform's job is to remove the technical barrier entirely — and to ensure that when a visitor finds a LeadPages-built site, the path from *"I need this done"* to *"I called them"* is short, measured, and reliable.

Every engineering decision that follows in this documentation set should be traceable to that outcome.

---

*Next in series: architecture, folder structure, authentication, database schema, template system, site builder, and deployment guides.*
