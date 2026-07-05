# LeadPages Documentation Index

**Document:** `INDEX`  
**Status:** Master navigation for the engineering knowledge base  
**Audience:** Engineers, partners, operators, AI development agents  
**Entity:** Bean Culture Pty Ltd trading as Web Culture

> Read documents **in order** for onboarding. Jump to topic docs for deep dives. [00-VISION](00-VISION.md) is the source of truth for product intent; [12-CODING-STANDARDS](12-CODING-STANDARDS.md) governs how to change code safely.

---

## Quick Start Paths

### New engineer (first week)

1. [00-VISION](00-VISION.md) — why LeadPages exists
2. [01-ARCHITECTURE](01-ARCHITECTURE.md) — how it is built
3. [02-DATABASE](02-DATABASE.md) — data model
4. [10-EDITOR](10-EDITOR.md) — the control plane
5. [12-CODING-STANDARDS](12-CODING-STANDARDS.md) — rules of the road

### AI agent (before any code change)

1. [00-VISION](00-VISION.md)
2. [12-CODING-STANDARDS](12-CODING-STANDARDS.md)
3. Topic doc for the area you are touching
4. [AGENTS.md](../AGENTS.md) / [CLAUDE.md](../CLAUDE.md) if present

### Partner operator

1. [00-VISION](00-VISION.md) § Partner economics
2. [05-PARTNERS](05-PARTNERS.md)
3. [04-SITE-BUILDER](04-SITE-BUILDER.md)
4. [10-EDITOR](10-EDITOR.md) § Navigation

---

## Document Catalogue

| # | Document | Lines | Status | Summary |
|---|----------|-------|--------|---------|
| 00 | [VISION](00-VISION.md) | ~544 | **Definitive** | Product intent, principles, business model, non-negotiables |
| 01 | [ARCHITECTURE](01-ARCHITECTURE.md) | ~1000 | **Definitive** | Technical architecture, APIs, routing, external services |
| 02 | [DATABASE](02-DATABASE.md) | ~1250 | **Definitive** | All 51 tables, `sites.config` schema, migrations |
| 03 | [TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md) | ~815 | **Definitive** | Templates, render.js, hydration, tokens |
| 04 | [SITE-BUILDER](04-SITE-BUILDER.md) | ~525 | **Definitive** | Site creation, trade packs, publish lifecycle |
| 05 | [PARTNERS](05-PARTNERS.md) | ~375 | **Definitive** | Partner program, showcase, commissions, buy-site |
| 06 | [DOMAINS](06-DOMAINS.md) | ~265 | **Definitive** | Dreamscape, DNS, custom domain routing |
| 07 | [TRACKING](07-TRACKING.md) | ~260 | **Definitive** | Events, stats API, dashboard analytics |
| 08 | [SEO](08-SEO.md) | ~255 | **Definitive** | Suburb pages, landing pages, sitemap, tokens |
| 09 | [CRM](09-CRM.md) | ~280 | **Definitive** | Leads, mailer, opt-outs, CRM UI |
| 10 | [EDITOR](10-EDITOR.md) | ~1250 | **Definitive** | Complete `manage.html` engineering manual |
| 11 | [DESIGN-SYSTEM](11-DESIGN-SYSTEM.md) | ~280 | **Definitive** | Typography, colours, components, UX rules |
| 12 | [CODING-STANDARDS](12-CODING-STANDARDS.md) | ~250 | **Definitive** | JS, API, DB, git, security standards |
| 13 | [ROADMAP](13-ROADMAP.md) | ~280 | **Definitive** | Priorities, technical debt, future work |

---

## Topic Index

### Platform core

| Topic | Primary doc | Also see |
|-------|-------------|----------|
| Multi-tenant model | [01-ARCHITECTURE](01-ARCHITECTURE.md) | [02-DATABASE](02-DATABASE.md) |
| `sites.config` JSONB | [02-DATABASE](02-DATABASE.md) | [04-SITE-BUILDER](04-SITE-BUILDER.md) |
| Vercel serverless APIs | [01-ARCHITECTURE](01-ARCHITECTURE.md) | [12-CODING-STANDARDS](12-CODING-STANDARDS.md) |
| Supabase auth + data | [01-ARCHITECTURE](01-ARCHITECTURE.md) | [02-DATABASE](02-DATABASE.md) |

### Editor & builder

| Topic | Primary doc | Also see |
|-------|-------------|----------|
| `manage.html` | [10-EDITOR](10-EDITOR.md) | [04-SITE-BUILDER](04-SITE-BUILDER.md) |
| Trade packs | [04-SITE-BUILDER](04-SITE-BUILDER.md) | [10-EDITOR](10-EDITOR.md) |
| Preview / publish | [10-EDITOR](10-EDITOR.md) | [03-TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md) |
| Role × template gating | [10-EDITOR](10-EDITOR.md) | [02-DATABASE](02-DATABASE.md) |

### Templates & rendering

| Topic | Primary doc | Also see |
|-------|-------------|----------|
| `api/render.js` | [03-TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md) | [01-ARCHITECTURE](01-ARCHITECTURE.md) |
| Trade hydration | [03-TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md) | `marketplace/demos/demo-shared.js` |
| Agency / showcase | [03-TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md) | [05-PARTNERS](05-PARTNERS.md) |
| Broker templates | [03-TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md) | [04-SITE-BUILDER](04-SITE-BUILDER.md) |

