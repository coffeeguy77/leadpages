# Theme Studio Implementation Audit & Rebuild Plan

**Document:** `AI/THEME-STUDIO-IMPLEMENTATION-AUDIT`  
**Status:** Audit complete — **Phases 1–10 implemented** (see [23-THEME-STUDIO-V2](23-THEME-STUDIO-V2.md)).  
**Date:** 2026-07-17  
**Audience:** Product + engineering (AI agents and humans)  
**Related:** [23-THEME-STUDIO-V2](23-THEME-STUDIO-V2.md), [21-THEME-STUDIO](21-THEME-STUDIO.md) (AI Colour Assistant), [00-STATUS](00-STATUS.md), [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md)

> **Product URL:** `/theme-studio-v2`. Colour tokens remain at `/theme-studio` (AI Colour Assistant).  
> Live production apply stays off unless `THEME_STUDIO_ALLOW_LIVE_APPLY=1`.

---

## 1. Executive summary — why the current implementation is insufficient

Today’s Theme Studio (`/theme-studio`) is an **AI colour-token generator**:

1. Operator picks an existing site + short brief/mood.  
2. Brain tasks `theme.generate` / `theme.refine` return five hex tokens (`pipe`, `hivis`, `steel`, `safety`, `lightBg`).  
3. UI shows swatches + a **hardcoded** miniature preview (“Blocked drain?” / tradie CTA).  
4. Approve merges tokens into `sites.config.theme` on the **live** site row.

That is useful as a palette assistant. It is **not** the approved product vision:

| Vision requirement | Current state |
|--------------------|---------------|
| Complete website design (layout, sections, apps, content, imagery) | Colours only |
| Real renderer preview (desktop + mobile) | Fake mini card; often wrong industry copy |
| Business brief → structured site config | Brief → hex object |
| Three distinct concepts | One palette at a time |
| Draft / duplicate before apply | Writes live `sites.config.theme` |
| Marketplace template foundation | Unused |
| Refinement patches on full design | Colour refine only |
| Version history / rollback | Undo stack in browser memory only |
| Create new / demo / template save modes | Existing `siteId` required |

**Disposition of current code:** Keep Brain colour tasks + approve pattern as the seed for **AI Colour Assistant**. Rebuild Theme Studio as a separate multi-step product that outputs a **validated concept schema**, adapted into trade `sites.config` (and later other templates), previewed via the existing renderer, applied only to drafts after explicit approval.

---

## 2. Audit findings (what exists today)

### 2.1 Current Theme Studio

| Piece | Path |
|-------|------|
| UI | `theme-studio.html` → `/theme-studio` (Ops Command panel) |
| APIs | `api/brain/theme-generate.js`, `theme-refine.js`, `theme-approve.js` |
| Schema | `lib/brain/theme-compose.js` |
| Prompts | `lib/brain/prompts/defaults.js` (`theme.generate`, `theme.refine`) |
| Routes | `lib/brain/config.js` (structured, maxTokens ~1024) |
| Flag | `BRAIN_THEME_STUDIO` (default on) via `lib/brain/platform.js` |
| Spec | `docs/AI/21-THEME-STUDIO.md` (documents colour-token scope) |

**Approve write path:** service-role update of `sites.config.theme` with `source: 'theme_studio'`, `approvedAt`, `approvedBy`. Does **not** use editor publish flow; can race with unsaved `manage.html` state.

### 2.2 Site configuration schema (trade — primary)

Authoritative editing surface: `manage.html` (`loadSite`, `publishToDB`, `lpSeedTrade`).

| Key | Role |
|-----|------|
| `theme` | `{ pipe, hivis, steel, safety, lightBg, presetName?, accent? }` — `DEFAULT_TRADE_THEME` |
| `layout` | Layout id from `LAYOUTS` recipes |
| `sectionOrder` | Optional override of section sequence |
| `sections.*` | Per-section content/flags — `DEFAULT_TRADE_SECTIONS` (~40 keys) |
| `services[]` | Service cards |
| `pages[]` | SEO landing pages |
| `logo` | Includes `headerStyle`: `solid-sticky` \| `solid-scroll` \| `float` \| `shrink` |
| `trade`, contact, SEO fields | Identity |
| `appearance` | **Broker-app only** (`fontDisplay`, `fontUi`, brand colours) — not trade Theme Studio today |

Trade sites do **not** currently expose first-class typography tokens in `config.theme`; fonts are largely template CSS. Broker appearance fonts are a reuse candidate for trade typography expansion.

