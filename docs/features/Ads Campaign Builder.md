# Ads Smart Campaign Builder

**Document:** `features/Ads Campaign Builder`  
**Status:** Phases 1–8 implemented behind feature flags  
**Audience:** Engineers enabling Ads mutations, tracking readiness, or GTM inspection  
**Prerequisites:** [features/Google Ads](Google%20Ads.md), [07-TRACKING](../07-TRACKING.md), [02-DATABASE](../02-DATABASE.md)

---

## What this is

Production Google Ads **Smart Campaign Builder** on top of the existing Ads OAuth / metrics sync / conversion upload stack. It does **not** replace sync or conversions.

| Capability | Default |
|------------|---------|
| Read-only Control Centre + campaign map sync | Opt-in via `GOOGLE_ADS_CAMPAIGN_BUILDER=1` |
| Draft plans (page / site / AI / Coffee Events pilot) | Same flag; superuser-only by default |
| Create Search campaigns | `GOOGLE_ADS_CAMPAIGN_MUTATIONS=1` — **always PAUSED** |
| Enable / publish live | `GOOGLE_ADS_CAMPAIGN_PUBLISH=1` (kept off) |
| Pause / resume | `GOOGLE_ADS_STATUS_MUTATIONS=1` |
| Budget changes | `GOOGLE_ADS_BUDGET_MUTATIONS=1` |
| GTM OAuth + inspect | `GTM_INTEGRATION=1` |
| Managed GTM publish | `GTM_MANAGED_PUBLISH=1` (blocked / not implemented for pilot) |

---

## Schema

Apply once in Supabase:

```text
db/ads_campaign_builder_schema.sql
```

Key tables: `ads_campaign_maps`, `ads_campaign_plans`, `ads_campaign_builds`, `ads_campaign_resources`, `ads_conversion_goal_maps`, `tracking_readiness_checks`, `ads_recommendations`, `ads_audit_log`, `ads_sync_state`, `gtm_connections`, `gtm_oauth_states`, `gtm_containers`.

Google resource IDs are **text** (never assume JS-safe integers).

---

## APIs

| Route | Role |
|-------|------|
| `GET/POST /api/google-ads/builder` | Overview, plan_*, readiness, sync_campaigns, recommendations, create_paused, pause, resume, change_budget |
| `POST /api/google-ads/sync` | Metrics sync; when builder flag on, also refreshes `ads_campaign_maps` |
| `GET/POST /api/integrations/tag-manager/*` | connect, callback, exchange, status, disconnect, publish (gated) |
| Settings UI | `/settings/integrations/tag-manager` |

Auth: Bearer session via `lib/brain/http.js` (`requireUser` + `assertSiteAccess`).

---

## Manage UI

Advertising tab → **Campaign Builder** and **Tracking readiness**.

- Landing page + daily budget are **user-selected** (never invented).
- Create always PAUSED.
- External / imported campaigns (e.g. Bean Culture) require `confirmExternal`.

---

## Tracking

- Contract: `lib/tracking/events-contract.js`
- Client: `assets/lp-events.js` (`LPEvents.emit`) injected from `api/render.js`
- `api/events.js` normalizes aliases; test events skip Ads upload

---

## Coffee Events pilot

- Site: `coffeeevents.com.au`
- Service / geo defaults: Coffee Cart Hire / Canberra
- Protect external campaigns; do not invent budget or landing URL
- Recommended flag set for pilot:

```bash
GOOGLE_ADS_CAMPAIGN_BUILDER=1
GOOGLE_ADS_CAMPAIGN_BUILDER_SUPERUSER_ONLY=1
GOOGLE_ADS_CAMPAIGN_MUTATIONS=0   # set 1 only when ready to create paused
GOOGLE_ADS_CAMPAIGN_PUBLISH=0
GOOGLE_ADS_BUDGET_MUTATIONS=0
GOOGLE_ADS_STATUS_MUTATIONS=0
GTM_INTEGRATION=1
GTM_MANAGED_PUBLISH=0
GTM_CLIENT_ID=
GTM_CLIENT_SECRET=
GTM_REDIRECT_URI=https://app.leadpages.com.au/api/integrations/tag-manager/callback
```

Allowlist the GTM callback URI in Google Cloud OAuth.

---

## Code map

| Area | Path |
|------|------|
| Flags / safety | `lib/google-ads/flags.js`, `safety.js` |
| Planner / mutate | `lib/google-ads/planner.js`, `mutate.js` |
| Readiness / recs / audit | `lib/google-ads/readiness.js`, `recommendations.js`, `audit.js` |
| Campaign inventory sync | `lib/google-ads/campaign-sync.js` |
| Builder HTTP | `api/google-ads/builder.js`, `lib/google-ads/builder-http.js` |
| GTM | `lib/gtm/oauth.js`, `api/integrations/tag-manager/*` |

---

## Related

- [Google Ads (base)](Google%20Ads.md) — OAuth, conversions, Advertising dashboard
- [Tracking](Tracking.md) / [07-TRACKING](../07-TRACKING.md)
