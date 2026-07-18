# Website Studio — Implementation Roadmap

**Rule:** Phase 3+ feature coding waits for approval after each phase stop.

Architecture → Composer → Marketplace/Images → Generation UX → Controlled application (flagged).

## Phases 1–4 ✅

| Work | Detail |
|------|--------|
| Audit | Current Theme Studio / V2 / colour assistant / marketplace / renderer / images |
| Docs | `docs/website-studio/*` |
| Archive | Theme Studio docs → `docs/archive/theme-studio/` |
| Naming | Safe UI/doc renames to Website Studio + AI Colour Assistant |
| Legacy | Keep URLs, APIs, tables, env vars documented in MIGRATION.md |

---

## Phase 2 — Website Composer + Marketplace Intelligence + page recipes ✅

| Work | Detail |
|------|--------|
| Composer | `lib/website-composer/` — brief → classify → foundation → recipe → content → draft |
| Foundations | Structural-only registry; `sourceTemplateId` removed |
| Recipes | Independent marketplace recipes (`recipes-data.js`) |
| Explicit compose | `buildDraftConfig` — no trade shallow merge; unused sections off |
| Provenance + diagnostics | Per-section ownership + composition diagnostics |
| Image briefs | Placeholder descriptors only (no Image Service) |
| Tests / fixtures | Six businesses in `tests/website-composer.test.js` |

**Stop:** Wait for approval before Phase 3 (Image Service). Do not change publish.

---

## Phase 3 — Marketplace coverage + Image Service ✅

| Work | Detail |
|------|--------|
| Image Service module | Provider interface |
| Cloudinary | Reuse sign/upload; attach to draft slots |
| Pexels | Server-side search (new) |
| Permissions | Super/partner quotas; client later |
| Composer hook | Resolve image briefs after content generation |

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

## Phase 6+ (not started)

| Work | Detail |
|------|--------|
| Quality gates | Hard fail on leakage, missing required sections, bad apps |
| Fixtures | Expand beyond the six Composer fixtures |
| Regression suite | No plumber defaults for non-trade; no jewellery leakage into trade |
| Marketplace coverage | Every foundation has recipe + app set + preview smoke |
| Docs soak | Update CURRENT-STATE when behaviour matches vision |

**Stop:** No partner/client enablement. No publish. No live Bean Culture replacement.

## Next (not started)

- Blind rename of `api/theme-studio` or `theme_studio_*` tables  
- Full production renderer rewrite  
- Publish pipeline changes  
- Absorbing AI Colour Assistant into Website Studio  
- Client audience enablement without flag  

---

## Suggested approval gates

1. Approve Phase 1 docs/naming ✅  
2. Approve Phase 2 Composer/Intelligence ✅ (implemented — awaiting soak approval)  
3. Approve Phase 3 Image Service providers + budget  
4. Approve Phase 4 UX cutover  
5. Approve Phase 5 exit criteria for “V1 complete”  
