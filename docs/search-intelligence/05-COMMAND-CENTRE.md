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
- Local Maps Visibility score (Phase 3; placeholder until then)  
- AI Visibility score (Phase 4; placeholder)  
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
| Fix automatically | Only allow-listed safe technical fixes (Phase 5; Phase 1 = rare) |
| Open in editor | Deep-link to manage editor section/page |
| Create page | Hand off to Brain landing draft / Composer (Phase 2) |
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

## Partner portfolio (Phase 1 basics)

One screen across clients:

- Clients at risk / ranking drops  
- Critical technical issues  
- Unapproved recommendations  
- Leads and estimated value  
- Quick wins  
- Connection / sync health  

Deeper workflows (bulk, white-label PDF, margin controls) expand in later phases.
