# Google Ads Integration (Base / v1)

**Document:** `features/Google Ads`  
**Status:** Engineering reference for the Advertising area + OAuth on the app domain  
**Audience:** Engineers extending Ads OAuth, conversion upload, or reporting  
**Prerequisites:** [07-TRACKING](../07-TRACKING.md), [features/Tracking](Tracking.md), [features/Pages](Pages.md)

---

## Production application domain

The permanent logged-in application origin is:

**`https://app.leadpages.com.au`**

This subdomain is the main LeadPages application domain for Command Centre, settings, and **all current and future platform integrations** (Google Ads, Analytics, Search Console, Meta, Xero, etc.). It is not exclusive to Google Ads.

| Surface | URL |
|---------|-----|
| Application origin | `https://app.leadpages.com.au` |
| Google Ads connection page | `https://app.leadpages.com.au/settings/integrations/google-ads` |
| Google Ads OAuth callback | `https://app.leadpages.com.au/api/integrations/google-ads/callback` |
| Public privacy | `https://leadpages.com.au/privacy` |
| Public terms | `https://leadpages.com.au/terms` |

Public marketing / tenant URLs on `leadpages.com.au` are intentional and must **not** be rewritten to the app subdomain.

---

## OAuth configuration (critical)

### Redirect URI rules

- Authorize **and** token exchange use the **identical** redirect URI.
- The URI is taken only from environment variables (`GOOGLE_ADS_REDIRECT_URI` or `APP_URL` + path).
- **Never** build the callback from the request `Host` / `X-Forwarded-Host` header.
- Preview deployments must set their own `APP_URL` / `GOOGLE_ADS_REDIRECT_URI` — they must not silently inherit production.

### Environment variables (Vercel Production)

```bash
APP_URL=https://app.leadpages.com.au
GOOGLE_ADS_REDIRECT_URI=https://app.leadpages.com.au/api/integrations/google-ads/callback
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=          # optional MCC
GOOGLE_ADS_OAUTH_ENCRYPTION_KEY=       # required — Base64 of 32 random bytes (see below)
GOOGLE_ADS_API_VERSION=v22             # optional; default v22 (v18 is sunset and returns HTML 404)
```

Optional: `GOOGLE_ADS_STATE_SECRET` (defaults to encryption key / client secret).

`GOOGLE_ADS_OAUTH_ENCRYPTION_KEY` is **required** before Connect succeeds. Preferred value:

```bash
openssl rand -base64 32
```

That produces ~44 characters of standard Base64 decoding to **exactly 32 bytes**, used as the raw AES-256-GCM key. Also accepted: 64 hex chars, or a legacy UTF-8 passphrase ≥32 characters (hashed with SHA-256). After adding/changing the env var in Vercel, **redeploy** Production so serverless functions see it.

Safe check (signed in): `GET /api/integrations/google-ads/encryption-diag` → `{ configured, rawLength, decodedByteLength, runtime, vercelEnvironment }` (never returns the key).

Refresh tokens are stored as `enc:v1:` AES-256-GCM blobs in `google_ads_connections.refresh_token` (IV + auth tag + ciphertext). Key rotation is not supported in v1 — re-connect after a key change.

**Do not** expose secrets via `NEXT_PUBLIC_*` or client-side code. The Supabase **anon** key may appear in HTML (public by design); OAuth client secret, developer token, and encryption key must stay server-only.

### Local development

```bash
APP_URL=http://localhost:3000
GOOGLE_ADS_REDIRECT_URI=http://localhost:3000/api/integrations/google-ads/callback
```

Use a separate Google Cloud OAuth client (or add the localhost redirect on a dev client).

### Google Cloud Console checklist

Authorized JavaScript origin:

```
https://app.leadpages.com.au
```

Authorized redirect URI (exact match — protocol, host, path, no trailing slash):

```
https://app.leadpages.com.au/api/integrations/google-ads/callback
```

Authorized domain:

```
leadpages.com.au
```

---

## Integration route layout (future-proof)

Callbacks are integration-specific under the shared app domain:

```
/api/integrations/google-ads/callback
/api/integrations/google-analytics/callback   (future — Search Intelligence Phase 1)
/api/integrations/search-console/callback     (future — Search Intelligence Phase 1)
/api/integrations/meta/callback               (future)
/api/integrations/xero/callback               (future)
```

**Search Intelligence** will reuse this OAuth/encryption pattern for Search Console and GA4, and later share a keyword universe with Ads (Phase 4). See [../search-intelligence/03-CONNECTORS.md](../search-intelligence/03-CONNECTORS.md) and [../search-intelligence/00-VISION.md](../search-intelligence/00-VISION.md).

