# Website Studio — Implementation Roadmap

**Rule:** Feature coding waits for approval after each phase stop.

---

## Phase 1 — Architecture reset ✅

Docs, archive, safe UI renames. No feature behaviour change.

---

## Phase 2 — Website Composer ✅

| Work | Detail |
|------|--------|
| Composer | `lib/website-composer/` pipeline |
| Foundations | Structural-only; `sourceTemplateId` removed |
| Recipes | Independent marketplace recipes |
| Explicit compose | No trade shallow merge |
| Image briefs | Placeholders only |
| Fixtures / tests | Six businesses |

---

## Phase 3 — Marketplace coverage + Image Service ✅

| Work | Detail |
|------|--------|
| Marketplace audit | Verified catalogue (43 apps) + support statuses |
| AI metadata | Curated selection metadata for supported apps |
| Deterministic adapters | `adapters/registry.js` |
| Install / activate | `install-apps.js` into draft |
| Layout / concept diversity | Hero, order, trust strategy |
| Marketplace gaps | Documented (not all apps built) |
| Image Service | Cloudinary + Pexels + permissions |
| Structured image briefs | Direction profiles + ranking |
| Draft image UI | Prepared on `/theme-studio-v2` |
| Renderer shell | Investigation + preview neutralize |
| Tests | Composer + Image Service + Phase 3 suites |

**Stop:** Do not begin Phase 4 until approved. Do not change publish.

---

## Phase 4 — Website generation UX + preview + refinement

| Work | Detail |
|------|--------|
| UX polish | Multi-step intake → compare → refine |
| Image panel | Persist approvals onto draft versions |
| Preview | Closer production parity where safe |
| Approval | Explicit scopes; live apply still gated |
| Brain tasks | Wire with deterministic fallback |

---

## Phase 5 — Quality validation + regression + marketplace coverage

| Work | Detail |
|------|--------|
| Quality gates | Hard fail on leakage / missing apps |
| More adapters | Close high-priority gaps |
| Regression | Expand fixtures |
| Docs soak | Keep CURRENT-STATE accurate |

---

## Explicit non-goals until approved

- Blind rename of `api/theme-studio` or `theme_studio_*` tables  
- Full production renderer rewrite  
- Publish pipeline changes  
- Absorbing AI Colour Assistant into Website Studio  
- Client audience enablement without flag  
- New paid AI image provider  
