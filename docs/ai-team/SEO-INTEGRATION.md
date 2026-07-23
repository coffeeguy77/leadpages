# SEO integration (AI Team ↔ Search Intelligence)

**Status:** Bound to Search Intelligence architecture (docs-first)  
**Product docs:** [../search-intelligence/00-VISION.md](../search-intelligence/00-VISION.md), [../search-intelligence/09-SEARCH-DIGITAL-TWIN.md](../search-intelligence/09-SEARCH-DIGITAL-TWIN.md)

---

## Current behaviour

| Capability | Status |
|------------|--------|
| Landing SEO drafts | Live — `api/brain/landing-draft.js`, manage landing tools |
| Suburb intros | Live — `lib/seo/suburbIntro.js` (cached) |
| Site Brain `snapshot.seo` | Advisory mirror of titles/pages from config |
| Scout | **Recommend only** — does not create pages or mutate SEO fields |
| Forge | Executes **approved** Execution Plans only |
| SEO Command Centre | Spec only — not shipped |

---

## Target integration

1. **Scout** reads Site Brain + Search Intelligence twin (`snapshot.searchIntelligence` — future) and emits Next Best Action recommendations (`si_recommendations` / Brain recommendations).  
2. **Forge** turns approved recommendations into landing drafts / title-meta plans via existing Brain + editor paths — never silent publish.  
3. **Guardian** runs brand/factual/duplication checks on drafts.  
4. Publish SEO remains `sites.config` + renderer ([../08-SEO.md](../08-SEO.md)).

Do **not** build a parallel page generator. Reuse:

- `lib/brain/landing-brief.js` / `api/brain/landing-draft.js`
- Forge `create_landing_page` / `plan_seo_landing`
- Sitemap regen `api/site/sitemap.js`

---

## Recipe → agent mapping (Phase 1)

| Recipe | Scout | Forge (after approval) |
|--------|-------|------------------------|
| `high_impr_low_ctr` | Recommend title/meta | Plan editor SEO field patch |
| `keyword_no_page` | Recommend create page | Landing draft plan |
| `not_indexed` | Recommend technical fix + sitemap | Task + optional sitemap refresh action |
| Others | See [../search-intelligence/06-RECOMMENDATION-RECIPES.md](../search-intelligence/06-RECOMMENDATION-RECIPES.md) | |

---

## Non-negotiables

- No hidden AI publication  
- Service-area gate for local pages (no doorway spam)  
- Label measured vs estimated vs modelled metrics  
- Token encryption and tenant isolation for GSC/GA4 (when connected)
