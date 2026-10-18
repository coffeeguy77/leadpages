# SEO Saver (old-URL redirects)

Keeps the rankings a business earned on its old website when it moves to LeadPages.
Every old address 301-redirects to its new page in one hop; addresses nobody mapped are
caught, sent to the closest page (or home), and listed in the editor for review.

Phase 1: redirect engine, hit logging, editor tab, Down Right Concreting map.
Phase 2: automatic discovery (old sitemap + crawl, Wayback Machine, Google results, backlinks,
Search Console, real visits) and matching by content.
Phase 3: daily monitor — auto-adds sure matches for requested old addresses, health checks,
launch check (every old address → one hop → 200).

## Where things live

| Piece | File |
|---|---|
| Rules (per site) | `sites.config.seoSaver` — `{ on, notFound: 'smart'\|'home'\|'page', oldDomain, redirects:[{on, from, to, code, source, note}] }` |
| Matching logic (server + editor) | `assets/lp-seo-saver-core.js` (UMD; `lib/seo-saver.js` re-exports it) |
| Live redirects | `api/render.js` → `seoSaverSend()`; runs before page routing |
| Deep paths on client domains | `vercel.json` last rewrite: `/((?!api/).*)` → `/api/render?lpPath=…` for non-LeadPages hosts only. Real files still win (filesystem is checked before rewrites). |
| Hit log | table `site_url_hits` + `seo_saver_log()` — `db/seo_saver.sql` (service role only) |
| Editor | SEO Command Centre → **SEO Saver** tab (`assets/lp-seo-saver.js`); saves via `lpSaveLiveDB()` + cache purge |
| Hits API | `GET/POST /api/seo-saver/hits` (owner / servicing partner / super-admin) |
| Discovery API | `POST /api/seo-saver/discover` — actions list, sitemaps, wayback, google, backlinks, search_console, visits, read, match, status, check, check_done |
| Discovery sources | `lib/seo-saver-discover.js` (safe fetch, sitemap, crawl/read, Wayback CDX, DataForSEO) |
| Matching | `lib/seo-saver-match.js` (TF-IDF content + title + URL words → confidence 0–100 with a reason) |
| Shared server code | `lib/seo-saver-server.js` (candidates, coverage, adding rules, problems, live check, monitor) |
| Daily monitor | `api/cron/seo-saver.js` — Vercel cron `50 17 * * *` (≈ 4:50 am Canberra) |
| Tables | `seo_saver_candidates`, `seo_saver_runs` — `db/seo_saver_phase2.sql` (service role only) |

## Rule format

- `from`: old path (a full old URL can be pasted — only the path is used). Case, trailing slash,
  `.html/.php/.asp(x)`, repeated slashes and a leading `/index.php` (Joomla) don't matter.
  - End with `*` for a prefix: `/images/igallery/resized/1-100/img_0374-51-*` covers every size variant.
    `/blog/*` → `/news/*` keeps the rest of the path.
  - Add a query to require params: `/index.php?Itemid=105`.
- `to`: a page path (`/excavation`), a platform file (`/assets/sites/<site>/…`), an anchor (`/gallery#/gallery/polished`)
  or a full URL. Page paths get `/<slug>` in front on the LeadPages address, nothing on the custom domain.
- `code`: 301 (default), 302, 307, 308, or 410 (removed on purpose — no `to`).

Order: query rules → exact path → longest prefix. A request that is exactly a live page is always served
as normal; the same page spelled differently (`/Excavation`, `/gallery/`) 301s to the clean URL.

No rule:
- `notFound: 'smart'` (default) → last path segment that is a page → closest page by words in the URL
  (CMS noise words ignored) → parent segment that is a page → homepage.
- `'home'` → homepage. `'page'` → real 404.
- Files (images, PDFs, scripts) never fall back to a page — they 404 unless a rule covers them.

Tracking params (`utm_*`, `gclid`, `fbclid`, `msclkid` …) are carried to the new URL and not logged as
separate URLs. Responses are cached (redirects 1 h, fallbacks 10 min) with the site's cache tags, so
Publish / Save in the tab purges them. Hit counts are therefore approximate (one per cache window per region).

## Also fixed

- `robots.txt`: a static file in the repo root shadowed `/api/robots.txt`, so every client domain served the
  platform's robots.txt (pointing Google at leadpages.com.au sitemaps). Removed; the dynamic one gives the
  identical platform output on LeadPages hosts and the tenant output (own sitemap) on client domains.
