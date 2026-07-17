# 22 — AI Marketing Hub (Phase 9)

**Document:** `AI/22-MARKETING-HUB`  
**Status:** Implemented  
**Prerequisites:** Brain Phases 1–7; Google Ads connection APIs

---

## Goal

LeadPages-managed campaign assistance (plans, RSA copy) via Brain. **No Ads API mutate without a future explicit write flow.** Approve stores suggestions on the site only.

---

## Principles

1. Brain exclusively for copy/plan generation.  
2. Structured outputs for campaign plans and RSA assets.  
3. Never send OAuth refresh tokens into prompts — use `ads.summary` context slice only (redacted customer id + metrics).  
4. Explicit human approval before any Ads API write (Phase 9 approve = **store only**).

---

## Brain tasks

| Task ID | Output | Notes |
|---------|--------|-------|
| `ads.campaign_plan` | Structured plan | High scrutiny |
| `ads.rsa_copy` | Headlines / descriptions | ≤30 / ≤90 / path ≤15 enforced |

---

## Surfaces

| Piece | Path |
|-------|------|
| UI | `/marketing-hub` → `marketing-hub.html` (Ops Command panel) |
| Plan | `POST /api/brain/ads-campaign-plan` |
| RSA | `POST /api/brain/ads-rsa-copy` |
| Approve | `POST /api/brain/ads-approve` `{ kind: campaign_plan\|rsa_copy, payload }` → `sites.config.marketingHub` |
| Read metrics | Existing `GET /api/google-ads/status` (UI only; never put tokens in prompts) |

Flag: `BRAIN_MARKETING_HUB` (default **on**; set `0` to disable).

Stored shape: `config.marketingHub.latest` + `config.marketingHub.approved[]` with `adsMutated: false`.

---

## Related

- Roadmap Phase 9: [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md)  
- Status: [00-STATUS](00-STATUS.md)
