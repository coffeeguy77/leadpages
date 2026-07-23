# Search Intelligence — Connectors

**Document:** `search-intelligence/03-CONNECTORS`  
**Status:** OAuth and sync design (docs-first; no live wiring this pass)  
**Prerequisites:** [01-ARCHITECTURE.md](01-ARCHITECTURE.md), [../features/Google Ads.md](../features/Google Ads.md)

---

## Pattern to copy

Google Ads OAuth on `app.leadpages.com.au`:

- Connect UI under `/settings/integrations/…`
- Callback under `/api/integrations/…/callback`
- Identical redirect URI for authorize and token exchange
- Refresh tokens as `enc:v1:` AES-256-GCM
- Nonce table for state replay protection

See [`db/google_ads_schema.sql`](../../db/google_ads_schema.sql) and [`api/integrations/google-ads/`](../../api/integrations/google-ads/).

---

## Reserved paths

| Connector | Connect UI (future) | Callback |
|-----------|---------------------|----------|
| Search Console | `/settings/integrations/search-console` | `/api/integrations/search-console/callback` |
| GA4 | `/settings/integrations/google-analytics` | `/api/integrations/google-analytics/callback` |
| GBP | `/settings/integrations/google-business` | Phase 3 |

Ads remains at `/settings/integrations/google-ads`.

Storage: `si_connections` + `si_oauth_states` (see [02-DATA-MODEL.md](02-DATA-MODEL.md)).

---

## Phase 1 — Google Search Console

**Purpose:** Organic clicks, impressions, CTR, average position, query/page mapping; sitemap submit/refresh coordination.

**Env (platform):** `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, optional `GSC_REDIRECT_URI`  
**Routes (scaffold):**  
- Settings UI: `/settings/integrations/search-console`  
- `GET/POST /api/integrations/search-console/status`  
- `POST /api/integrations/search-console/connect` → `not_configured` or `oauth_exchange_pending`  

**Scopes (indicative):** Search Console read (`webmasters.readonly`) + OpenID email.

**Property mapping:** `site_id` → GSC property URL (domain or URL-prefix) → optional verified domain already stored via Settings → Search & indexing.

**Sync jobs (next):** Daily search analytics → `si_query_page_stats`.

**Note:** Existing GSC **verification** (meta / DNS TXT / CNAME) stays in Settings → Search & indexing. Command Centre owns **API insights**.

---

## Phase 1 — GA4

**Purpose:** Sessions, engagement, landing-page conversions aligned with Leadpages form/call events.

**Env:** `GA4_CLIENT_ID`, `GA4_CLIENT_SECRET`, optional `GA4_REDIRECT_URI`  
**Routes (scaffold):** `/settings/integrations/google-analytics`, `/api/integrations/google-analytics/{status,connect}`

**Mapping:** `site_id` → GA4 property id (+ optional data stream).

**Sync (next):** Landing-page and conversion aggregates; join to `visitor_sessions` / lead events where possible.

---

## First-party config audit (live now)

`lib/search-intelligence/audit/config-audit.js` inspects `sites.config` and feeds Next Best Actions without crawling HTML:

- Missing homepage title / meta  
- Published landings missing title / meta  
- Duplicate titles (cannibalisation)  
- Service Areas on but empty  
- No phone and no quote path  
- Premium Gallery on without images  

Command Centre overview loads site config and surfaces these as `status: open` actions.

---

## Ads bridge (Phase 4 full; light reuse earlier)

Ads connection already exists. Shared keyword universe and SEO↔PPC matrix land in Phase 4. Phase 1 may read CPC from licensed provider or Ads Keyword Planner where permitted — document source on each metric.

---

## Phase 3 — Google Business Profile

Subject to Google API access:

- Locations, categories, hours, service areas
- Posts, reviews (reply with human approval)
- Performance: calls, website clicks, directions, search keyword impressions

---

## Leadpages first-party (always on)

| Signal | Source |
|--------|--------|
| Form submissions | Lead events |
| Call clicks | Call-click events + `visitor_sessions` |
| Quote requests | Quote / online quote events |
| Page publish / config changes | Annotations (Phase 2) |

No provisioned call-tracking numbers in Phase 1.

---

## Security checklist

- [ ] Tokens never in `NEXT_PUBLIC_*` or client HTML  
- [ ] Encrypt at rest; revoke on disconnect  
- [ ] Least-privilege scopes; re-consent on expansion  
- [ ] Tenant isolation on all connector reads  
- [ ] Audit log for connect/disconnect/sync failures  
