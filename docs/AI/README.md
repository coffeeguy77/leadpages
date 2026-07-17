# LeadPages Brain

**Document:** `AI/README`  
**Status:** Phases 0–7 shipped — see [00-STATUS](00-STATUS.md)  
**Audience:** Engineers, product owners, AI development agents  
**Prerequisites:** [INDEX](../INDEX.md), [01-ARCHITECTURE](../01-ARCHITECTURE.md), [00-VISION](../00-VISION.md)

> **AI agents:** start at [00-STATUS](00-STATUS.md) before changing AI-related code.

---

## What it is

**LeadPages Brain** is the provider-agnostic AI orchestration layer for the LeadPages platform. Every current and future AI feature should call the Brain instead of calling OpenAI, Anthropic, Google Gemini, or any other provider directly.

```text
Feature → LeadPages Brain → Selected provider adapter
```

Not:

```text
Feature → OpenAI
Feature → Anthropic
Feature → Gemini
```

---

## Why it was built

Historically, AI usage was **Anthropic Claude only**, via scattered `fetch` calls and inline prompts (see [01-CURRENT-STATE-AUDIT](01-CURRENT-STATE-AUDIT.md)). Landing drafts were broken client-side (no key). Brain now provides a shared gateway, adapters (mock / Anthropic / OpenAI / Gemini), prompt registry, context slices, Control Centre, and the first migrated feature (landing drafts).

Legacy callers (assist, suburb intros, trade packs, IG enrich) still hit Anthropic directly until later migrations.

---

## Current project status

| Item | Status |
|------|--------|
| Repository audit | Complete |
| Architecture & contracts | Complete in this folder |
| Phase 1–4 foundation | **Complete** — gateway, mock, Anthropic, prompts, context, resilience |
| OpenAI + Gemini adapters | **Phase 5 complete** — raw `fetch`; `BRAIN_PROVIDER=openai\|gemini\|anthropic\|mock` |
| AI Control Centre | **Phase 6 complete** — `/brain-admin` + `GET/POST /api/brain/control` (super-admin) |
| Landing draft migration | **Phase 7 complete** — `POST /api/brain/landing-draft`; manage.html calls server; flag `BRAIN_LANDING_DRAFT=1` |
| Theme Studio / Marketing Hub | Colour MVP [21](21-THEME-STUDIO.md); **V2 Phases 1–2** [23](23-THEME-STUDIO-V2.md); Marketing Hub [22](22-MARKETING-HUB.md) |

**Phase:** Phases 0–7 shipped in code. Theme Studio / Marketing Hub remain separate product builds.

---

## Important architectural rules

1. **One internal AI gateway** — features never import provider SDKs.
2. **Server-side provider calls only** — no browser keys.
3. **Structured outputs by default** — validate before writing `sites.config` or DB.
4. **AI suggests; user previews; user approves and publishes** — especially Ads and publish paths.
5. **Tenant isolation** — no cross-site / cross-partner context leakage.
6. **Observability and cost accountability** — every Brain call is attributable.
7. **Backwards-compatible migration** — migrate one small feature first behind a flag.

Full principles: [02-VISION-AND-PRINCIPLES](02-VISION-AND-PRINCIPLES.md).

---

## Documentation index

