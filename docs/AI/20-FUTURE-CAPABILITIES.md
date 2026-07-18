# 20 — Future Capabilities

**Document:** `AI/20-FUTURE-CAPABILITIES`  
**Status:** Forward-looking — **not V1 scope**  
**Prerequisites:** [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md)

---

## Brain-powered product surfaces (later)

| Surface | Brain needs | Notes |
|---------|-------------|-------|
| Website Studio | Full-site concepts via Composer + Marketplace Intelligence + Image Service | Canonical: [docs/website-studio](../website-studio/README.md). Legacy paths `/theme-studio-v2` |
| AI Colour Assistant | Structured theme tokens only | Separate from Website Studio; `/theme-studio` |
| AI Marketing Hub | Site analysis, keywords, negatives, campaign/ad-group plans, RSA copy, budgets, LP analysis, optimisation suggestions | LeadPages-managed campaigns distinct from customer’s other properties (e.g. WordPress). **No mutate without approval** initially |
| AI SEO Studio | Recommendations, meta, suburb/landing assist | Builds on `lib/seo/*` |
| AI Content Studio | Long-form page/service copy | Extends landing draft |
| AI Image Studio | Image prompts / generation adapters | New capabilities |
| AI CRM / lead qualification | Structured scores | Uses `leads` carefully |
| AI quoting | Suggestions for quote-system | No silent price publish |
| AI analytics / reporting | Summaries over `event_daily` / Ads metrics | |
| AI support | Extends assist | |
| AI business advisor | Multi-slice context | High caution |
| Workflow automation | Multi-step with approvals | |
| Multi-agent workflows | Orchestration layer on Brain | Post-foundation |
| Private / customer model policies | Router constraints | |
| Evaluation & benchmarking | Eval framework | |

---

## Website Studio dependency (high level)

Brief → Marketplace Intelligence → Website Composer → Image Service → draft config → renderer preview → **user approve** → publish via existing editor paths.  
Detail: [docs/website-studio/ARCHITECTURE](../website-studio/ARCHITECTURE.md).

## AI Colour Assistant dependency (high level)

Business context → theme-token generation → validate → **user preview/approve** → merge theme tokens into `sites.config` only.

## Marketing Hub dependency (high level)

Business + site analysis → plan structured campaigns → RSA copy → recommendations → **explicit user approval** → Google Ads API writes via existing `lib/google-ads/*` (not Brain talking to Ads directly for auth — Brain plans; Ads client executes after approval).

Website Studio, Colour Assistant, and Marketing Hub remain separate product surfaces.

---

## Related

- Principles: [02-VISION-AND-PRINCIPLES](02-VISION-AND-PRINCIPLES.md)  
- Google Ads current surface: [features/Google Ads](../features/Google%20Ads.md)
