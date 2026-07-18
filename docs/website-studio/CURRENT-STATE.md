# Website Studio — Current State Report

**Audit date:** 2026-07-18  
**Scope:** Theme Studio colour MVP + Theme Studio V2 library/UI as shipped on `main`.

---

## 1. What currently works

### AI Colour Assistant (user-facing at `/theme-studio`)

| Capability | Status |
|------------|--------|
| Generate 5 trade theme hex tokens via Brain | Works |
| Refine palette | Works |
| Approve → write `sites.config.theme` | Works (live write) |
| Miniature HTML preview | Works but hardcoded tradie copy (“Blocked drain?”) |

### Theme Studio V2 stack (legacy name; UI being retargeted to Website Studio)

| Capability | Status |
|------------|--------|
| Curated multi-industry foundation registry | Works (`lib/theme-studio/foundations*`) |
| Concept schema + validator + leakage checks | Works |
| Deterministic concept generation (3 concepts) | Works without live AI |
| Draft workspace + versions (SQL or memory) | Works |
| Signed draft preview via trade template HTML | Works (partial — see gaps) |
| Refine patch → new version | Works (deterministic / Brain optional) |
| Quality advisory report | Works |
| Apply → draft workspace / non-live demo site | Works when `vertical` set |
| Superuser + partner access gate | Works server-side |
| Save My Template | Works (private / submitted flag only) |

---

## 2. How the current V2 implementation actually behaves

```text
Brief → foundation score → deterministic concept ×3
      → validate → adapt (allowlisted sites.config paths)
      → store versions → signed preview HTML
      → select / refine → apply (demo/draft site or draft JSON)
```

### Colour-only paths

- `/theme-studio` + `api/brain/theme-*` — **colours only**  
- Apply scope `colours` on V2 — stores theme subset on draft only  

### Incomplete website construction (critical)

The V2 stack **does not yet build a production-complete website**. Evidence:

| Gap | Detail |
|-----|--------|
| Trade template shell | All foundations use `sourceTemplateId: "trade"` |
| Plumber HTML defaults | `trade.template.json` ships tradie chrome; must be overridden via config |
| Field-name mismatch (mitigated) | Concept used `heading`/`subheading`; renderer needs `title`/`sub` |
| Imagery not applied | `imagery` notes ignored by adapter |
| Navigation / globalStyles / mobileRules | Not mapped to config |
| `pages: []` | No landing-page generation |
| Marketplace apps | Listed as `sourceAppIds`; not installed on `site_apps` |
| Preview ≠ full render route | Injects `trade.template.json`; not full `api/render.js` tenant resolve |
| Live publish | Explicitly out of generate path; live apply gated off |

### Shallow merge / inheritance

- Adapter starts from optional source snapshot (protected fields stripped)  
- Section fields merged **shallowly**  
- Redesign overlay is not a deep clone of editor state  
- Missing section fields on live sites still fall through to `manage.html` `DEFAULT_TRADE_SECTIONS` (trade-oriented)  

### Cross-industry leakage risk

- Mitigated by foundation incompatibilities + leakage validators  
- Residual risk: static template FAQ/JSON-LD/service cards until `applyCfg` runs  
- Colour assistant mini-preview still shows plumber marketing copy  

---

## 3. What is reusable

| System | Path | Reuse for Website Studio |
|--------|------|---------------------------|
| LeadPages Brain | `lib/brain/` | Keep as AI gateway |
| Concept schema / validator / adapter | `lib/theme-studio/*` | Seed of **Website Composer** |
| Foundation registry | `foundations-data.js` | Evolve into Marketplace Intelligence inputs |
| Draft/version tables | `db/theme_studio.sql` | Keep (legacy names) or migrate later |
| Trade renderer | `api/render.js`, `trade.template.json` | Preview/publish target |
| Editor preview pattern | `manage.html` `__applyTradeConfig` | Reference for preview UX |
| Landing draft approve UX | `api/brain/landing-draft.js` | Approval pattern |
| Marketplace catalog | `section_key` apps | App selection source |
| Service packs | `lib/trade-pack-utils.js` | Optional trade foundations |
| Cloudinary sign/upload | `api/cloudinary/*`, manage upload | Image Service provider #1 |
| Access policy | `canAccessThemeStudio` | Rename later; keep gate logic |

---

## 4. What should be kept

- AI Colour Assistant as a **separate** product surface  
- Brain gateway and existing colour tasks (`theme.generate` / `theme.refine`)  
- Verified layout/section ID constants  
- Draft-only generation rule  
- Protected-field allowlist policy  
- Superuser + partner V1 audience policy  

---

## 5. What should be rewritten

| Area | Why |
|------|-----|
| Product framing / UX copy | “Theme Studio” implied colours; product is full websites |
| Composition pipeline | Needs a named **Website Composer** with page recipes, not only foundation+deterministic fill |
| Marketplace integration | Apps must be selected and attached, not just referenced |
| Imagery | Needs **Image Service** (Cloudinary + stock providers), not text notes only |
| Preview | Should converge on secure draft render through real renderer path |
| Non-trade completeness | Trade shell + section disabling is insufficient for boutique/café quality |

---

## 6. What should be deprecated

| Item | Disposition |
|------|-------------|
| Product name “Theme Studio” for the full product | Deprecate in UI/docs; keep technical IDs temporarily |
| Colour MVP as “Theme Studio” | Already retargeted to AI Colour Assistant |
| Hardcoded “Blocked drain?” colour preview card | Deprecate / replace when Colour Assistant moves to Appearance |
| Treating foundations as tradie-only | Already partially fixed; finish via Marketplace Intelligence |

---

## 7. What should remain unchanged (this phase)

- Public URLs: `/theme-studio`, `/theme-studio-v2`, `/theme-studio/colours`  
- API routes: `/api/theme-studio/*`, `/api/brain/theme-*`  
- DB tables: `theme_studio_*`  
- Env flags: `BRAIN_THEME_STUDIO`, `THEME_STUDIO_V2`, …  
- Renderer publish behaviour  
- Editor publish flow  
- Live site generation/apply semantics (no silent changes)  

---

## 8. Inventory of “colours only / trade defaults / shallow patch” touchpoints

| Location | Behaviour |
|----------|-----------|
| `theme-studio.html` | Colours only; plumber mini-preview |
| `api/brain/theme-approve.js` | Merges theme tokens into live config |
| `lib/brain/theme-compose.js` | `DEFAULT_TRADE_THEME` |
| `lib/theme-studio/foundations-data.js` | `sourceTemplateId: 'trade'` for all |
| `lib/theme-studio/adapt-to-site-config.js` | Shallow section merge; allowlisted paths only |
| `lib/theme-studio/render-preview.js` | Trade template injection |
| `trade.template.json` | Hardcoded trade/plumber HTML defaults |
| `manage.html` `DEFAULT_TRADE_SECTIONS` | Trade default copy when fields missing |
| Apply live merge | Top-level key replace of scoped fields |

---

## Verdict

The shipped V2 stack is a **useful prototype foundation** for Website Studio (draft concepts, validation, adapter, preview skeleton). It is **not** yet the intended Website Studio product. The colour path must stay isolated as AI Colour Assistant. The next build phases should introduce Website Composer, Marketplace Intelligence, and Image Service — without changing production behaviour until approved.
