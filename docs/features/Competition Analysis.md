# Competition Analysis (SEO Command Centre)

Competitor research inside Manage → **SEO → Competition**.

**Market data:** DataForSEO Labs + Backlinks API only.  
**Mock/demo data is never shown or saved as a customer’s competitors.**

---

## Hard rules

1. Discovery uses the **site’s own domain** (`custom_domain` / slug) — never a hard-coded trade list.
2. Keyword discovery uses **only the seeds the operator types** (e.g. `coffee cart hire canberra`).
3. If DataForSEO credentials are missing, actions return `market_provider_required` — they do **not** fall back to plumber (or any trade) fixtures.
4. Known demo fixture domains (`rival-plumb.com.au`, `canberra-pipes.com.au`, `act-drainmasters.com.au`, `queanbeyan-plumbing.com.au`, `example-plumber.com.au`, `*.example`) are **purged** from `site.config.competitors` and `si_competitors` on tab load.
5. Mock adapter (tests only) synthesises rivals from the **requested domain / keyword seed** — it must not inject unrelated industries.

---

## Workflow

| Step | UI action | Backend |
|------|-----------|---------|
| 1. Core competitors | **Find organic competitors** | Labs `competitors_domain` for **this** domain |
| 1b. Seed discovery | **Discover from keywords** | Live SERP for the typed seeds only |
| 2. Keyword gap | **Keyword gap** | Ranked keywords for you + up to 4 saved rivals |
| 3. Backlinks | **Backlink strategy** | Referring domains + top linked pages |
| 4. PPC | **Paid ads research** | Paid `ranked_keywords` |

Live rivals (DataForSEO only) may save to `site.config.competitors` and `si_competitors`.

---

## API

`GET|POST /api/search-intelligence/competition`

| Action | Purpose |
|--------|---------|
| `discover_competitors` | Labs competitors for your domain |
| `discover_from_serp` | SERP-based rival discovery from operator seeds |
| `keyword_gap` | Missing / Weak / Shared |
| `backlink_strategy` | Referring domains + top pages |
| `paid_research` | Competitor paid keywords |
| `save_competitors` | Persist cleaned domain list (fixtures rejected) |
| `clear_competitors` | Wipe saved rivals |
| `purge_fixtures` | Remove leaked demo domains |

---

## Code map

| Area | Path |
|------|------|
| Orchestration | `lib/search-intelligence/competition-analysis.js` |
| Fixture denylist | `lib/search-intelligence/competition-fixtures.js` |
| Provider ops | `lib/search-intelligence/providers/dataforseo.js` (+ seed-derived mock for tests) |
| API | `api/search-intelligence/competition.js` |
| UI | `manage.html` → `_siLoadCompetition` |

---

## Related

- [Provider gateway](../search-intelligence/04-PROVIDER-GATEWAY.md)
- [SEO Command Centre](../search-intelligence/05-COMMAND-CENTRE.md)