Shared helpers live in [`lib/app-url.js`](../../lib/app-url.js) (not AdWords-named). Google Ads OAuth handlers:

| Route | File |
|-------|------|
| `POST/GET /api/integrations/google-ads/connect` | [`api/integrations/google-ads/connect.js`](../../api/integrations/google-ads/connect.js) |
| `GET /api/integrations/google-ads/callback` | [`api/integrations/google-ads/callback.js`](../../api/integrations/google-ads/callback.js) |
| `POST /api/integrations/google-ads/exchange` | [`api/integrations/google-ads/exchange.js`](../../api/integrations/google-ads/exchange.js) |

Compatibility shims remain at `/api/google-ads/connect|callback|exchange` → integrations path. Reporting APIs stay at `/api/google-ads/{status,report,accounts,sync,…}`.

Manual sync: `POST /api/google-ads/sync` with `{ siteId, days }` (auth required). Cron `/api/cron/sync-google-ads` still runs every 2 hours. If **Last sync = Never**, use **Sync now** in Advertising → Connection & Health. Test Access developer tokens cannot read production Ads accounts until Basic Access is approved.

---

## OAuth state and return location

Signed, short-lived state (`makeState` / `parseState`, 15 minutes) includes:

- `siteId`, `slug`
- `userId` (from authenticated session at connect time)
- `returnPath` (allowlisted only)
- random one-time nonce `n` (reserved in `google_ads_oauth_states`, consumed on exchange — replay rejected)

Authorize requests: `response_type=code`, `access_type=offline`, `include_granted_scopes=true`, `prompt=consent`, scopes `openid` + userinfo.email/profile + adwords.

Site/user identity for storage comes **only** from signed state (not raw callback query params).

After successful connection, users are redirected to:

```
https://app.leadpages.com.au/settings/integrations/google-ads?gads=connected&siteId=…
```

Arbitrary return URLs are rejected (`safeReturnPath`) to prevent open redirects.

Connect prefers `Authorization: Bearer` + JSON `{ url }` so the access token is not placed in the query string / Referer.

---

## Cookies / CORS / auth session

- Supabase auth runs on the app origin (`app.leadpages.com.au`). Prefer **host-only** cookies (no `Domain=.leadpages.com.au` unless deliberately sharing with another subdomain).
- Production cookies must be `Secure`; existing preview password cookie in render uses `HttpOnly; SameSite=Lax` (no Domain) — keep that pattern.
- Authenticated API routes use Bearer JWT; do **not** enable wildcard CORS for them.
- `PRIMARY_HOSTS` includes `app.leadpages.com.au` so the app host is not treated as a tenant site.

---

## Architecture (reporting unchanged)

```mermaid
flowchart TB
  subgraph visitor [Published site]
    Attr[lp-attribution.js]
    TE[trackEvent / submitLead]
  end
  subgraph ingest [Ingest]
    EV[POST /api/events]
    LD[POST /api/leads]
    VS[(visitor_sessions)]
    CD[(ads_conversion_deliveries)]
  end
  subgraph google [Google Ads]
    OAuth[OAuth on app.leadpages.com.au]
    Sync[cron sync-google-ads]
    Upload[uploadClickConversions]
    Met[(ads_metrics_daily)]
  end
  Attr --> TE --> EV --> VS
  TE --> LD --> VS
  LD --> Upload --> CD
  OAuth --> Sync --> Met
```

See prior sections in git history / PR #328 for conversion roles, metrics, and Advertising UI details.

---

## Ops checklist

1. Run `db/google_ads_schema.sql` in Supabase (new installs)  
2. For existing DBs, also run `db/google_ads_oauth_hardening.sql`  
3. For Smart Campaign Builder, also run `db/ads_campaign_builder_schema.sql` — see [Ads Campaign Builder](Ads%20Campaign%20Builder.md)  
4. Attach domain `app.leadpages.com.au` to the Vercel production project  
5. Set Production env vars listed above (encryption key required)  
6. Configure Google Cloud origins/redirect exactly as listed  
7. Connect via `/settings/integrations/google-ads`  
8. Confirm callback hits `/api/integrations/google-ads/callback` (not Host-derived)  
9. After enabling encryption, re-connect any site that previously stored plaintext tokens  

*Last updated: July 2026 — OAuth hardening + Smart Campaign Builder (flag-gated).*
