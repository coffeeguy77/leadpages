# SEO Saver (old-URL redirects)

Keeps the rankings a business earned on its old website when it moves to LeadPages.
Every old address 301-redirects to its new page in one hop; addresses nobody mapped are
caught, sent to the closest page (or home), and listed in the editor for review.

Phase 1 (this): redirect engine, hit logging, editor tab, Down Right Concreting map.
Phase 2 (next): automatic discovery (crawl old site before switch-over, Wayback Machine,
search results, DataForSEO backlinks) and auto-matching by content.
Phase 3: daily monitor — auto-adds high-confidence matches for new 404s, post-launch check.

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

## Launch checklist (per migrated site)

1. Build the redirect map before switching DNS (the old site must still be up to crawl).
2. Site live on LeadPages; SEO Saver on.
3. Point the domain at LeadPages — redirects work from the first request.
4. Verify the domain in your own Google Search Console (Settings → Search & indexing) and submit `/sitemap.xml`.
5. Watch the SEO Saver tab's "Old addresses to review" for the first few weeks.

Tests: `tests/seo-saver.test.js`.
