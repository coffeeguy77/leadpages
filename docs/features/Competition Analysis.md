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

| Step | UI action | Backend / DataForSEO |
|------|-----------|----------------------|
| 0. Keyword lookup | **Look up keyword** | Live SERP — `serp/google/organic/live/advanced` (default) or `/regular` when “Organic-only SERP” is checked |
| 0b. Rival drill-down | **Keywords: {domain}** | Labs `ranked_keywords` for that rival |
| 1. Core competitors | **Find organic competitors** | Labs `competitors_domain` for **this** domain |
| 2. SERP competitors | **SERP competitors** | Labs `serp_competitors` for operator keyword seeds |
| 2b. Seed → list | **Save rivals from SERP** | Live SERP domains saved to competitor list |
| 3. Keyword gap | **Keyword gap** | Ranked keywords for you + up to 4 saved rivals (local gap math) |
| 4. You vs rival | **You vs rival** | Labs `domain_intersection` — shared + keywords they rank for that you don’t |
| 5. Backlinks | **Backlink strategy** | Referring domains + top linked pages |
| 6. PPC | **Paid ads research** | Paid `ranked_keywords` |

**Hard rules**

1. Discovery uses the **site’s own domain** — never a hard-coded trade list.
2. Keyword / SERP competitor discovery uses **only the seeds the operator types**.
3. Missing DataForSEO credentials → `market_provider_required` (no mock rivals).
4. Missing Premium SEO subscription → `subscription_required` (HTTP 402), even if DataForSEO is configured.
5. Demo fixture domains are purged from site config on tab load.
6. Super users are platform-exempt for support; ops may set `SI_PREMIUM_SEO_UNLOCK=1` in trusted envs only.
7. Local SERPs expand **local_pack** business websites (not just `maps.google.com`) so local keywords return real rivals.

---

## UI

| Box | Contents |
|-----|----------|
| **Included · free** | Competitor domain textarea, Save, Clear |
| **Premium SEO** (shaded) | Keyword lookup (advanced/regular), live research buttons, SERP rival save. Locked sites see message + **Get Premium SEO** checkout CTA |

---

## API

`GET|POST /api/search-intelligence/competition`

| Action | Tier |
|--------|------|
| `save_competitors` / `clear_competitors` / `purge_fixtures` | Free |
| `lookup_keyword` / `competitor_keywords` / `discover_competitors` / `discover_from_serp` / `serp_competitors` / `keyword_gap` / `domain_intersection` / `backlink_strategy` / `paid_research` | Premium SEO |

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
