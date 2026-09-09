# Layout Composer — Phase 1 Discovery & Architecture

**Status:** Discovery complete — awaiting approval before Phase 2+ structural work  
**Date:** 2026-09-09  
**Product goal:** Replace the generic demo-builder **entry experience** with a visual, layout-first website design workflow. AI fills a **confirmed** structure; it never designs or rearranges the layout.

---

## 1. Non-negotiable preservation (verified)

These systems stay in place. The Layout Composer **orchestrates** them; it does not replace them.

| System | Canonical location | Must keep |
|--------|-------------------|-----------|
| Site editor / App Command Centre | `manage.html` | Full edit + publish |
| Site storage | `sites` + `sites.config` JSONB | Existing sites/demos render unchanged |
| Themes (positioning layouts) | `positioning_layouts`, `api/api-positioning-layouts.js`, `lib/positioning-layouts.js`, `lib/theme-demos.js` | Presets, apply modes, public `/demos` |
| Web Demos | `sites.is_demo`, `positioning_layouts.demo_site_id` | Library + apply-to-site |
| Partner mockups | `sites.is_mockup`, `api/partner/add-mockup.js` | Sale / demo-to-client |
| Demo → client | `api/partner/buy-site.js`, billing webhook, `api/billing/take-ownership.js` | Ownership transfer |
| Landing pages | `sites.config.pages[]`, Landing tab in `manage.html`, `api/brain/landing-draft.js` | Existing LP builder |
| Trade packs | `service_packs`, `TRADE_PACKS` in `manage.html`, `api/partner/acquire-trade-pack.js`, `lib/trade-pack-utils.js` | Community catalogue |
| Location uniqueness ledger | `pack_location_usage` | SEO uniqueness intent |
| Suburb SEO intros | `suburb_intros`, `lib/seo/suburbIntro.js` | Separate from trade packs |
| Section order law | `lib/section-order.js` (Trust Bar pin, OFF_BY_DEFAULT) | Rendering invariants |
| App marketplace | `app_registry` / `site_apps` + `config.sections` | Dual model reconciliation |
| Cloudinary | `api/cloudinary/sign.js` (`leadpages/` prefix) | Asset safety |
| Partner / Super Admin roles | `manage.html` gates, partner APIs | Permission model |
| Analytics / SEO tooling | Existing search-intelligence + seoTokens | No regression |
| Website Studio (On Ice) | `docs/website-studio/ON-ICE.md`, `theme-studio-v2`, `lib/website-composer/` | **Do not delete**; do not revive as the public creation path without product decision |

---

## 2. How creation works today (actual map)

### 2.1 Entry points (multiple overlapping flows)

```text
Super Admin
  manage.html → + New Site / openCreateSite()
    → trade pack acquire → sites insert (status live)
  Themes tab → capture/publish positioning_layouts → Web Demo sites (is_demo)

Partner
  partner.html → add customer (draft site) | add mockup (is_mockup)
    → optional partner_themes / trade pack seed
  Apply Themes layout to client site (structure | fill_empty | visual | demo_replace)

Legacy
  builder.html → POST /api/create-site (password) — minimal, no packs

Public
  /demos + /demos/:slug → browse Themes Web Demos
```

There is **no single “generic demo builder” module name**. The closest product surface to replace as the **entry** experience is:

1. Ad-hoc create-site / create-mockup flows that jump straight into content seeding, and  
2. The mental model that Themes = “pick a look” without a customer-owned structural draft first.

Themes itself is **not** discarded — it becomes **Preset Designs**.

### 2.2 Themes Builder (preset source)

| Item | Detail |
|------|--------|
| Table | `positioning_layouts` (`db/positioning_layouts.sql` + `db/theme_demos_expansion.sql`) |
| Key columns | `slug`, `name`, `section_order`, `apps`, `demo_packs`, `theme_image_url`, `layout_image_url`, `visibility`, `demo_site_id`, promo fields |
| Admin UI | `manage.html` Themes tab (`renderPositioningThemes`, capture/apply/publish) — super only for mutate |
| APIs | `GET/POST /api/api-positioning-layouts` — capture, save, delete, apply, update_demo, publish_demo |
| Public | `/demos`, `/demos/:slug`, `api/public-demos.js` |
| Apply modes | `structure` \| `fill_empty` \| `visual` \| `demo_replace` with identity scrub + `site_backups` |

**Layout vs theme today:** Themes rows mix structure (`section_order`, `apps`) and visual/demo content (`demo_packs`, images). Cleaner separation is a **logical** model for Layout Composer; physical rows stay compatible via an adapter.

