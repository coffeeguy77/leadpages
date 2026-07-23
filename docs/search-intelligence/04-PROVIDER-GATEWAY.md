# Search Intelligence — Provider Gateway

**Document:** `search-intelligence/04-PROVIDER-GATEWAY`  
**Status:** Normalised market-data contract  
**Code:** [`../../lib/search-intelligence/providers/`](../../lib/search-intelligence/providers/)  
**Bake-off:** [PHASE-0-BAKEOFF.md](PHASE-0-BAKEOFF.md)

---

## Principle

Do **not** couple product code to one vendor response schema. All keyword, SERP, rank, competitor and backlink calls go through the gateway.

```mermaid
flowchart LR
  UI[CommandCentre] --> GW[ProviderGateway]
  Jobs[Scheduler] --> GW
  GW --> Cache[CacheAndBudget]
  Cache --> DFS[DataForSEO]
  Cache --> SM[SemrushAPI]
  Cache --> Mock[MockFixtures]
```

---

## First adapter target

| Provider | Role |
|----------|------|
| **DataForSEO** | First adapter target (AU local SERP / Maps support) |
| Semrush API | Failover stub (`semrush.js`); live HTTP after licensing bake-off |
| Mock | Tests and docs examples |

Phase 0 bake-off selects the **default** provider; gateway retains multi-adapter support. Set `SI_PROVIDER=semrush` only after the adapter is live — today it returns `not_configured` even with `SEMRUSH_API_KEY` set (key check reserved for ops readiness).

---

## Normalised DTOs (`lib/search-intelligence/providers/types.js`)

| Type | Fields (summary) |
|------|------------------|
| `KeywordIdea` | keyword, location, language, volume, cpc, competition, difficulty, intent, localIntent, trend |
| `SerpSnapshot` | keyword, location, device, fetchedAt, features[], results[] |
| `SerpResult` | rank, url, domain, title, snippet, type (organic/maps/…) |
| `RankObservation` | keywordId, url, position, device, geo, fetchedAt, features |
| `CompetitorDomain` | domain, visibilityEstimate, overlapCount |
| `BacklinkSummary` | referringDomains, newLost, topAnchors (Phase 4) |

Every response includes `provider`, `fetchedAt`, `labelClass` (`measured` \| `estimated` \| `modelled`).

---

## Gateway responsibilities

1. Route operation → adapter  
2. Enforce tenant **budget** (`si_provider_usage`)  
3. Cache shared market data where licensing permits  
4. Plan-based refresh frequency (not unlimited user triggers)  
5. Fail soft with structured errors (`not_configured`, `budget_exceeded`, `provider_error`)  
6. Optional failover when a second adapter is configured  

---

## Operations (Phase 1 surface)

| Op | Description |
|----|-------------|
| `keywordIdeas` | Seed → related keywords + volume/CPC |
| `serp` | Live SERP for keyword × geo × device |
| `domainOverview` | Light competitor/domain snapshot |
| `rankCheck` | Position for tracked keywords |

Phase 4 adds `backlinks`, `backlinkGap`. AI visibility may be a separate hybrid provider.

---

## Live vs stub behaviour

- `dataforseo.js` returns `{ ok: false, error: 'not_configured' }` until `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` are set (aliases: `DATAFORSEO_EMAIL` / `DATAFORSEO_API_PASSWORD`, `DFS_LOGIN` / `DFS_PASSWORD`)
- When credentials exist and `SI_PROVIDER` / `SI_KEYWORD_PROVIDER` are unset, the gateway **auto-prefers** DataForSEO
- Explicit `SI_PROVIDER=mock` (or `dataforseo`) always wins over auto-prefer
- Live ops: `keywordIdeas` → Labs `google/keyword_ideas/live`; `serp` / `rankCheck` → `serp/google/organic/live/advanced`; `domainOverview` → Labs `google/domain_rank_overview/live`
- Default geo: `DATAFORSEO_LOCATION_CODE` (default **2036** Australia)
- `mock.js` returns deterministic fixtures for unit tests  

---

## Cost controls

Meter: keyword ideas, SERP locations, grid points, competitor domains, backlink rows, AI prompts.  
Cache TTLs and plan caps documented in [08-ROADMAP.md](08-ROADMAP.md).
