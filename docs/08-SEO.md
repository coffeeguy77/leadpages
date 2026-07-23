# LeadPages SEO System

**Document:** `08-SEO`  
**Status:** Definitive reference for titles, meta, suburb pages, sitemaps, and landing pages  
**Audience:** Engineers working on SEO rendering and editor fields  
**Prerequisites:** [03-TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md), [02-DATABASE](02-DATABASE.md), [10-EDITOR](10-EDITOR.md)

> LeadPages is **strongly SEO-focused**. Two parallel pipelines serve SEO: **`api/render.js`** (homepage + landing pages) and **App Router suburb pages** (`app/[site]/[suburb]`).

> **Search Intelligence (future product):** research, rank tracking, audit, Next Best Actions and search-to-lead attribution live under [search-intelligence/00-VISION.md](search-intelligence/00-VISION.md). This document remains the source of truth for **publish SEO** (titles, meta, suburbs, sitemaps, GSC verification).

---

## Executive Summary

| SEO surface | Pipeline | Cache |
|-------------|----------|-------|
| Tenant homepage | `api/render.js` + `{{pageTitle}}` tokens | 30s CDN |
| Suburb pages | `app/[site]/[suburb]/route.js` | 24h CDN |
| Landing pages (`config.pages`) | `api/render.js` sub-page routing | 30s CDN |
| Dynamic sitemap | `app/seo-sitemap.xml/route.js` | 24h |

### Non-negotiable rules

- Suburb pages **only** for suburbs in `sections.serviceAreas.areas`
- AI intros **cached** in `suburb_intros` — no repeat generation
- No uncontrolled doorway pages
- Hard 404 for unpublished landing pages

---

## Dual Pipeline Architecture

```mermaid
flowchart TB
  subgraph main [Main renderer]
    R[api/render.js]
    TOK["{{pageTitle}} / {{pageDesc}}"]
    PAGES[config.pages published]
  end

  subgraph suburb [Suburb SEO]
    AR[app/[site]/[suburb]/route.js]
    LIB[lib/seo/*]
    AI[suburb_intros + Claude]
  end

  R --> TOK
  R --> PAGES
  AR --> LIB --> AI
```

**Routing collision:** Both match `/{a}/{b}`. App Router typically takes precedence — `/joes-plumbing/belconnen` → suburb route if Belconnen ∈ service areas; `/joes-plumbing/refinancing` → render.js if published in `config.pages`.

**Keep `serviceAreas` slugs and `pages[].slug` disjoint.**

---

## Token Systems

| Syntax | Example | Where |
|--------|---------|-------|
| `{{double}}` | `{{pageTitle}}`, `{{businessName}}` | `render.js`, template `<head>` |
| `{single}` | `{suburb}`, `{trade}`, `{business}` | `seoTokens`, `lib/seo/tokens.js`, client hydrate |

**Do not mix** without understanding resolution order.

---

## Site-Wide SEO (`render.js`)

Defaults when `config.seoTitle` / `config.seoDescription` empty:

- Title: `{business} — {trade} in Canberra & the ACT`
- Description: trade-aware Canberra/ACT copy

Injected as `{{pageTitle}}` / `{{pageDesc}}` into `trade.template.json` `<head>`.

Canonical on main site: `https://{{domain}}/` (template default).

---

## `sections.seoTokens` (Local SEO)

Edited in manage.html → **Local SEO** subtab.

```json
{
  "trade": "Plumber",
  "city": "Canberra",
  "region": "ACT",
  "suburb": "Canberra",
  "enableUrlSuburb": false,
  "updateTitle": false,
  "titleTemplate": "{trade} in {suburb} | {business}",
  "metaTemplate": "Optional custom meta for suburb route"
}
```

**Tokens:** `{business}`, `{trade}`, `{suburb}`, `{suburbs}`, `{city}`, `{region}`, `{phone}`, `{year}`

### Client-side on homepage (`applyCfg`)

- If `enableUrlSuburb`: read `?suburb=Name` — only if name ∈ `serviceAreas.areas`
- Walk `#top` text nodes replacing `{token}`
- If `updateTitle`: set `document.title` from `titleTemplate`

### Two suburb lists

| Path | Used for |
|------|----------|
| `sections.area.suburbs` | "Where we work" display (legacy strings) |
| `sections.serviceAreas.areas` | Suburb page gate, sitemap, `{suburbs}` token |

Only **`serviceAreas.areas`** drives App Router pipeline.

---

## Suburb Pages (`lib/seo/*`)

### Modules