### Partners & billing

| Topic | Primary doc | Also see |
|-------|-------------|----------|
| Partner lifecycle | [05-PARTNERS](05-PARTNERS.md) | [00-VISION](00-VISION.md) |
| Commissions | [05-PARTNERS](05-PARTNERS.md) | [01-ARCHITECTURE](01-ARCHITECTURE.md) |
| Buy-site flow | [05-PARTNERS](05-PARTNERS.md) | [03-TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md) |
| Billing / Stripe | [01-ARCHITECTURE](01-ARCHITECTURE.md) | [05-PARTNERS](05-PARTNERS.md) |

### Domains & hosting

| Topic | Primary doc | Also see |
|-------|-------------|----------|
| Domain purchase | [06-DOMAINS](06-DOMAINS.md) | `dreamscape.js` |
| Custom domain routing | [06-DOMAINS](06-DOMAINS.md) | [03-TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md) |
| DNS management | [06-DOMAINS](06-DOMAINS.md) | `manage-domains.html` |

### SEO & content

| Topic | Primary doc | Also see |
|-------|-------------|----------|
| Suburb pages | [08-SEO](08-SEO.md) | `lib/seo/*`, `app/[site]/[suburb]` |
| Landing pages | [08-SEO](08-SEO.md) | [10-EDITOR](10-EDITOR.md) |
| Local SEO tokens | [08-SEO](08-SEO.md) | [03-TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md) |
| Sitemap | [08-SEO](08-SEO.md) | `app/seo-sitemap.xml/route.js` |

### Leads & analytics

| Topic | Primary doc | Also see |
|-------|-------------|----------|
| Lead capture | [09-CRM](09-CRM.md) | `api/leads.js` |
| Mailer / campaigns | [09-CRM](09-CRM.md) | `api/send-campaign.js` |
| Event tracking | [07-TRACKING](07-TRACKING.md) | `api/events.js` |
| Dashboard metrics | [07-TRACKING](07-TRACKING.md) | [10-EDITOR](10-EDITOR.md) |

### Design & standards

| Topic | Primary doc | Also see |
|-------|-------------|----------|
| UI tokens | [11-DESIGN-SYSTEM](11-DESIGN-SYSTEM.md) | `manage.html` CSS |
| Tenant themes | [11-DESIGN-SYSTEM](11-DESIGN-SYSTEM.md) | [03-TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md) |
| Coding rules | [12-CODING-STANDARDS](12-CODING-STANDARDS.md) | [00-VISION](00-VISION.md) |
| Future work | [13-ROADMAP](13-ROADMAP.md) | All docs § Technical Debt |

---

## Key Source Files

| File | Documented in |
|------|---------------|
| `manage.html` | [10-EDITOR](10-EDITOR.md), [04-SITE-BUILDER](04-SITE-BUILDER.md) |
| `api/render.js` | [03-TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md), [01-ARCHITECTURE](01-ARCHITECTURE.md) |
| `*.template.json` | [03-TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md) |
| `dreamscape.js` | [06-DOMAINS](06-DOMAINS.md) |
| `lib/seo/*` | [08-SEO](08-SEO.md) |
| `api/leads.js` | [09-CRM](09-CRM.md) |
| `api/events.js` | [07-TRACKING](07-TRACKING.md) |
| `api/partner/*` | [05-PARTNERS](05-PARTNERS.md) |
| `partner-dashboard.html` | [05-PARTNERS](05-PARTNERS.md), [04-SITE-BUILDER](04-SITE-BUILDER.md) |

---

## Reading Order by Role

### Backend engineer

00 → 01 → 02 → 03 → 07 → 08 → 09 → 12

### Frontend / editor engineer

00 → 10 → 04 → 03 → 11 → 12

### Partner platform engineer

00 → 05 → 04 → 02 → 06 → 12

### DevOps / operator

00 → 01 → 06 → 02 → 13

---

## Document Maintenance

| Rule | Detail |
|------|--------|
| Update topic doc when behaviour changes | Not just INDEX |
| One doc per PR for major rewrites | Branch `cursor/docs-XX-name-99a9` |
| Cross-link related docs | Use relative links |
| Technical debt | Log in [13-ROADMAP](13-ROADMAP.md) |
| AI agents | Read 00 + 12 before code changes |

---

## External References

| Resource | URL / path |
|----------|------------|
| Repository | GitHub `coffeeguy77/leadpages` |
| Production | `leadpages.com.au`, `leadpages.webculture.au` |
| Supabase | Project dashboard (env vars) |
| Vercel | Deployment + domain config |
| Dreamscape | Reseller API docs |
| Cloudinary | Media CDN |
| Stripe | Billing + domain checkout |

---

## Glossary

| Term | Meaning |
|------|---------|
| **Command Centre** | `manage.html` editor |
| **Trade pack** | Starter config for a trade type |
| **Hydration** | Client JS filling template from config |
| **Publish** | Write `sites.config` to Supabase |
| **Go live** | Set `sites.status = 'live'` |
| **Mockup** | `is_mockup` demo site for sale |
| **Showcase** | Partner portfolio subdomain |
| **Service role** | Supabase server key bypassing RLS |

---

*This index is the entry point to the LeadPages engineering canon. Start with [00-VISION](00-VISION.md).*