### 2.3 Website data model

| Concept | Storage |
|---------|---------|
| Website | `sites` row |
| All homepage content | `sites.config` JSONB (`sections`, `sectionOrder`/`layout`, `services`, `theme`, `pages[]`, …) |
| Landing pages | `sites.config.pages[]` |
| Draft status | `sites.status` (`draft` / `live`) |
| Demo flags | `is_demo`, `is_mockup` |
| Partner ownership | `referring_partner_id`, `servicing_partner_id`, `owner_user_id` |

No separate pages/sections tables for trade sites. **Do not require a full normalised rewrite to ship Layout Composer.** Blueprints can be additive tables that **compile into** `sites.config`.

### 2.4 Trade content + location generation

```text
TRADE_PACKS (inline) + service_packs (DB)
        ↓ acquire
api/partner/acquire-trade-pack.js  (mode: create | pick)
        ↓ records
pack_location_usage (pack_slug, pack_variant, location_slug) UNIQUE
        ↓ apply
sites.config (token-resolved copy, theme tokens, services, sections)
```

Suburb intros (`suburb_intros`) are a **separate** AI cache for `/{site}/{suburb}` pages.

### 2.5 Landing pages

Edited in `manage.html` Landing tab; AI draft via Brain `landing-draft` when flagged. Layout Composer must **call this builder**, not fork it.

### 2.6 AI generation

Brain gateway (`lib/brain/`) is canonical for new AI. Trade packs / suburb intros still support direct Anthropic behind flags. Website Studio Composer (`lib/website-composer/`) exists but is **On Ice** for partner/client creation — useful as **internal reference for schemas/adapters**, not as the user-facing product.

### 2.7 Cloudinary

Signed uploads under `leadpages/…`. Themes screenshots under `leadpages/themes/`. Composer assets must use the same signing rules.

### 2.8 Migrations / types

SQL files under `db/` applied manually in Supabase. **No generated TypeScript DB types** for sites/themes. New blueprint tables should follow the same additive SQL pattern + docs.

---

## 3. Trade/location double-generation bug — root cause

### Symptom
Add missing trade → enter location → generate → later seed/create says location already used → user confirms → **generates again**.

### Root cause (code-backed)

**Premature `pack_location_usage` write on `mode:'create'`, then a second acquire in pick mode.**

1. Create path generates a community pack and **immediately** records location usage:

```119:127:api/partner/acquire-trade-pack.js
      const saved = await generateAndSave(tradeName, category, actor.userId, 0);
      await recordPackLocationUsage(sb, {
        pack_slug: saved.slug,
        pack_variant: saved.variant || 1,
        location_slug: locSlug,
        ...
      });
```

2. UI selects the new trade but typically **does not apply that returned pack** as the site seed; create-site / create-demo then calls acquire again in **pick** mode with the same location (`manage.html` create/seed loops ~5717–5728; partner create-trade ~1528).

3. Pick path finds the only variant already used → `LOCATION_EXHAUSTED` → confirm → **second AI generate**.

Related (not primary): `alreadyExists` 409 when trade slug exists — messaging can feel like “location exists” but is a different code path.

### Required fix (Phase 2, small, safe)

1. **Do not** record `pack_location_usage` on bare `mode:'create'` (library add). Record usage only when a pack is **bound to a site** (pick success used for seed, or explicit apply).  
2. After create, if the UI has a pack payload, **seed from it** without re-acquiring.  
3. Make acquire **idempotent** for (pack_slug, variant, location_slug).  
4. Add tests: new trade+location once; create then immediate seed; double-click; concurrent; case/whitespace normalisation.

**Do not** auto-delete existing duplicate packs/usage rows — admin review only.

---

## 4. Compatibility strategy for Layout Composer

### Product rule
**Customer chooses structure → confirm blueprint → Business Brief / research → optional landing recommendations → AI fills fields → create demo/client → continue in `manage.html`.**

AI must never add/remove/reorder pages or sections after confirm.

### Reuse, don’t fork

| Need | Reuse |
|------|-------|
| Preset designs | `positioning_layouts` (+ adapter → blueprint) |
| Customise preset | Deep-copy into user-owned design; never mutate original |
| Section/app catalogue | Existing section keys + `app_registry` metadata (extend descriptions/thumbnails) |
| Render preview | Existing templates / render pipeline + sample preview packs (tagged `is_sample`) |
| Content fill | Trade packs + Brain structured generation into **section schemas** |
| Landing pages | Existing Landing builder + Brain landing-draft |
| Create demo/client | Existing `sites` insert flags (`is_mockup` / live client) + partner APIs |
| Edit after | `manage.html` unchanged as system of record for live config |

