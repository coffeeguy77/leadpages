# SEO Command Centre

**Document:** `search-intelligence/05-COMMAND-CENTRE`  
**Status:** Client workspace UX spec  
**Prerequisites:** [00-VISION.md](00-VISION.md), [06-RECOMMENDATION-RECIPES.md](06-RECOMMENDATION-RECIPES.md)

---

## Purpose

The home screen answers five questions:

1. How visible am I?  
2. How many leads did search create?  
3. What is the biggest opportunity?  
4. What is broken?  
5. What should I do next?  

Not fifty disconnected tools.

---

## Placement

| Surface | Role |
|---------|------|
| Manage → **SEO Command Centre** | Primary workspace (new tab/area) |
| Settings → Search & indexing | Verification + sitemap regen only |
| Partner console | Portfolio rollup (Phase 1 basics) |

---

## Home dashboard cards

- Search Visibility score  
- Local Maps Visibility score (Phase 3 foundations: NAP + opportunity map; GBP optional later)  
- AI Visibility score (Phase 4; run probes on Authority tab)  
- Authority tab: SEO↔Ads universe, backlink gap, brand / AI SERP probes (DataForSEO only)  
- Organic clicks and impressions (GSC)  
- Calls, forms and quote requests from organic / modelled organic  
- Estimated lead value (when available)  
- Keywords in Top 3 / Top 10 / Top 20  
- New wins and losses  
- Technical health (prioritised issues, not vanity score spam)  
- Pages needing attention  
- **Next Best Actions** queue  

Every metric opens a plain-language explanation. Every issue includes impact estimate, confidence and action.

---

## Next Best Actions queue

Centre of the product. Example actions:

- Create a service/location page for a gap  
- Optimise a page ranking 11–16  
- Fix title/meta for high impressions / low CTR  
- Resolve indexability / canonical conflict  
- Add internal links to orphan targets  
- Improve CTA/form on traffic-without-conversion pages  

Action buttons:

| Action | Behaviour |
|--------|-----------|
| Fix automatically | Allow-listed technical fixes only (`auto_fix_safe`: sitemap + LocalBusiness schema) with human confirm — never silent AI publish |
| Open in editor | Deep-link to manage editor section/page |
| Create page | Hand off to Brain landing draft / Composer |
| Page Optimiser | Modelled title/meta/outline brief (Clusters tab; human apply) |
| Compose with Brain | Prefill Landing pages AI draft from SI brief; generate + approve there |
| Schema patch | Preview/apply modelled JSON-LD (Actions tab; human apply) |
| Preview changes | Diff before publish |
| Assign to partner | Partner task |
| Dismiss / snooze | With reason |

**No production change is silently made by AI.** User sees preview/diff, reason and expected effect.

---

## Roles

| Role | Access |
|------|--------|
| Super admin | Providers, costs, scoring rules, global limits, all sites |
| Partner | Assigned clients, proposals, tasks, reports, approvals |
| Client owner | Strategy, recommendations, publish approvals, connections |
| Client staff | Configurable view/edit/report |
| Read-only | Reports only |

All material changes require audit logs (`si_approvals`, Site Brain decisions).

---

## Partner portfolio (Phase 1)

Manage → SEO Command → **Portfolio** (partners + super with `partnerId=`):

| Signal | Source |
|--------|--------|
| Connection / sync health | `si_connections` (GSC/GA4) |
| Tracked keywords + rank drops | `si_tracked_keywords` + `si_rank_observations` (≥3 position worsen) |
| Open / critical actions | `si_recommendations` + latest `si_report_snapshots` openActions |
| Organic leads | Latest summary snapshot metrics |
| At risk | Needs setup, sync error, 3+ open actions, critical severity, or rank drops |

UI filters: All / At risk / Needs setup. Per-row **Email** sends the client weekly summary (Resend) via `/api/search-intelligence/summary`.

Deeper workflows (bulk email, white-label PDF, margin controls) expand in later phases.
