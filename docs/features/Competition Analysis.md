# Competition Analysis (SEO Command Centre)

Semrush-style competitor research inside Manage → **SEO → Competition**.

**Market data:** DataForSEO Labs + Backlinks API only. Semrush APIs are permanently out of scope.

---

## Workflow

| Step | UI action | Backend |
|------|-----------|---------|
| 1. Core competitors | **Find organic competitors** | `competitors_domain` — rivals sorted by keyword overlap (Competition Level) |
| 1b. No domain yet | **Discover from keywords** | Live SERP top domains for seed keywords |
| 2. Keyword gap | **Keyword gap** | Ranked keywords for you + up to 4 rivals → Missing / Weak / Shared |
| 3. Backlinks | **Backlink strategy** | Referring domains (Follow filter) + top linked pages |
| 4. PPC | **Paid ads research** | Paid `ranked_keywords` + domain paid metrics |

Competitors save to `site.config.competitors` and `si_competitors`.

---

## API

`GET|POST /api/search-intelligence/competition`

| Action | Purpose |
|--------|---------|
| `discover_competitors` | Labs competitors for your domain |
| `discover_from_serp` | SERP-based rival discovery |
| `keyword_gap` | Missing / Weak / Shared tables |
| `backlink_strategy` | Referring domains + top pages for one rival |
| `paid_research` | Competitor paid keywords |
| `save_competitors` | Persist domain list |

Live calls meter `si_provider_usage`. Figures are never invented — blank when the provider returns empty.

---

## Code map

| Area | Path |
|------|------|
| Orchestration | `lib/search-intelligence/competition-analysis.js` |
| Provider ops | `lib/search-intelligence/providers/dataforseo.js` (+ mock) |
| API | `api/search-intelligence/competition.js` |
| UI | `manage.html` → `_siLoadCompetition` |

---

## Related

- [Authority / backlink gap](../search-intelligence/05-COMMAND-CENTRE.md)
- [Provider gateway](../search-intelligence/04-PROVIDER-GATEWAY.md)
- [SEO Command Centre](../search-intelligence/05-COMMAND-CENTRE.md)