### 2.3 Renderer entry points

| Path | Role |
|------|------|
| `api/render.js` | Public HTML; injects `__SITE_CONFIG__` / theme CSS vars |
| `injectTradeThemeVars` | Maps theme → `--pipe`, `--hivis`, `--steel-*`, `--safety`, `--light` |
| `marketplace/demos/demo-shared.js` | Client `__applyTradeConfig` |
| `manage.html` `previewLoad` / `previewApply` / `previewSetMode` | Editor iframe preview; mobile ~412px width |

**Implication:** Concept previews must load a draft config into this pipeline (iframe or dedicated preview API), not a static card.

### 2.4 Theme packs / service packs

| System | Path | Notes |
|--------|------|-------|
| Trade service packs | `lib/trade-pack-utils.js` `mergePackIntoConfig`, `service_packs` table, `TRADE_PACKS` in manage | Seeds theme + sections + services |
| AI pack generate | Brain `pack.trade_generate` | Large structured JSON |
| Broker “Theme Packs” | `demo_themes` / `partner_themes` | Appearance looks — **not** trade Theme Studio |
| Colour presets | `TRADE_COLOUR_PRESETS` / `themeFromPreset` | Industry palettes |

Pack merge is the closest existing “assemble a site” path — but it is tradie-oriented and not concept-compare UX.

### 2.5 Sections, layouts, variants

Evidence in `manage.html`:

- `LAYOUTS` — classic, quote-first, photo-proof, emergency-response, authority-builder, service-area-dominator, reviews-first, premium-showcase, offer-funnel, slider variants, social-proof-feed, etc.  
- `TRADE_SUBTABS` / `OPTIONAL_COMPONENTS` / `OFF_BY_DEFAULT_SECTIONS`  
- Hero exclusivity: `hero` / `heroSlider` / `heroBeforeAfter` / `splitHero` compete  
- Header via `logo.headerStyle`; footer via `sections.footer` + always-on `lpFooter`

### 2.6 App Marketplace

| Piece | Path |
|-------|------|
| Categories | `lib/marketplace-categories.js` — heroes-layout, core-content, social-proof, trust-conversion, social-instagram |
| Catalog seed | `lib/marketplace-catalog-seed.js`, `lib/marketplace-data.js` |
| Attach | `site_apps` ↔ `section_key` via `_reconcileSiteApps` / `api/api-site-apps.js` |
| Admin | `marketplace-admin.html`, `apps-admin` |

**Metadata gap (critical):** Categories describe **section type**, not industry, visual style, conversion style, or template suitability. There is no AI-readable foundation metadata for “jewellery / luxury / retail”. A compatibility / metadata layer is required (Phase 1).

### 2.7 Site creation, demos, duplication

| Flow | Path | Notes |
|------|------|-------|
| Create site | `openCreateSite` / `createSiteSubmit` in `manage.html` | Pack + location; inserts `sites` |
| Partner mockup | `api/partner/add-mockup.js` | `is_mockup: true` |
| Demo flags | `is_demo`, `is_mockup` | |
| Legacy create | `api/create-site.js` | Minimal; pack-unaware |
| **Clone / duplicate** | **Not found** as first-class API | Gap for “redesign existing without overwriting live” |

Theme Studio V1 needs a **draft site** or **config snapshot** mechanism (new table or clone API).

### 2.8 Editor apply / save

- Preview: in-memory `data` + `previewApply`  
- Publish: `publishToDB()` → Supabase `sites.config`  
- Landing pages: `lpSaveDB`  
- Theme Studio approve: direct admin write of `theme` only  

Landing draft pattern (`api/brain/landing-draft.js` → suggest → `#lp-approve` → apply) is the **correct UX pattern** to copy for full Theme Studio.

### 2.9 Brain interfaces

- `getPlatformBrain()`, `generate` / `generateStructured`  
- Existing: `theme.generate`, `theme.refine`, `content.landing_draft`, `pack.trade_generate`, …  
- Durable usage: `ai_requests`; durable settings: `brain_settings`  
- Provider routing already in Brain — Theme Studio UI must not show “Generated via Anthropic” to normal users  

### 2.10 Existing generation / starter logic

Closest full-site bootstrap = create site + `mergePackIntoConfig` + colour presets + layouts.  
No end-to-end “business brief → three concepts → renderer preview → approve draft” product exists.

---

## 3. Reusable systems vs new systems required

### Reuse (do not rebuild)