| File | Purpose |
|------|---------|
| `store.js` | `getSiteConfig`, `getIntro`, `saveIntro`, `listSites` |
| `tokens.js` | `findSuburb`, `buildTokens`, `deepMergeConfig`, `slugify` |
| `suburbIntro.js` | `getOrCreateIntro` — Claude + cache |
| `template.js` | `loadTemplate`, `applySeoHead`, `applyHero`, `injectBootstrap` |

### Request flow (`app/[site]/[suburb]/route.js`)

```
GET /{site}/{suburbSlug}
  → getSiteConfig(site)           // 404 if missing
  → findSuburb(config, slug)      // 404 if not in serviceAreas
  → buildTokens + getOrCreateIntro
  → title from titleTemplate, description from metaTemplate
  → canonical = {origin}/{site}/{suburb-slug}
  → loadTemplate (SEO_TEMPLATE_URL)
  → applyTenantTokens → applySeoHead → applyHero
  → injectBootstrap → __applyTradeConfig(merged)
  → Cache-Control: s-maxage=86400
```

### AI intro (`suburb_intros` table)

| Column | Purpose |
|--------|---------|
| `site` | Site slug |
| `suburb` | Canonical name |
| `intro` | Cached paragraph |
| PK | `(site, suburb)` |

First request → Claude (`ANTHROPIC_API_KEY`, model `claude-sonnet-4-6`) → save. Subsequent → DB read only.

Intro becomes `sections.hero.sub` — unique crawler-visible copy.

### SSR vs hydration

- `applySeoHead` — title, meta, canonical, OG in **raw HTML**
- `applyHero` — H1 + intro paragraph in raw HTML
- `injectBootstrap` — client `__applyTradeConfig` matches SSR

---

## Landing Pages (`config.pages`)

Array in `sites.config`, edited in **Landing pages** tab.

```json
{
  "id": "uuid",
  "title": "Refinancing",
  "slug": "refinancing",
  "meta": "Meta description",
  "h1": "Headline",
  "body": "Markdown content",
  "menu": "top|footer",
  "status": "published|draft",
  "img": ""
}
```

### Routing

`vercel.json`: `/:slug/:page` → `/api/render?slug=:slug&page=:page`

```javascript
_pageRow = pages.find(p => p.slug === page && p.status === 'published');
if (!_pageRow) return notFound();
if (_pageRow.title) pageTitle = `${_pageRow.title} — ${business}`;
if (_pageRow.meta) pageDesc = _pageRow.meta;
```

### Persistence

- **Autosave:** `lpAutosave()` → `lpSaveDB()` (pages only, 1s debounce)
- **Publish:** full config via `publishToDB()`

### Client render

`_lpRenderPage(p)` replaces `#top` with article layout; sets title/meta client-side.

### AI page generation

Editor "Generate" → Anthropic from `manage.html` → `config.pages[].body` (250–400 words Markdown).

Distinct from suburb intros (server-side, cached per suburb).

---

## Dynamic Sitemap

**`app/seo-sitemap.xml/route.js`**

- Lists every `/{siteSlug}/{suburbSlug}` for sites with service areas
- `changefreq: weekly`, `s-maxage=86400`
- **Gap:** does not filter `sites.status === 'live'`

Point `robots.txt` at `/seo-sitemap.xml`.

---

## Canonical URL Summary

| Context | Canonical |
|---------|-----------|
| Main tenant site | `https://{{domain}}/` |
| Suburb page | `{origin}/{site}/{suburb-slug}` |
| Landing page | Stays root `/` (title/meta updated client-side) |

---

## Environment Variables (suburb path)

| Variable | Required |
|----------|----------|
| `SUPABASE_URL` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `SEO_TEMPLATE_URL` | Yes — trade template JSON URL |
| `ANTHROPIC_API_KEY` | No — fallback intro if missing |

---

## Operational Recommendations

1. Keep `serviceAreas.areas` and `pages[].slug` **disjoint**
2. Filter sitemap by `status = live` (not implemented)
3. Expose `metaTemplate` in editor for suburb meta customization
4. Align `area.suburbs` with `serviceAreas.areas` for operators
5. Consider `/areas/{suburb}` prefix if routing collisions occur in production

---

## Related Documentation

| Doc | Topic |
|-----|-------|
| [03-TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md) | Render pipeline, tokens |
| [02-DATABASE](02-DATABASE.md) | `seoTokens`, `pages`, `suburb_intros` |
| [10-EDITOR](10-EDITOR.md) | Local SEO + landing pages UI |

---

*Document maintained as part of the LeadPages engineering canon.*