- On a client domain, two-segment old URLs (`/services/excavation`) used to render the page named by the
  second segment with a 200 (duplicate content). With SEO Saver on they 301 to the right page.
- Deep paths on unknown custom domains no longer fall through to a partner showcase.

## Phase 2 — finding old addresses

SEO Saver tab → **Find the old site’s addresses**. "Find everything (free sources)" runs, in order:

1. **Old sitemap** — robots.txt `Sitemap:` lines, `/sitemap.xml`, `/sitemap_index.xml`, `/wp-sitemap.xml` …
2. **Wayback Machine** — every archived address (pages, images, PDFs), newest snapshot kept.
3. **Real visits** — old addresses already requested on the live site (`site_url_hits`).
4. **Search Console** — pages from synced Search Console data (`si_query_page_stats`) that aren't live pages.
5. **Read old pages** — each page is read from the old site (title, heading, description, text, and the links
   on it, which adds pages the sitemap missed). If the domain already points at LeadPages, or the old page is
   gone, the Wayback copy is read instead.
6. **Match** — best new page per old address.

Paid (DataForSEO, explicit second click, at most once per site per 24 h, metered in `si_provider_usage`
as `seo_saver_google` / `seo_saver_backlinks`): **Google results** (`site:domain`, up to 100) and
**Backlinks** (old pages with the most links, up to 300).

Safety: every request goes through `safeFetch` — http(s) on default ports only, no IP literals or private
networks (DNS checked), only the old domain's own hosts (or web.archive.org), size/time capped. Up to
3,000 addresses per site.

### Matching (confidence)

| Signal | Confidence |
|---|---|
| Old homepage | 99 |
| Last URL segment is a page here (`/services/excavation` → `/excavation`) | 97 (85 if it sat under another page's folder and its content only partly matches; 60 if the content points elsewhere, e.g. a gallery album) |
| Old site itself redirected it to such a page | 94 |
| The old page's text is on one new page (cosine ≥ 0.75, clear of the runner-up) | 95 |
| Otherwise title/heading (IDF-weighted) + content + URL words | scaled, lowered when the runner-up is close; URL words alone ≤ 75 |

Tested on the real Down Right old site: every match at 85%+ is the right page.

In the list: **Add all sure matches** (85%+), Add / Dismiss per row, alternatives one click away. Added
redirects carry `source: 'discover'` and the reason as the note; they go live on Save.

Rules now get a stable `id` (from the old address, `withIds()` in core) so the editor's three-way merge
combines rules added in the editor and by the monitor item by item.

## Phase 3 — daily check

`api/cron/seo-saver.js`, every live site with `seoSaver` on. Free (no paid calls):

1. New old addresses from visits and Search Console → candidates; up to 8 a day are read (Wayback copy
   once the domain is here) and everything is re-matched.
2. **Auto-add**: addresses people or Google actually requested, not covered, matched at ≥
   `seoSaver.autoMin` (default 90; 85/90/95 in the tab) → appended as `source: 'auto'` with the reason.
   Off with `seoSaver.autoAdd = false`. Writes only `seoSaver.redirects`, with an `updated_at` check
   (and bump, so an open editor merges it), then purges the site's CDN cache.
3. **Health**: broken targets, chains, self-redirects, duplicates; plus a rotating live spot-check of 20
   redirects on the domain (one 301/308 hop to a 200).
4. Summary stored in `seo_saver_runs` (kind `monitor`), shown in the tab. Nothing is ever removed or changed —
   **keep redirects for good**.

**Launch check** (tab button): once the domain points at LeadPages, requests every rule and every found
address on the host the old links used (so a www → bare-domain hop shows up as a second hop) and lists
anything that isn't one hop to a 200. Before switch-over it checks the same list against the rules.

## Launch checklist (per migrated site)

1. Before switching DNS: enter the old domain, **Find everything**, run **Backlinks** (paid) for any site with a
   real link profile, review “Need a redirect”, **Add all sure matches**, Save.
2. Site live on LeadPages; SEO Saver on.
3. Point the domain at LeadPages — redirects work from the first request.
4. Verify the domain in your own Google Search Console (Settings → Search & indexing) and submit `/sitemap.xml`.
5. Run **Launch check** straight after the switch; fix anything listed.
6. The daily check handles new old addresses; look at its summary for the first few weeks.

Tests: `tests/seo-saver.test.js`, `tests/seo-saver-phase2.test.js` (matching uses `tests/fixtures/seo-saver-drc-old-pages.json`, the real old Down Right pages).
