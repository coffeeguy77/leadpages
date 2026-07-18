# Website Studio — Current State Report

**Updated:** 2026-07-18 (Phase 4 — complete composition, neutral renderer, generation UX)  
**Scope:** Website Studio + AI Colour Assistant + Composer + Image Service + draft approval.

---

## 1. What currently works

### AI Colour Assistant (`/theme-studio`)

| Capability | Status |
|------------|--------|
| Generate / refine / approve colour tokens | Works |
| Separate from Website Studio | Yes |

### Website Studio UI (`/theme-studio-v2`, legacy path)

| Capability | Status |
|------------|--------|
| Full business brief (identity, offer, audience, conversion, brand, trust) | Works |
| Generate three structurally different concepts | Works |
| Concept comparison cards | Works |
| Neutral-shell full-page preview (desktop / mobile) | Works |
| AI refinement + change summary | Works |
| Direct edit API (schema-safe patches) | Works |
| Image approve / reject → persistent draft version | Works |
| Version history + restore (restore creates new version) | Works |
| Deterministic quality gate statuses | Works |
| Approve website draft (`approved-for-application`) | Works |
| Live apply / publish | Gated off — not Phase 4 |

### Website Composer (`lib/website-composer/`)

| Capability | Status |
|------------|--------|
| Classification / foundations / recipes | Works |
| Explicit draft (`contentInheritance: none`) | Works |
| Neutral renderer shell stamp | Works |
| Marketplace catalogue (48 apps) + final statuses | Works |
| Deterministic adapters for supported apps | Works |
| Install/activate supported apps | Works |
| Concept structural diversity | Works |
| Structured image briefs + Image Service resolution | Works |
| Quality gate (`quality-gate.js`) | Works |
| Refinement planner (`refine.js`) | Works |
| Ten business fixtures + Phase 4 tests | Works |

### Image Service (`lib/image-service/`)

| Capability | Status |
|------------|--------|
| Cloudinary owned-asset ranking | Works |
| Pexels server search | Works (needs `PEXELS_API_KEY`) |
| Mock / placeholder fallback | Works |
| Cache + duplicate prevention | Works |
| Attribution metadata | Works |
| Cloudinary import plan | Works |
| Persist image decisions API | Works |
| AI images | Superuser-only gate; partner/client blocked |

---

## 2. Composition behaviour (Phase 4)

```text
Brief → classify → foundation → recipe
      → select supported apps → adapt/install
      → content → structured image briefs
      → Image Service → validate → explicit draft
      → quality gate → diagnostics
      → preview on landing-shell-neutral-v1
```

Preserved: `contentInheritance: "none"`, `sourceTemplateId: null`.  
Trade template is **not** the Website Studio content source.

---

## 3. Marketplace coverage (summary)

| Status | Count |
|--------|------:|
| supported | 34 |
| supported-with-limitations | 13 |
| incompatible | 1 |
| requires-adapter | 0 |
| requires-metadata | 0 |
| **Total catalogued** | **48** |

Includes 5 Phase 4 Marketplace apps: `productCollection`, `clientLogos`, `bookingCta`, `brandStory`, `packageCompare`.

Full list: [MARKETPLACE-CATALOGUE.md](MARKETPLACE-CATALOGUE.md). Gaps: [MARKETPLACE-GAPS.md](MARKETPLACE-GAPS.md).

---

## 4. Neutral renderer

Drafts stamp `rendererShellId: landing-shell-neutral-v1` → `landing-shell-neutral-v1.template.json`.  
Live trade sites continue on `trade.template.json`. Details: [NEUTRAL-RENDERER.md](NEUTRAL-RENDERER.md).

---

## 5. Explicitly not done (Phase 4 stop)

- Live-site application / config overwrite  
- Marketplace template publishing  
- Production rollout / client audience enablement  
- Partner or client AI image generation  
- Full `menuBoard` hospitality catalogue app (deferred)

---

## 6. Test snapshot

| Suite | Result |
|-------|--------|
| Full `npm test` | 317 pass / 0 fail (Phase 4 landing) |
| Phase 4 suite | Marketplace finals, 10 fixtures, refine/versions, visual HTML snapshots |