1. Brain gateway + adapters + Control Centre  
2. Trade `sites.config` contract + `DEFAULT_TRADE_*` / `LAYOUTS`  
3. `api/render.js` + `__applyTradeConfig` + editor iframe preview  
4. `mergePackIntoConfig` / service packs as optional foundations  
5. Marketplace `section_key` ↔ `site_apps` attach  
6. Landing-draft suggest → human approve UX pattern  
7. Colour token normalize (`theme-compose.js`) as **AI Colour Assistant** core  
8. Auth / site-access helpers (`lib/brain/http.js`)

### New systems required

1. **Concept schema** (`theme_studio.concept.v1`) + runtime validator  
2. **Deterministic adapter** concept → `sites.config` (allowlisted keys only)  
3. **Marketplace / foundation metadata** for AI selection  
4. **Draft workspace** (config snapshots / draft sites) — never write live on generate  
5. **Version history** table + undo/redo of concepts/patches  
6. **Multi-step Theme Studio UI** (intake → concepts → compare → refine → quality → apply)  
7. **Preview API** that renders a draft config through the real renderer  
8. **Refinement patch** schema + apply/preview/accept  
9. **Quality report** (deterministic checks + advisory AI notes)  
10. **Brain task suite** for analysis, template selection, concept gen, content, imagery, refine, a11y  
11. Relocate colour UI → **AI Colour Assistant** in Appearance  

---

## 4. Proposed architecture

```text
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│ Theme Studio UI │────▶│ Brain tasks      │────▶│ Concept schema v1  │
│ (multi-step)    │     │ (structured)     │     │ + validator        │
└────────┬────────┘     └──────────────────┘     └─────────┬──────────┘
         │                                                   │
         │                                                   │
         │ preview                                           ▼
         │                                       ┌────────────────────┐
         │                                       │ Config adapter     │
         │                                       │ (allowlisted map)  │
         ▼                                       └─────────┬──────────┘
┌─────────────────┐                                         │
│ Preview service │◀──── draft config snapshot ─────────────┘
│ render.js path  │
└────────┬────────┘
         │ approve
         ▼
┌─────────────────┐     ┌──────────────────┐
│ Apply options   │────▶│ Draft site /     │
│ (scoped write)  │     │ snapshot apply   │──▶ never live without confirm
└─────────────────┘     └──────────────────┘

Parallel product:
Editor → Appearance → AI Colour Assistant (theme.generate/refine tokens only)
```

**Central rule:**  
Business brief → AI structured concept → validate → adapt → real renderer preview → refine patches → quality report → explicit approve → draft apply / save template.

---

## 5. Proposed user flow

1. **Start** — mode: new site | redesign existing | demo | from marketplace template | restyle only | save as template  
2. **Business brief** — guided intake + plain-language prompt  
3. **Choose foundation** — marketplace template / pack / blank (with compatibility scores)  
4. **Generate concepts** — three distinct concepts (not three palettes)  
5. **Compare** — desktop + mobile renderer previews, rationale, tokens, sections, foundation  
6. **Refine** — chat → structured patch → preview → accept / undo  
7. **Quality review** — deterministic + advisory report  
8. **Apply or save** — scoped apply to draft only; template save; cancel  

Scope controls on redesign: styling only / styling+layouts / complete redesign; keep vs rewrite content; preserve forms, tracking, domains, publishing.

---

## 6. Proposed structured concept schema (outline)

Versioned: `theme_studio.concept.v1`

