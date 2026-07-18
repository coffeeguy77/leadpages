# Website Studio — Current State Report

**Updated:** 2026-07-18 (Phase 3 Marketplace + Image Service)  
**Scope:** Website Studio + AI Colour Assistant + Composer + Image Service.

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
| Draft workspace + versions | Works |
| Generate → preview → refine → approve | Works (generation via Composer) |
| Image panel (search / approve / import plan) | Prepared (Phase 3) |
| Signed draft preview + shell neutralize | Works |
| Live apply | Gated off by default |

### Website Composer (`lib/website-composer/`)

| Capability | Status |
|------------|--------|
| Classification / foundations / recipes | Works |
| Explicit draft (`contentInheritance: none`) | Works |
| Marketplace catalogue + metadata | Works |
| Deterministic app adapters | Works |
| Install/activate supported apps | Works |
| Concept structural diversity | Works |
| Structured image briefs + direction | Works |
| Image Service resolution | Works |
| Six business fixtures + tests | Works |

### Image Service (`lib/image-service/`)

| Capability | Status |
|------------|--------|
| Cloudinary owned-asset ranking | Works |
| Pexels server search | Works (needs `PEXELS_API_KEY`) |
| Mock / placeholder fallback | Works |
| Cache + duplicate prevention | Works |
| Attribution metadata | Works |
| Cloudinary import plan | Works (upload via existing sign) |
| AI images | Interface + superuser gate; not implemented |

---

## 2. Composition behaviour (Phase 3)

```text
Brief → classify → foundation → recipe
      → select supported apps → adapt/install
      → content → structured image briefs
      → Image Service → validate → explicit draft
      → diagnostics
```

Trade content inheritance remains removed. Preview shell remains technical `landing-shell-v1`.

---

## 3. Marketplace coverage (summary)

| Status | Count |
|--------|------:|
| supported | 20 |
| requires-adapter | 16 |
| requires-metadata | 4 |
| supported-with-limitations | 3 |
| **Total catalogued** | **43** |

Full list: [MARKETPLACE-CATALOGUE.md](MARKETPLACE-CATALOGUE.md). Gaps: [MARKETPLACE-GAPS.md](MARKETPLACE-GAPS.md).

---

## 4. Renderer-shell investigation

| Finding | Detail |
|---------|--------|
| Shell asset | `trade.template.json` contains plumbing/suburb/cert defaults |
| Composer defence | Unused sections `on: false`; no content inheritance |
| Preview defence | `ws-shell-neutralize` wipes known trade fallback strings |
| Production | `api/render.js` unchanged — relies on complete config |
| Remaining risk | JSON-LD / suburb grids / JS demo arrays not fully wiped; documented in diagnostics |

---

## 5. Unchanged this phase

- Live publish pipeline  
- Live apply defaults  
- Public URLs `/theme-studio*` (legacy identifiers)  
- DB tables `theme_studio_*`  
- Colour Assistant write path  
- No Marketplace template publishing  

---

## Verdict

Phase 3 delivers Marketplace Intelligence (catalogue, metadata, adapters, install) and a shared Image Service (Cloudinary + Pexels + permissions). Composer drafts look like plausible business sites with matched content and stored imagery metadata. Publishing and live application remain gated until Phase 4+ approval.
