# Website Studio — Implementation Roadmap

**Rule:** No feature coding until this plan is approved after Phase 1.

---

## Phase 1 — Architecture reset ✅ (this delivery)

| Work | Detail |
|------|--------|
| Audit | Current Theme Studio / V2 / colour assistant / marketplace / renderer / images |
| Docs | `docs/website-studio/*` |
| Archive | Theme Studio docs → `docs/archive/theme-studio/` |
| Naming | Safe UI/doc renames to Website Studio + AI Colour Assistant |
| Legacy | Keep URLs, APIs, tables, env vars documented in MIGRATION.md |

**Stop:** Wait for approval before Phase 2 code.

---

## Phase 2 — Website Composer + Marketplace Intelligence + page recipes

| Work | Detail |
|------|--------|
| Composer facade | Orchestrate brief → recipe → concept → validate → adapt |
| Page recipes | Data-driven section/layout/app packs per foundation |
| Marketplace Intelligence | Scoring API over foundations + apps (file-based first) |
| Concept completeness | Map navigation/mobile/imagery slots; attach app install plan |
| Tests | Recipe selection, no leakage, adapter immutability |

**Do not:** change publish, live apply defaults, or colour assistant write path.

---

## Phase 3 — Image Service + Cloudinary + Pexels + roles

| Work | Detail |
|------|--------|
| Image Service module | Provider interface |
| Cloudinary | Reuse sign/upload; attach to draft slots |
| Pexels | Server-side search (new) |
| Permissions | Super/partner quotas; client later |
| Composer hook | Fill imagery slots after content generation |

---

## Phase 4 — Website generation UX + preview + refinement

| Work | Detail |
|------|--------|
| Website Studio UI | Multi-step intake → 3 concepts → compare (evolve current V2 UI) |
| Preview | Signed draft via real renderer path; desktop/mobile |
| Refinement | Patch → new version → preview |
| Approval | Explicit scopes; demo/draft site; live apply still gated |
| Brain tasks | Wire `theme_studio.*` / future `website_studio.*` with deterministic fallback |

---

## Phase 5 — Quality validation + regression + marketplace coverage

| Work | Detail |
|------|--------|
| Quality gates | Hard fail on leakage, missing required sections, bad apps |
| Fixtures | Jewellery, trade, café, professional, events (+ more) |
| Regression suite | No plumber defaults for non-trade; no jewellery leakage into trade |
| Marketplace coverage | Every foundation has recipe + app set + preview smoke |
| Docs soak | Update CURRENT-STATE when behaviour matches vision |

---

## Explicit non-goals until approved

- Blind rename of `api/theme-studio` or `theme_studio_*` tables  
- Renderer rewrites  
- Publish pipeline changes  
- Absorbing AI Colour Assistant into Website Studio  
- Client audience enablement without flag  

---

## Suggested approval gates

1. Approve Phase 1 docs/naming (now)  
2. Approve Phase 2 Composer/Intelligence scope  
3. Approve Phase 3 Image Service providers + budget  
4. Approve Phase 4 UX cutover (when `/theme-studio-v2` becomes Website Studio for users)  
5. Approve Phase 5 exit criteria for “V1 complete”  
