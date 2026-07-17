# 22 — AI Marketing Hub (Phase 9 product spec)

**Document:** `AI/22-MARKETING-HUB`  
**Status:** Spec stub — not implemented  
**Prerequisites:** Brain Phases 1–7; Google Ads connection docs  

---

## Goal

LeadPages-managed campaign assistance (plans, RSA copy suggestions) via Brain, distinct from a customer’s other site campaigns (e.g. WordPress). **No mutate without approval.**

---

## Principles

1. Brain exclusively for copy/plan generation.  
2. Structured outputs for campaign plans and RSA assets.  
3. Never send OAuth refresh tokens into prompts — use `ads.summary` context slice only.  
4. Explicit human approval before any Ads API write.  

---

## Proposed Brain tasks

| Task ID | Output | Notes |
|---------|--------|-------|
| `ads.campaign_plan` | Structured plan | High scrutiny |
| `ads.rsa_copy` | Headlines / descriptions | Character limits enforced in schema |

---

## Out of scope for this stub

- Full Hub UI  
- Autonomous bid/budget changes  
- Cross-account creative sync  

---

## Related

- Roadmap Phase 9: [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md)  
- Business context: [07-BUSINESS-CONTEXT](07-BUSINESS-CONTEXT.md)