```json
{
  "schemaVersion": 1,
  "conceptId": "uuid",
  "conceptName": "Premium Editorial",
  "rationale": "…",
  "sourceTemplateId": "string|null",
  "sourceAppIds": ["hero", "services", "…"],
  "sourcePackId": "string|null",
  "businessProfile": {
    "businessName": "",
    "industry": "",
    "specialisation": "",
    "location": "",
    "audience": "",
    "tone": "",
    "conversionGoal": ""
  },
  "theme": {
    "pipe": "#…", "hivis": "#…", "steel": "#…", "safety": "#…", "lightBg": "#…",
    "presetName": ""
  },
  "typography": {
    "fontDisplay": "Fraunces",
    "fontUi": "DM Sans"
  },
  "globalStyles": {
    "buttonTreatment": "solid|outline|pill",
    "cardTreatment": "flat|elevated|bordered",
    "motionDirection": "subtle|none",
    "density": "airy|balanced|compact",
    "colorMode": "light|dark|mixed"
  },
  "header": { "headerStyle": "solid-sticky|…", "ctaLabel": "" },
  "navigation": { "items": [{ "label": "", "target": "" }] },
  "layoutId": "premium-showcase",
  "sectionOrder": ["emerg", "hero", "services", "…"],
  "sections": {
    "hero": { "variant": "hero|heroSlider|…", "on": true, "content": {} },
    "services": { "on": true, "content": {}, "items": [] }
  },
  "pages": [],
  "callsToAction": { "primary": {}, "secondary": {} },
  "imagery": [{ "sectionKey": "hero", "subject": "", "composition": "", "altDirection": "" }],
  "footer": {},
  "mobileRules": { "notes": [] },
  "accessibilityNotes": [],
  "preservedFields": ["custom_domain", "owner_email", "tracking", "forms"],
  "generatedFields": ["theme", "sections", "services", "layout"],
  "placeholders": [{ "field": "reviews[0]", "reason": "invented_social_proof" }],
  "validationStatus": "pending|valid|invalid",
  "warnings": []
}
```

**Adapter rule:** Only map keys present in an allowlist derived from `DEFAULT_TRADE_SECTIONS`, `LAYOUTS`, marketplace `section_key`s, and known theme/logo fields. Reject unknown keys. Never let the model write arbitrary config.

---

## 7. App Marketplace integration design

### Current capability

- Apps identified by `section_key`  
- Categories = section taxonomy  
- Enable/disable via `site_apps`  

### Required metadata (proposed table or JSON column)

`marketplace_foundations` / extend `app_registry` + new `site_templates` metadata:

| Field | Purpose |
|-------|---------|
| `foundation_id` | Stable id |
| `display_name` | UI |
| `industries[]` | jewellery, trade, hospitality, … |
| `visual_styles[]` | luxury, editorial, hi-vis, minimal, … |
| `conversion_style` | call, quote, book, ecommerce-lite |
| `supported_section_keys[]` | Compatibility |
| `default_layout_id` | LAYOUTS id |
| `header_options[]` | Allowed headerStyle values |
| `footer_options[]` | |
| `page_types[]` | home, landing, … |
| `mobile_profile` | Notes / constraints |
| `incompatible_with[]` | Foundation ids / section combos |
| `suitable_for_demo` | bool |

**AI may:** select one foundation, add compatible apps, recommend apps.  
**AI must not:** merge incompatible config structures or invent section_keys not in registry/LAYOUTS.

Until metadata exists, V1 can use a **hand-curated foundation registry** in code (JSON) covering existing LAYOUTS + packs, then migrate to DB.

---

## 8. Draft / versioning strategy

### Principle

Generation never mutates the live published site. All work happens on:

1. **`theme_studio_drafts`** — workspace row linked to `source_site_id` (nullable for new)  
2. **`theme_studio_versions`** — immutable snapshots per generate/refine  

### Suggested tables

```sql
-- theme_studio_drafts
id uuid PK
owner_user_id uuid
mode text  -- new|redesign|demo|template|restyle
source_site_id text null
target_site_id text null  -- draft site if created
status text  -- open|applied|cancelled
brief jsonb
foundation_id text null
selected_concept_id text null
created_at, updated_at

-- theme_studio_versions
id uuid PK
draft_id uuid FK
version_number int
kind text  -- generate|refine|manual|rollback
concept jsonb          -- validated concept schema
config_snapshot jsonb  -- adapted sites.config subset
patch jsonb null       -- refinement patch
prompt text null
brain_task_id text
provider text, model text, prompt_version int
correlation_id text
validation jsonb
created_by uuid
created_at
```

Apply options write **only** after confirmation, to:

- a newly created draft/demo site, or  
- a duplicated config on a non-live target, or  
- scoped fields on the source site **only** when the user explicitly chooses apply-to-existing after confirm (still preferably via draft merge).

Rollback = restore a prior `config_snapshot` onto the draft.

---

## 9. Phased implementation plan

### Phase 0 — Audit & architecture correction ✅ (this document)

| Item | Detail |
|------|--------|
| Deliverable | This audit + plan approval gate |
| Files | `docs/AI/THEME-STUDIO-IMPLEMENTATION-AUDIT.md`; mark `21-THEME-STUDIO.md` as colour-assistant / superseded for full product |
| Behaviour | **No production code changes** |
| DoD | Stakeholders approve phases + first implementation phase |

### Phase 1 — Marketplace / foundation metadata & compatibility model ✅

