# LeadPages Brain

**Document:** `AI/README`  
**Status:** Documentation phase only — **no Brain implementation has begun**  
**Audience:** Engineers, product owners, AI development agents  
**Prerequisites:** [INDEX](../INDEX.md), [01-ARCHITECTURE](../01-ARCHITECTURE.md), [00-VISION](../00-VISION.md)

---

## What it is

**LeadPages Brain** is the proposed provider-agnostic AI orchestration layer for the LeadPages platform. Every current and future AI feature should eventually call the Brain instead of calling OpenAI, Anthropic, Google Gemini, or any other provider directly.

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

## Why it is being built

Today, verified AI usage is **Anthropic Claude only**, via scattered `fetch` calls and inline prompts (see [01-CURRENT-STATE-AUDIT](01-CURRENT-STATE-AUDIT.md)). There is no shared gateway, no usage/cost ledger, no prompt registry, and one broken client-side draft path.

LeadPages is evolving from a website builder into an AI-powered business platform. Future systems (Theme Studio, Marketing Hub, SEO, CRM, quoting, etc.) must share one internal AI service so providers can be changed, combined, or tested without rewriting each feature.

---

## Current project status

| Item | Status |
|------|--------|
| Repository audit | Complete (docs phase) |
| Architecture & contracts | Proposed in this folder |
| Provider SDKs / Brain runtime | **Not started** |
| Migrations / new API routes | **Not started** |
| Theme Studio / Marketing Hub product builds | **Out of scope** (depend on Brain later) |

**Phase:** Phase 0 — Documentation and approval. Stop here until owners approve Phase 1.

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
| [14-AI-CONTROL-CENTRE](14-AI-CONTROL-CENTRE.md) | Superuser ops UI (proposed) |
| [15-TESTING-STRATEGY](15-TESTING-STRATEGY.md) | Test pyramid for Brain |
| [16-MIGRATION-PLAN](16-MIGRATION-PLAN.md) | Safe move off direct Claude calls |
| [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md) | Phases 0–9 |
| [18-RISKS-AND-DECISIONS](18-RISKS-AND-DECISIONS.md) | Risks, ADRs, open questions |
| [19-DEVELOPER-GUIDE](19-DEVELOPER-GUIDE.md) | How features will call Brain |
| [20-FUTURE-CAPABILITIES](20-FUTURE-CAPABILITIES.md) | Theme Studio, Marketing Hub, beyond V1 |

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

## Notice

This folder is **design documentation only**. No provider SDKs, Brain API routes, database migrations, environment variables, or production behaviour changes were introduced as part of this phase.
