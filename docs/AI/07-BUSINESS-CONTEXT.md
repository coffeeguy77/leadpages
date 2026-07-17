# 07 — Business Context

**Document:** `AI/07-BUSINESS-CONTEXT`  
**Status:** Proposed  
**Prerequisites:** [02-DATABASE](../02-DATABASE.md), [01-CURRENT-STATE-AUDIT](01-CURRENT-STATE-AUDIT.md)

---

## Goal

One resolver that assembles **allowed** business context for a Brain call from existing LeadPages sources — without duplicating canonical data.

---

## Sources of truth (verified)

| Field group | Source | Notes |
|-------------|--------|-------|
| Account / user | Supabase Auth + `profiles` | `is_super_admin` |
| Partner | `partners`, `partner_profiles` (+ `website_profile`) | Partner showcase |
| Site | `sites` row | `slug`, `business_name`, `custom_domain`, `template`, status |
| Site configuration | `sites.config` JSONB | trade, theme, sections, services, pages, seoTokens, logo, … |
| Service / trade packs | `service_packs` | Generated packs |
| Leads | `leads` | CRM features later — sensitive |
| Analytics | `events`, `event_daily`, `visitor_sessions` | Aggregates preferred |
| Google Ads | `google_ads_connections` + metrics tables | Marketing Hub; never leak tokens |
| Instagram | `ig_connections`, feed items in config | Enrichment |
| Suburb intros | `suburb_intros` | Cache, not brand source |
| Help corpus | `wiki_articles` | Assist only |

---

## Context slices

| Slice | Typical fields | V1 |
|-------|----------------|-----|
| `site.identity` | businessName, trade, phone, email, domain | Yes |
| `site.brand` | theme colours, logo URL, voice hints if present | Yes |
| `site.services` | services[] titles/summaries | Yes |
| `site.areas` | serviceAreas.areas | Yes |
| `site.seo` | seoTokens, seoTitle/Description | Yes |
| `site.pages.summary` | published page titles/slugs (not full bodies by default) | Optional |
| `partner.identity` | partner name, tier | When actor is partner |
| `ads.summary` | account linked?, high-level metrics | Later |
| `leads.summary` | counts / recent anonymised | Later |
| `site.copy.excerpts` | hero/FAQ snippets | Size-limited |

---

## Rules

1. **Never** put OAuth refresh tokens, encryption keys, or raw card data in context.  
2. **Redact** PII from leads unless task explicitly allowed and role permits.  
3. **Bound** serialized context size; prefer summaries.  
4. **Permission check** before load (site ownership / partner link / super).  
5. **Feature selects slices** — do not dump entire `sites.config`.  
6. Manual overrides (brand voice notes) may live in config extension later — mark as derived vs source.  
7. Cross-business sharing is forbidden.

---

## Freshness

| Data | Freshness |
|------|-----------|
| `sites.config` | Request-time read |
| Metrics | Last sync / rollup timestamp attached |
| Derived AI fields | Store with `generatedAt` + source prompt version |

---

## Related

- Memory: [08-MEMORY-ARCHITECTURE](08-MEMORY-ARCHITECTURE.md)  
- Security: [11-SECURITY-AND-PERMISSIONS](11-SECURITY-AND-PERMISSIONS.md)