| Item | Detail |
|------|--------|
| Create | `lib/theme-studio/foundations.js` + `foundations-data.js` (curated registry; file-based) |
| Modify | Docs indexes only; no live Theme Studio UI |
| DB | Deferred — no foundations table yet |
| API | Deferred to Phase 3 |
| UI | None |
| Tests | `tests/theme-studio-phase1-2.test.js` |
| DoD | Foundations queryable in-process with industry/style scoring + incompatibilities — see [23](23-THEME-STUDIO-V2.md) |

### Phase 2 — Concept schema + config adapter ✅

| Item | Detail |
|------|--------|
| Create | `concept-schema.js`, `validate-concept.js`, `adapt-to-site-config.js`, leakage, access, brain-contracts |
| Modify | None of live Theme Studio / site writes |
| Tests | Fixtures → valid draft config; reject unknown keys; leakage; immutability |
| DoD | Deterministic adapter + validator; no AI required — see [23](23-THEME-STUDIO-V2.md) |

### Phase 3 — Business intake + draft creation

| Item | Detail |
|------|--------|
| Create | `theme-studio-v2.html` (or rebuild route), `api/theme-studio/drafts.js` |
| DB | `theme_studio_drafts`, `theme_studio_versions` |
| API | CRUD drafts; create draft site / snapshot from source |
| UI | Steps Start + Business Brief |
| Risks | Clone gap — implement snapshot copy of `sites.config` |
| Rollback | Feature flag `THEME_STUDIO_V2=0` |
| DoD | User can open a draft workspace without touching live theme |

### Phase 4 — Concept generation via Brain

| Item | Detail |
|------|--------|
| Create | Brain tasks: `theme_studio.business_analysis`, `theme_studio.template_selection`, `theme_studio.concept_generation`, `theme_studio.content_generation` |
| API | `POST /api/theme-studio/generate-concepts` → 3 validated concepts |
| Modify | `lib/brain/config.js`, `prompts/defaults.js` |
| Risks | Cost/latency; model inventing sections — mitigated by schema |
| Rollback | Disable task flags |
| DoD | Three distinct concepts stored as versions; invalid output discarded |

### Phase 5 — Renderer-based concept previews

| Item | Detail |
|------|--------|
| Create | `api/theme-studio/preview.js` — render adapted config (signed draft token or temp slug) |
| UI | Desktop + mobile iframe using real renderer |
| Modify | Possibly `api/render.js` preview mode for draft configs |
| Risks | Cache; auth leakage of draft configs |
| Rollback | Hide preview; keep JSON compare |
| DoD | Preview shows correct business name/content — never “Blocked drain” for a jeweller |

### Phase 6 — Concept comparison & selection

| Item | Detail |
|------|--------|
| UI | Compare 3 concepts; select one as `selected_concept_id` |
| API | `POST /api/theme-studio/select-concept` |
| DoD | Selection persists; others retained in version history |

### Phase 7 — Refinement patches & version history

| Item | Detail |
|------|--------|
| Brain | `theme_studio.refinement` → structured patch |
| Create | `lib/theme-studio/apply-patch.js`, undo/redo against versions |
| UI | Refinement chat + change summary + preview/accept |
| DoD | Patch validated; accept creates new version; undo restores prior |

### Phase 8 — Approval & controlled application

| Item | Detail |
|------|--------|
| API | `POST /api/theme-studio/apply` with scope enum |
| Scopes | colours \| theme+type \| layouts+styling \| complete \| new site \| demo \| my template |
| UI | Preserve/replace summary + confirm |
| DoD | Live site unchanged until confirm; scoped writes only |

### Phase 9 — Quality checks & mobile validation

| Item | Detail |
|------|--------|
| Create | `lib/theme-studio/quality-report.js` — contrast heuristics, missing content, invalid apps, hero rules |
| Brain | Optional `theme_studio.accessibility_review` (advisory) |
| DoD | Pre-approval report; no false WCAG certification claims |

### Phase 10 — Template saving & marketplace workflow

| Item | Detail |
|------|--------|
| API | Save as My Template; superuser submit to marketplace |
| DB | Partner/private templates storage |
| DoD | Permissions enforced; submitted templates enter review queue |

### Disposition phase (parallel / early)

| Item | Detail |
|------|--------|
| Move | Current `/theme-studio` colour flow → Editor Appearance **AI Colour Assistant** |
| Rename | Ops panel “Theme Studio” → new V2 when ready; colour tool renamed |
| Keep | `theme.generate` / `theme.refine` Brain tasks for Colour Assistant |

