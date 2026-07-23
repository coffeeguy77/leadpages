# Search Intelligence — Roadmap & Packaging

**Document:** `search-intelligence/08-ROADMAP`  
**Prerequisites:** [00-VISION.md](00-VISION.md), [PHASE-0-BAKEOFF.md](PHASE-0-BAKEOFF.md)

---

## Phase overview

| Phase | Name | Focus | Exit |
|-------|------|-------|------|
| **0** | Validation | Provider bake-off, unit economics, IA prototype, privacy | Default provider + cost model + recipes understood |
| **1** | Foundations MVP | Command Centre, GSC, GA4, attribution, keywords, crawl, NBA, partner basics | First sellable product |
| **2** | Research-to-page | Clusters, Page Optimiser, Composer drafts, safeguards, annotations | Moat: opportunity → live page |
| **3** | Local Growth | GBP, Maps grid, listings, Local Opportunity Map, safe local pages | Flagship for trades |
| **4** | Authority / AI / Ads | Backlinks, AI visibility, SEO↔PPC universe | Combined search reporting |
| **5** | Autopilot & scale | Safe auto-fix, multi-location, CRM value, failover | Controlled automation |

Calendar-week estimates from the original scope are **indicative only**; delivery tracks exit criteria and dependencies (especially Google API access).

---

## Phase 1 MVP checklist

- [x] SEO Command Centre home (**scaffold** + config audit NBAs)
- [x] Overview / recommendations API (loads `sites.config`, first-party audit)
- [x] Site Brain `snapshot.searchIntelligence` twin shape
- [x] GSC + GA4 settings pages + status/connect/callback/exchange (encrypted `si_connections`)
- [x] First-party HTML crawl (homepage, `?crawl=1`; Actions tab)
- [x] GSC / GA4 property selection + GSC/GA4 sync (+ cron)
- [x] Forms / call-click organic attribution rollup (Command Centre card)
- [x] Page-level GSC performance view + high-impr/low-CTR / cannibalisation NBAs
- [x] Keyword research API (provider gateway; mock until DataForSEO configured)
- [x] Tracked keywords persistence (plan limit via `SI_TRACKED_KEYWORD_LIMIT`, default 25 / max 100)
- [x] Partner portfolio basics (connection health rollup)
- [x] Scheduled client summary (manual + Monday cron → `si_report_snapshots`)

**Website actions (live):** Open in editor (section-aware); Create task toast; track/untrack keywords.  

**Scaffold note:** Apply `db/search_intelligence_schema.sql` before OAuth, sync, tracked keywords, or report snapshots. Rank observations run via `/api/cron/search-intelligence-ranks` (daily) and Manage → Keywords → Check ranks now.

---

## Packaging

### Included with a normal site

- Basic SEO health  
- Search Console / GA4 connection  
- Page-level recommendations (limited)  
- Limited keyword research  
- Monthly report  
- Lead attribution  

### SEO Growth add-on

- Larger keyword allowance  
- Daily/weekly rank tracking  
- Competitor research  
- Clustering, Page Optimiser, content plan  
- Advanced reporting  
- Research-to-page drafts  

### Local Growth add-on

- GBP, reviews, Maps grid  
- Local competitor tracking  
- Listings audit  
- Local Opportunity Map  
- Local content recommendations  

### Partner / Agency

- Pooled usage  
- Portfolio dashboard  
- Client-branded reports  
- Task/approval workflows  
- Bulk recommendations  
- Partner templates & margin controls  

---

## Usage metering

| Meter | Notes |
|-------|-------|
| Tracked keywords × refresh frequency | Primary cost driver |
| SERP locations / Maps grid points | Geo cost |
| Competitor domains | Research |
| Backlink rows | Phase 4 |
| AI prompts / platforms | Phase 4 |
| Crawl pages × frequency | Audit |
| Reports / seats | Soft limit |

Cache shared market data where licensing permits. Prefer plan-based refresh over unlimited on-demand calls.

---

## Success metrics (summary)

**Client:** organic/Maps leads, target keywords in Top 3/10, non-brand clicks, GBP actions (later), time opportunity→publish, implemented-recommendation rate.  

**Product:** connection completion, WAU SEO projects, accept→publish rate, attach rate, provider cost per account, gross margin.  

**Quality:** factual correction rate, duplicate-page incidents, rollback rate, data freshness, attribution confidence.

---

## Non-goals (programme)

- Building Semrush’s data moat internally  
- Silent AI publish  
- Uncontrolled doorway/location spam  
- External-site crawl before Phase 3  