### Additive data (proposed — names adaptable)

Do **not** replace `sites.config`. Add tables such as:

- `design_blueprints` / `design_blueprint_versions` — ordered pages/sections/apps, theme ref, status  
- `user_designs` — owner, partner/client association, source preset id  
- `preview_packs` / `preview_pack_content` — sample-only content (never publishable as business fact)  
- `component_definitions` / `component_content_schemas` — contracts for AI fill  
- `generation_runs` / `generation_run_sections` — idempotent jobs, section retry  
- `seo_page_plans`, `landing_page_recommendations`, `content_sources`

Compile blueprint → `sites.config` at “Create Demo / Client Website”. Store `blueprint_id` + `blueprint_version` on the site for audit.

### Feature flag

Gate new entry UI (e.g. `LAYOUT_COMPOSER=1`) so existing create flows remain available until rollout.

### Website Studio (On Ice)

- Keep code and docs.  
- Layout Composer is the **customer-facing** layout-first workflow.  
- Optionally reuse `lib/website-composer` adapters/schemas internally where they match section contracts — without enabling Studio partner access or live-apply flags.

---

## 5. Phased implementation plan

| Phase | Scope | Exit criteria |
|-------|--------|---------------|
| **1 — Discovery** *(this doc)* | Map systems, bug root cause, compatibility plan | Stakeholder approval |
| **2 — Data + bugfix** | Additive SQL; blueprint types; trade-pack usage fix + tests; preset→blueprint adapter | Bug fixed; existing sites green; migrations documented |
| **3 — Layout Builder UI** | Entry screen (Preset / My Designs / Scratch / Existing); DnD; Preview vs Layout modes; autosave; My Designs CRUD | Acceptance 1–12, 33–35 (UI) |
| **4 — Layout-aware generation** | Section schemas; structured AI contract; SEO plan; validation; section retry | Acceptance 18–22, 29–30 |
| **5 — Research + landings** | Optional research with source confidence; checkbox recommendations; existing LP builder integration | Acceptance 23–28 |
| **6 — QA / rollout** | Permissions, regression, a11y, flag rollout, rollback notes | Full acceptance list |

---

## 6. Risks

| Risk | Mitigation |
|------|------------|
| Dual content model (`config.sections` vs `site_apps`) | Compile through existing reconcile helpers |
| Trust Bar / section-order law | Always run `lib/section-order.js` on compile |
| Sample content leaking live | Preview packs flagged; strip on create; never write sample reviews/prices into publishable config without explicit replace |
| Themes apply overwriting client identity | Keep identity scrub + backups; Composer create path uses compile-to-new-site by default |
| Scope creep into Website Studio revival | Explicit: Layout Composer ≠ enabling Studio for partners |
| Large `manage.html` | Prefer new HTML/JS module for Composer entry; deep-link into manage for post-create edit |

---

## 7. Immediate next step (after approval)

**Phase 2 only:**

1. Fix `acquire-trade-pack` usage recording + UI seed reuse + tests.  
2. Add additive blueprint migration SQL + docs.  
3. Adapter: `positioning_layouts` → read-only preset blueprint DTO (no mutate).  
4. Feature-flag stub entry screen that lists Presets / My Designs / Scratch / Existing without removing current create buttons.

No parallel full builder until Phase 2 foundations land.

---

## 8. Key file index

| Area | Paths |
|------|-------|
| Editor | `manage.html` |
| Themes | `api/api-positioning-layouts.js`, `lib/positioning-layouts.js`, `lib/theme-demos.js`, `db/positioning_layouts.sql` |
| Public demos | `demos.html`, `demo-theme.html`, `api/public-demos.js` |
| Trade packs | `api/partner/acquire-trade-pack.js`, `lib/trade-pack-utils.js`, `db/pack_location_usage.sql` |
| Partner create | `partner.html`, `api/partner/add-customer.js`, `api/partner/add-mockup.js` |
| Landing AI | `api/brain/landing-draft.js` |
| Section order | `lib/section-order.js` |
| Studio (On Ice) | `docs/website-studio/`, `theme-studio-v2.html`, `lib/website-composer/` |
| Site builder docs | `docs/04-SITE-BUILDER.md`, `docs/features/Theme Packs.md`, `docs/features/Pages.md` |
