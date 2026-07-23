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
- [x] Keyword research API (provider gateway; live DataForSEO when credentials set)
- [x] Tracked keywords persistence (plan limit via `SI_TRACKED_KEYWORD_LIMIT`, default 25 / max 100)
- [x] Rank checks (manual + daily cron; DataForSEO SERP when configured, else mock)
- [x] Partner portfolio (health, at-risk signals, open actions, rank drops, Email summary)
- [x] Scheduled client summary (manual + Monday cron → `si_report_snapshots`)
- [x] Owner summary email (Manage button + optional `SI_SUMMARY_EMAIL=1` cron via Resend)

**Website actions (live):** Open in editor (section-aware); Create task toast; track/untrack keywords.  

**Scaffold note:** Apply `db/search_intelligence_schema.sql` before OAuth, sync, tracked keywords, or report snapshots. Rank observations run via `/api/cron/search-intelligence-ranks` (daily) and Manage → Keywords → Check ranks now.

---

## Phase 2 research-to-page (complete)

- [x] Deterministic keyword clusters from tracked terms (`si_keyword_clusters`)
- [x] Page Optimiser modelled briefs (title/meta/H1/outline) — **no silent publish**
- [x] Manage → Clusters tab + brief handoff copy / SEO editor
- [x] Compose with Brain handoff → Landing pages AI draft (prefill; human generate + approve)
- [x] Modelled internal-link suggestions on briefs
- [x] Provider usage metering helper (`si_provider_usage` via keyword ideas, ranks, clusters, briefs)
- [x] Annotations for publish events (landing publish/unpublish, draft applied, schema apply)
- [x] Schema patch actions (preview + human apply → `config.seoJsonLd`; renderer emits ld+json)

---

## Phase 3 Local Growth (complete for DataForSEO path)

- [x] First-party NAP / listings audit (no GBP required)
- [x] Local opportunity map (service areas × keyword clusters)
- [x] Manage → Local tab + usage rollup
- [x] Overview Local / Maps readiness card
- [x] Google Business Profile OAuth scaffold (status/connect/callback/exchange; live sync when Google access approved)
- [x] DataForSEO Maps-grid SERP sampling (Manage → Local; meter `maps_grid`)
- [x] Safe multi-suburb page generation with evidence gates (Draft page → brief / Landing handoff; never silent publish)

---

## Phase 4 foundations (started)

- [x] Backlink summary DTO + gateway op (`backlinkSummary` via DataForSEO)
- [x] SEO↔Ads keyword universe helper + `seo_ads_mismatch` when Ads keywords supplied
- [x] AI Visibility overview card placeholder + SERP `ai_overview` / brand SERP probes
- [ ] Full Ads keyword import into SI matrix
- [ ] Competitor backlink gap reporting UI
- [ ] AI citation ownership depth

---

## Phase 5 Autopilot (deferred)

- [ ] Scoped `auto_fix_safe` allow-list only (never silent AI publish)
- [ ] Multi-location CRM value outcomes

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

- Licensing or integrating **Semrush** (permanently out of scope)  
- Building Semrush’s data moat internally  
- Silent AI publish  
- Uncontrolled doorway/location spam  
- External-site crawl before Phase 3  