---

## 10. Files expected to change (by area)

| Area | Likely create | Likely modify |
|------|---------------|---------------|
| Docs | `THEME-STUDIO-IMPLEMENTATION-AUDIT.md` (this), update `21`, `00-STATUS`, roadmap | |
| Brain | New prompts/routes for `theme_studio.*` | `config.js`, `prompts/defaults.js`, `platform.js` |
| Theme Studio core | `lib/theme-studio/*` | — |
| API | `api/theme-studio/*` | Optionally `api/render.js` preview mode |
| UI | New multi-step Theme Studio HTML/JS | `command.html`, `vercel.json`, later `manage.html` Appearance |
| Colour assistant | Appearance panel integration | Retire/rename current `theme-studio.html` product branding |
| DB | `db/theme_studio_*.sql` | — |
| Tests | `tests/theme-studio-*.test.js` | — |
| Marketplace | Foundation metadata seed | `marketplace-categories` / admin later |

---

## 11. Database changes expected

1. `theme_studio_drafts`  
2. `theme_studio_versions`  
3. Optional `theme_studio_foundations` (or JSON seed first)  
4. Optional private `partner_site_templates` for “Save as My Template”  
5. No change to live `sites` schema required initially — drafts store config snapshots in jsonb  

RLS: service-role for Brain APIs; super/partner policies as product decides.

---

## 12. Risks & open decisions

| Risk / decision | Recommendation |
|-----------------|----------------|
| No site clone API | Phase 3: snapshot config into draft; optional create `is_demo`/`draft` site |
| Trade typography weak | Extend adapter to write font CSS vars or `config.theme.fonts` consumed by render |
| Marketplace metadata missing | Start with curated foundations file; DB later |
| Cost of 3 full concepts | Cap tokens; generate layout skeleton then content pass |
| Live overwrite | Forbid generate→live; apply only with scope + confirm |
| Jewellery vs trade template | May need non-tradie section copy packs; don’t force drain/plumber sections |
| Who can use Theme Studio? | V1: super-admin; V1.1: partners |
| Naming collision with broker Theme Packs | Call broker packs “Appearance packs”; Theme Studio = full design system |
| Current Theme Studio URL | Keep colour assistant at `/theme-studio/colours` or Appearance; V2 at `/theme-studio` after cutover |

### Open decisions needing product sign-off

1. V1 audience: super-only vs partners?  
2. Apply-to-existing-site allowed in V1, or draft/demo only?  
3. Is creating a real `sites` row required for preview, or is unsigned preview render enough?  
4. Minimum foundation set for non-trade industries (jewellery, hospitality)?  
5. Approval gate for Phase 1 vs Phase 2 as first coding phase?

---

## 13. Recommendation for the first implementation phase

**After Phase 0 approval, implement Phase 1 + Phase 2 together as the first coding milestone** (still no user-facing Theme Studio V2 UI):

1. Curated foundation registry + compatibility rules.  
2. Concept schema + validator + adapter to trade `sites.config`.  
3. Fixture-based tests proving a “Pink Diamond Vault” concept does **not** emit tradie drain copy and maps to valid renderer config.

**Do not** extend the current colour-only `/theme-studio` screen into the full product.  
**Do** schedule Colour Assistant relocation as a small parallel PR once V2 shell exists.

---

## 14. Current feature disposition (confirmed)

| Feature | Disposition |
|---------|-------------|
| Current Theme Studio colour generate/refine/approve | Retarget as **AI Colour Assistant** in Editor → Appearance |
| Brain tasks `theme.generate` / `theme.refine` | Keep for Colour Assistant |
| Spec `21-THEME-STUDIO.md` | Mark superseded for full product; point here |
| Full Theme Studio vision | New product per phases 1–10 |

---

## 15. Definition of done — Theme Studio V1 (product)

A user can:

1. Choose existing site or create draft  
2. Enter business brief  
3. Optionally choose marketplace/foundation  
4. Generate three distinct full-site concepts  
5. Preview each via actual renderer  
6. Desktop + mobile preview  
7. Select a concept  
8. Refine with plain language  
9. Validate configuration  
10. Apply to **draft only** after approval  
11. Save as reusable template (permissions allowing)  
12. Undo / restore previous generated version  

Output includes layout, sections, styling, content, and imagery direction — not colours alone.

---

## Document control

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-07-17 | Initial audit + phased plan; no production implementation |