| Doc | Topic |
|-----|--------|
| [00-STATUS](00-STATUS.md) | **Canonical current status for AI agents** |
| [01-CURRENT-STATE-AUDIT](01-CURRENT-STATE-AUDIT.md) | Verified existing AI integrations |
| [02-VISION-AND-PRINCIPLES](02-VISION-AND-PRINCIPLES.md) | Permanent rules |
| [03-TARGET-ARCHITECTURE](03-TARGET-ARCHITECTURE.md) | Components, flows, diagrams |
| [04-PROVIDER-ADAPTERS](04-PROVIDER-ADAPTERS.md) | Common provider interface |
| [05-TASK-ROUTER](05-TASK-ROUTER.md) | Task-based routing policies |
| [06-PROMPT-ENGINE](06-PROMPT-ENGINE.md) | Prompt registry & versioning |
| [07-BUSINESS-CONTEXT](07-BUSINESS-CONTEXT.md) | Shared site/account context |
| [08-MEMORY-ARCHITECTURE](08-MEMORY-ARCHITECTURE.md) | Cautious memory design |
| [09-STRUCTURED-OUTPUTS](09-STRUCTURED-OUTPUTS.md) | Schema-first responses |
| [10-OBSERVABILITY-AND-COSTS](10-OBSERVABILITY-AND-COSTS.md) | Usage, latency, spend |
| [11-SECURITY-AND-PERMISSIONS](11-SECURITY-AND-PERMISSIONS.md) | Threat model & RBAC |
| [12-DATA-MODEL](12-DATA-MODEL.md) | Proposed tables (no migrations yet) |
| [13-INTERNAL-API-CONTRACTS](13-INTERNAL-API-CONTRACTS.md) | Brain generate/stream APIs |
| [14-AI-CONTROL-CENTRE](14-AI-CONTROL-CENTRE.md) | Superuser ops UI |
| [15-TESTING-STRATEGY](15-TESTING-STRATEGY.md) | Test pyramid for Brain |
| [16-MIGRATION-PLAN](16-MIGRATION-PLAN.md) | Safe move off direct Claude calls |
| [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md) | Phases 0–9 |
| [18-RISKS-AND-DECISIONS](18-RISKS-AND-DECISIONS.md) | Risks, ADRs, open questions |
| [19-DEVELOPER-GUIDE](19-DEVELOPER-GUIDE.md) | How features will call Brain |
| [20-FUTURE-CAPABILITIES](20-FUTURE-CAPABILITIES.md) | Beyond V1 |
| [21-THEME-STUDIO](21-THEME-STUDIO.md) | Colour MVP (future AI Colour Assistant) |
| [22-MARKETING-HUB](22-MARKETING-HUB.md) | Phase 9 Marketing Hub |
| [23-THEME-STUDIO-V2](23-THEME-STUDIO-V2.md) | Theme Studio V2 Phases 1–2 foundations |
| [THEME-STUDIO-IMPLEMENTATION-AUDIT](THEME-STUDIO-IMPLEMENTATION-AUDIT.md) | Rebuild audit + phased plan |

---

## Proposed implementation phases (summary)

| Phase | Focus |
|-------|--------|
| **0** | This documentation set + owner approval |
| **1** | Core interfaces, mock provider, tests |
| **2** | First real provider adapter (Anthropic — matches today’s stack) |
| **3** | Prompt registry + business context resolver |
| **4** | Router, retries, fallbacks, flags, cost controls |
| **5** | Additional providers |
| **6** | AI Control Centre (superuser) |
| **7** | First migration of smallest existing feature |
| **8+** | Theme Studio / Marketing Hub (separate specs) |

Detail: [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md).

---

## Runtime entry

```js
const { getPlatformBrain } = require('../../lib/brain/platform');
const brain = getPlatformBrain(); // mock routes by default — no API keys

const result = await brain.generate({
  taskId: 'seo.suburb_intro',
  promptId: 'seo.suburb_intro',
  siteId: site.id,
  site,
  actor: { userId, role: 'client' },
  contextSlices: ['site.identity'],
  input: { suburb: 'Belconnen', trade: 'plumber' }
});

// Provider: BRAIN_PROVIDER=anthropic|openai|gemini|mock
// Landing drafts: BRAIN_LANDING_DRAFT=1 → POST /api/brain/landing-draft
// Control Centre: /brain-admin (super-admin)
```

Tests: `tests/brain-phase*.test.js`, `tests/brain-anthropic.test.js`.

## Notice

Phases 1–7 are implemented in **`lib/brain`**, Control Centre, and the landing-draft migration. Durable `ai_requests` DB tables and remaining feature migrations (assist, suburb, packs) are still future work.
