# 20 — Future Capabilities

**Document:** `AI/20-FUTURE-CAPABILITIES`  
**Status:** Forward-looking — **not V1 scope**  
**Prerequisites:** [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md)

---

## Brain-powered product surfaces (later)

| Surface | Brain needs | Notes |
|---------|-------------|-------|
| AI Theme Studio | Context, vision/logo, structured theme tokens, refine, a11y review, preview/approve | Output must match theme engine / `api/render.js` — not uncontrolled HTML |
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

## Theme Studio dependency (high level)

Business context → brand/logo analysis → theme-token generation → layout hints → structured config → validate against theme engine → version history → **user preview/approve** → merge into `sites.config`.

## Marketing Hub dependency (high level)

Business + site analysis → plan structured campaigns → RSA copy → recommendations → **explicit user approval** → Google Ads API writes via existing `lib/google-ads/*` (not Brain talking to Ads directly for auth — Brain plans; Ads client executes after approval).

Detailed Theme Studio and Marketing Hub specs are **separate future projects**.

---

## Related

- Principles: [02-VISION-AND-PRINCIPLES](02-VISION-AND-PRINCIPLES.md)  
- Google Ads current surface: [features/Google Ads](../features/Google%20Ads.md)
