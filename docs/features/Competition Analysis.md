# Competition Analysis (SEO Command Centre)

Competitor research inside Manage → **SEO → Competition**.

Split into **free** tools (every site) and **Premium SEO** (paid marketplace app).

---

## Free (included)

- Paste competitor domains and **Save** / **Clear**
- Fixture purge of leaked demo domains on tab load
- No DataForSEO calls

---

## Premium SEO (paid)

Marketplace app: slug `premium-seo`, section key `premiumSeo`, **$49/mo** or **$490/yr**.

Unlocks live DataForSEO research:

1. Find organic competitors (Labs `competitors_domain`)
2. Discover from industry keywords (live SERP)
3. Keyword gap (Missing / Weak / Shared)
4. Backlink strategy
5. Paid ads research

**Hard rules**

1. Discovery uses the **site’s own domain** — never a hard-coded trade list.
2. Keyword discovery uses **only the seeds the operator types**.
3. Missing DataForSEO credentials → `market_provider_required` (no mock rivals).
4. Missing Premium SEO subscription → `subscription_required` (HTTP 402), even if DataForSEO is configured.
5. Demo fixture domains are purged from site config on tab load.
6. Super users are platform-exempt for support; ops may set `SI_PREMIUM_SEO_UNLOCK=1` in trusted envs only.

---

## UI

| Box | Contents |
|-----|----------|
| **Included · free** | Competitor domain textarea, Save, Clear |
| **Premium SEO** (shaded) | Live research buttons + seed discovery. Locked sites see message + **Get Premium SEO** checkout CTA |

---

## API

`GET|POST /api/search-intelligence/competition`

| Action | Tier |
|--------|------|
| `save_competitors` / `clear_competitors` / `purge_fixtures` | Free |
| `discover_competitors` / `discover_from_serp` / `keyword_gap` / `backlink_strategy` / `paid_research` | Premium SEO |

Register the app: `node scripts/register-premium-seo-app.js`

---

## Code map

| Area | Path |
|------|------|
| Entitlement | `lib/search-intelligence/billing.js` |
| Orchestration | `lib/search-intelligence/competition-analysis.js` |
| Fixture denylist | `lib/search-intelligence/competition-fixtures.js` |
| API | `api/search-intelligence/competition.js` |
| Register SKU | `scripts/register-premium-seo-app.js` |
| UI | `manage.html` → `_siLoadCompetition` |

---

## Related

- [Provider gateway](../search-intelligence/04-PROVIDER-GATEWAY.md)
- [SEO packaging / SEO Growth](../search-intelligence/08-ROADMAP.md)
- [Marketplace](./Marketplace.md)
- [Billing](./Billing.md)
