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
| Marketplace audit | Verified catalogue + support statuses |
| Deterministic adapters | Core 20 supported apps |
| Image Service | Cloudinary + Pexels + permissions |
| Preview neutralize | Temporary leakage guards |

---

## Phase 4 — Complete composition + neutral renderer + generation UX ✅

| Work | Detail |
|------|--------|
| Marketplace finals | All 43 prior apps + 5 new = 48; no deferred `requires-*` |
| New Marketplace apps | productCollection, clientLogos, bookingCta, brandStory, packageCompare |
| Neutral shell | `landing-shell-neutral-v1` for Studio drafts |
| Leakage / quality gate | Deterministic validation + cross-industry detector |
| Brief → 3 concepts → compare | Full UX on `/theme-studio-v2` |
| Image persistence | Approve / reject / import-plan on draft versions |
| Refinement + direct edit | Planner + schema-safe patches; new versions |
| Version restore | Restore creates a new version |
| Draft approval | `approved-for-application` — not publish |
| Fixtures | Ten businesses + visual HTML snapshots |

**Stop:** Do not begin live application, Marketplace publishing, or production rollout until approved.

---

## Phase 5 — Live application (not started)

| Work | Detail |
|------|--------|
| Controlled apply | Diff + migration from approved draft |
| Publish gates | Explicit scopes; preserve production safety |
| Remaining gaps | e.g. `menuBoard` if still required |
| Audience rollout | Partner/client flags when approved |

---

## Explicit non-goals until approved

- Blind rename of `api/theme-studio` or `theme_studio_*` tables  
- Full production renderer rewrite beyond the neutral shell entry  
- Publish pipeline changes  
- Absorbing AI Colour Assistant into Website Studio  
- Client audience enablement without flag  
- New paid AI image provider for partners/clients  
