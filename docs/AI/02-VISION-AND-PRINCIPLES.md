# 02 — Vision and Principles

**Document:** `AI/02-VISION-AND-PRINCIPLES`  
**Status:** Proposed (documentation phase)  
**Audience:** Product owners, architects, engineers  
**Prerequisites:** [README](README.md), [01-CURRENT-STATE-AUDIT](01-CURRENT-STATE-AUDIT.md), [00-VISION](../00-VISION.md)

---

## Vision

LeadPages becomes an AI-powered business platform where every AI capability shares one internal orchestration service — the **LeadPages Brain** — so the product can improve models, control cost, and stay provider-independent without rewriting features.

The Brain is infrastructure. Theme Studio, Marketing Hub, SEO, CRM, quoting, and support are **consumers**.

---

## Operating rule

> **AI suggests. The user previews. The user approves and publishes.**

Consequential actions (publish site config, create/edit/pause Google Ads, spend budgets, send customer email at scale) require explicit human approval in initial releases.

### Future exceptions (explicit permission only)

| Exception | Requirement |
|-----------|-------------|
| Automated Ads optimisation (budget/bid/pause) | Separate product decision + audit trail + kill switch + per-account opt-in |
| Scheduled report generation | Read-only by default; send only if user enabled |
| Background enrichment (e.g. IG captions) | Allowed when scoped, rate-limited, and reversible; already exists in limited form |

No silent autonomous advertising changes without an approved automation policy.

---

## Permanent principles

| # | Principle | Meaning |
|---|-----------|---------|
| 1 | Provider independence | Features never import OpenAI/Anthropic/Gemini SDKs |
| 2 | One internal AI gateway | All model calls go through Brain |
| 3 | Structured outputs by default | Schema validate before write |
| 4 | Server-side provider calls only | Keys never in browsers or public config |
| 5 | Secure secret handling | Vercel/env or vault; rotate-able; never logged |
| 6 | Human preview before consequential publish | Aligns with editor Publish model |
| 7 | Business-context reuse | Shared resolver; no per-feature reinventing site context |
| 8 | Prompt versioning | Prompt IDs + versions; rollback; audit |
| 9 | Complete observability | Correlation ID, tokens, cost, latency, outcome |
| 10 | Cost accountability | Attribute to account/partner/site/feature/task |
| 11 | Role-aware access | Super / partner / client / public policies |
| 12 | Tenant isolation | No cross-site or cross-partner leakage |
| 13 | Graceful provider fallback | Configurable; never silent quality cliff without log |
| 14 | Testability | Mock provider; contract tests; eval sets |
| 15 | Backwards-compatible migration | Feature flags; one feature at a time |
| 16 | No silent Ads autonomy | See operating rule |
| 17 | No cross-client data leakage | Context redaction + ownership checks |

---

## Alignment with platform rules

Brain design must respect existing non-negotiables from [CLAUDE.md](../../CLAUDE.md) and [12-CODING-STANDARDS](../12-CODING-STANDARDS.md):

- Never wipe `sites.config` — merge only  
- Never remove editor options without approval  
- Public leads/events fail safe  
- No framework rewrite without approval  

---

## Anti-goals (documentation phase and V1)

- Multi-agent swarms in V1  
- Uncontrolled permanent storage of all conversations  
- Customer-facing “bring your own key” in V1 (**open decision**)  
- Generating one-off HTML that bypasses the theme/renderer contracts  

---

## Related

- Architecture: [03-TARGET-ARCHITECTURE](03-TARGET-ARCHITECTURE.md)  
- Security: [11-SECURITY-AND-PERMISSIONS](11-SECURITY-AND-PERMISSIONS.md)  
- Risks: [18-RISKS-AND-DECISIONS](18-RISKS-AND-DECISIONS.md)
