# Search Intelligence — Connectors

**Document:** `search-intelligence/03-CONNECTORS`  
**Status:** GSC + GA4 OAuth, property select, GSC + GA4 landing sync + cron; keyword research gateway  
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

Search Intelligence reuses the same pattern via [`lib/search-intelligence/google-oauth/`](../../lib/search-intelligence/google-oauth/).

---

## Reserved paths

| Connector | Connect UI | Callback | Exchange |
|-----------|------------|----------|----------|
| Search Console | `/settings/integrations/search-console` | `/api/integrations/search-console/callback` | `/api/integrations/search-console/exchange` |
| GA4 | `/settings/integrations/google-analytics` | `/api/integrations/google-analytics/callback` | `/api/integrations/google-analytics/exchange` |
| GBP | `/settings/integrations/google-business` | Phase 3 | Phase 3 |

Ads remains at `/settings/integrations/google-ads`.

Storage: `si_connections` + `si_oauth_states` (see [02-DATA-MODEL.md](02-DATA-MODEL.md)).  
**Ops:** apply [`db/search_intelligence_schema.sql`](../../db/search_intelligence_schema.sql) before live Connect (do not apply wholesale without review).

---

## Phase 1 — Google Search Console

**Purpose:** Organic clicks, impressions, CTR, average position, query/page mapping; sitemap submit/refresh coordination.

**Env (platform):**
- `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`
- optional `GSC_REDIRECT_URI` (defaults to `APP_URL` + callback path)
- `SI_OAUTH_ENCRYPTION_KEY` (Base64 32 bytes) **or** reuse `GOOGLE_ADS_OAUTH_ENCRYPTION_KEY`
- optional `SI_OAUTH_STATE_SECRET` / `GOOGLE_ADS_STATE_SECRET`

**Routes:**  
- Settings UI: `/settings/integrations/search-console`  
- `GET /api/integrations/search-console/status?siteId=`  
- `POST /api/integrations/search-console/connect` → `{ ok, url }` Google authorize redirect  
- `GET /api/integrations/search-console/callback` → HTML relay  
- `POST /api/integrations/search-console/exchange` → encrypt + upsert `si_connections`  
- `GET /api/integrations/search-console/properties?siteId=` → list GSC sites  
- `POST /api/integrations/search-console/save-property` → `{ siteId, propertyId }`  
- `POST /api/integrations/search-console/sync` → query×page → `si_query_page_stats`  
- Cron: `/api/cron/sync-search-intelligence` every 6h (`vercel.json`)

**Scopes:** Search Console read (`webmasters.readonly`) + OpenID email.

**Property mapping:** `site_id` → GSC property URL (domain or URL-prefix) stored on `si_connections.property_id`.

**Sync:** Manual + cron pull search analytics (query × page) into `si_query_page_stats` for the selected window (default 28d).

**Note:** Existing GSC **verification** (meta / DNS TXT / CNAME) stays in Settings → Search & indexing. Command Centre owns **API insights**.

---

## Phase 1 — GA4

**Purpose:** Sessions, engagement, landing-page conversions aligned with Leadpages form/call events.

**Env:** `GA4_CLIENT_ID`, `GA4_CLIENT_SECRET`, optional `GA4_REDIRECT_URI` (+ same encryption / state secrets as GSC)

**Routes:** `/settings/integrations/google-analytics`, `/api/integrations/google-analytics/{status,connect,callback,exchange,properties,save-property,sync}`

**Mapping:** `site_id` → GA4 property id on `si_connections.property_id` (+ `property_meta.propertyResource`).

**Sync:** Landing-page report (sessions, engaged sessions, conversions, bounce rate) → `si_ga4_landing_stats`. Included in `/api/cron/sync-search-intelligence`.

---

## Page performance (from GSC)

`lib/search-intelligence/page-performance.js` aggregates `si_query_page_stats` by URL and emits:

- High impressions / low CTR findings (`high_impr_low_ctr` recipe)  
- Light cannibalisation when the same query tops multiple pages  

Manage → SEO Command → **Pages** tab; findings also merge into Next Best Actions.

---

## Keyword research API

`GET/POST /api/search-intelligence/keywords?siteId=&keyword=` uses the provider gateway (`mock` by default; set `SI_KEYWORD_PROVIDER=dataforseo` + credentials for live). Scores ideas with opportunity-value.

---

## Organic attribution (first-party, live)

`lib/search-intelligence/attribution-organic.js` rolls up `call_click` + `lead_submit` events for a site window:

- Prefers `visitor_sessions.traffic_source = organic` when `session_id` is present  
- Falls back to event props / UTM medium=organic (excludes Ads click ids)  
- Surfaces on Command Centre **Search leads** card via overview API  

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

## First-party HTML crawl (opt-in)

`lib/search-intelligence/audit/html-crawl.js` fetches the public homepage when overview is called with `?crawl=1`:

- Allowlisted origins only (custom domain or `SI_PUBLIC_SITE_ORIGIN` + slug) — SSRF-safe  
- Compares live title / meta / canonical / robots to `sites.config`  
- Findings merge into Next Best Actions (`evidence.source: html_crawl`)  
- Manage → SEO Command → **Next Best Actions** tab requests crawl automatically  

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

- [x] Tokens never in `NEXT_PUBLIC_*` or client HTML  
- [x] Encrypt at rest (`enc:v1:` via SI or Ads encryption key)  
- [x] Least-privilege scopes; re-consent on expansion (`prompt=consent`)  
- [ ] Tenant isolation on all connector reads (status/connect already site-scoped; sync TBD)  
- [ ] Audit log for connect/disconnect/sync failures  
- [x] One-time OAuth state nonce (`si_oauth_states`)  
