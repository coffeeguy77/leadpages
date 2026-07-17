# 23 — Theme Studio V2 (Phases 1–2 foundations)

**Document:** `AI/23-THEME-STUDIO-V2`  
**Status:** Phases 1–2 implemented (library + fixtures + tests). No UI, no live writes, no provider calls.  
**Audience:** Product + engineering  
**Related:** [THEME-STUDIO-IMPLEMENTATION-AUDIT](THEME-STUDIO-IMPLEMENTATION-AUDIT.md), [21-THEME-STUDIO](21-THEME-STUDIO.md) (colour MVP → future AI Colour Assistant), [00-STATUS](00-STATUS.md)

---

## Scope of this delivery

| In scope | Out of scope (Phase 3+) |
|----------|-------------------------|
| Curated foundation registry + compatibility | Intake UI / multi-step Theme Studio UI |
| `theme_studio.concept.v1` schema | Live Brain provider calls |
| Runtime validator (via `lib/brain/schema.js`) | Preview render API |
| Deterministic allowlisted config adapter | Draft DB tables / version history |
| Static fixtures + tests | Apply-to-site / publish |
| Access policy design (super + partner) | Client audience enablement |
| Brain task **contracts** only | Extending `theme-studio.html` colour UI |

**Hard rules for Phases 1–2:**

1. No live site behaviour changes.  
2. Generation path never writes `sites` (adapter produces draft snapshots only).  
3. No Anthropic / OpenAI / Gemini calls.  
4. Colour-only `theme-studio.html` remains isolated (later → Editor → Appearance → AI Colour Assistant).

---

## V1 product decisions (locked)

1. **Audience:** Superusers + Partners. Clients denied via `canAccessThemeStudio` (`ROLE_POLICY.client = false`). Flip later without restructuring.  
2. **Generation safety:** Draft-only forever for brief → generate → refine → preview → validate → select. Live apply is a later controlled phase.  
3. **Preview strategy (deferred):** Configuration snapshots through the existing LeadPages renderer in a secure preview mode — not temporary production sites. See § Preview security decision.  
4. **Foundations:** Trade **and** non-trade. Eight curated foundations.  
5. **Pink Diamond Vault** is a mandatory non-trade fixture; trade leakage must fail validation.  
6. **Luke’s Security Co** proves trade still works without jewellery leakage.  
7. **Adapter:** Deterministic allowlist only; never arbitrary `sites.config` keys.  
8. **Preservation:** Protected operational fields identified and stripped/omitted; not yet wired to live redesign merges.  
9. **Schema:** `theme_studio.concept.v1` validated with existing Brain schema helper.  
10. **Database:** No `theme_studio_drafts` / `theme_studio_versions` migrations in this phase (proposed for Phase 3).

---

## Code map

| Module | Role |
|--------|------|
| `lib/theme-studio/constants.js` | Verified layout/section/font IDs, allowlist, protected fields |
| `lib/theme-studio/foundations-data.js` | Static curated registry |
| `lib/theme-studio/foundations.js` | Lookup, scoring, compatibility |
| `lib/theme-studio/concept-schema.js` | `theme_studio.concept.v1` |
| `lib/theme-studio/validate-concept.js` | Runtime validation + leakage |
| `lib/theme-studio/adapt-to-site-config.js` | Concept → draft config snapshot |
| `lib/theme-studio/leakage.js` | Cross-industry leakage detectors |
| `lib/theme-studio/brain-contracts.js` | Future Brain task contracts |
| `lib/theme-studio/access.js` | V1 role gate design |
| `lib/theme-studio/index.js` | Public exports |
| `fixtures/theme-studio/*` | Briefs, concepts, source configs |
| `tests/theme-studio-phase1-2.test.js` | Phase 1–2 coverage |

---

## Foundation registry

Eight active foundations (`sourceTemplateId: "trade"` — the only verified multi-section public template):

| id | category | defaultLayoutId |
|----|----------|-----------------|
| `trade-field-services` | trade | `classic` |
| `professional-services` | professional | `authority-builder` |
| `retail-boutique` | retail | `premium-showcase` |
| `hospitality-cafe` | hospitality | `photo-proof` |
| `events-hire` | events | `offer-funnel` |
| `health-wellness` | health | `reviews-first` |
| `creative-agency` | creative | `social-proof-feed` |
| `property-construction` | property | `photo-proof` |

Each foundation includes: industries, exclusions, visual/conversion styles, supported/required/optional section keys, default order, compatible layouts, header/footer/hero variants, typography + image + mobile profiles, incompatibilities, `sourceAppIds` (verified **section_key** identities), status, version.

**Extension rule:** Add a new foundation object to `foundations-data.js`. Do not change the concept schema.

### Verified marketplace / template references

- **Templates:** `trade`, `broker-leads`, `broker-app` (foundations use `trade` only).  
- **Layouts:** `classic`, `quote-first`, `photo-proof`, `emergency-response`, `authority-builder`, `service-area-dominator`, `reviews-first`, `premium-showcase`, `offer-funnel`, `ba-hero-slider`, `hero-image-slider`, `social-proof-feed`.  
- **Section keys:** `manage.html` `DEFAULT_TRADE_SECTIONS` only.  
- **Apps:** referenced by marketplace `section_key` (e.g. `featuredProjects`, `instaGallery`, `onlineQuote`, `projectFeed`) — no invented UUIDs.

---

## Concept schema (`theme_studio.concept.v1`)

Required fields include: `schemaVersion` (const `1`), `conceptId`, `conceptName`, `foundationId`, `businessProfile`, `theme`, `layoutId`, `sectionOrder`, `sections`, `validationStatus`.

Also modelled: rationale, sourceTemplateId, sourceAppIds, typography, globalStyles, header, navigation, pages, sectionVariants, content, callsToAction, imagery, footer, mobileRules, accessibilityNotes, preservedFields, generatedFields, placeholderFields, warnings, provenance.

Validation uses `lib/brain/schema.js` `validateAgainstSchema` plus Theme Studio semantic checks.

---

## Validation rules

Machine-readable `{ code, message, path? }` errors for:

- Required fields / schema version  
- Foundation existence  
- Layout compatibility  
- Section-key existence / order integrity / duplicates  
- Required + incompatible sections  
- Required content (business name, hero heading)  
- CTA consistency  
- Industry mismatch  
- Placeholder identification (warnings)  
- Mobile rules  
- Protected-field attempts  
- Unknown config path attempts (`configPatches`)  
- Cross-industry leakage  
- Unsupported marketplace references  
- Typography / header / theme hex tokens  

---

## Adapter rules

`adaptConceptToSiteConfig(concept, sourceConfig)`:

1. Validates concept (unless skipped).  
2. Clones source; **never mutates** the input.  
3. Omits protected fields from the draft.  
4. Maps only allowlisted paths.  
5. Rejects unknown / incompatible sections.  
6. Records `ignoredFields` + `warnings`.  
7. Returns `{ draftConfig, writtenPaths, published: false, mutatedSource: false }`.

### Writable config allowlist

`theme.pipe|hivis|steel|safety|lightBg|accent|presetName|presetKey`, `theme.fonts.fontDisplay|fontUi`, `layout`, `sectionOrder`, `trade`, `name`, `phone`, `phoneText`, `email`, `region`, `seoTitle`, `seoDescription`, `logo.headerStyle`, `services`, `sections` (known keys only), `pages`.

### Protected fields (not written)

Site identity/ownership, domains, publishing/status, billing/Stripe, analytics/GTM/GA/pixels/Ads, CRM, email integrations, lead routing, form destinations, auth, permissions, passwords, users, savedThemes, demo/mockup flags, etc. Full list: `PROTECTED_FIELDS` in `constants.js`.

---

## Fixture strategy

| Fixture | Foundation target |
|---------|-------------------|
| Pink Diamond Vault (jewellery) | `retail-boutique` |
| Luke’s Security Co (trade) | `trade-field-services` |
| Riversong Café | `hospitality-cafe` |
| Northside Advisory | `professional-services` |
| Capital Marquee Hire | `events-hire` |
| Pink Diamond Vault **leaky** | Must fail validation |

Tests use static fixtures only — no live AI.

---

## Brain task contracts (future)

Documented in `lib/theme-studio/brain-contracts.js`:

- `theme_studio.business_analysis`  
- `theme_studio.foundation_selection`  
- `theme_studio.concept_generation`  
- `theme_studio.content_generation`  
- `theme_studio.image_direction`  
- `theme_studio.refinement`  
- `theme_studio.quality_review`  

All: `writesSites: false`, `draftOnly: true`. Not registered with the Brain router yet.

---

## Preview security decision (implement in a later phase)

**Decision:** Preview from a **draft config snapshot** through the existing renderer (`api/render.js` / editor iframe path), not by creating temporary production sites.

**Requirements for the future preview service:**

| Requirement | Approach |
|-------------|----------|
| Render draft config | Inject snapshot into renderer; do not load live `sites.config` as the mutable target |
| Desktop + mobile | Reuse editor preview width modes |
| Prevent indexing | `noindex,nofollow` + preview host / robots |
| Prevent publishing | Preview routes cannot call publish APIs |
| Prevent real form/lead workflows | Disable or sandbox form posts; no production webhooks |
| Prevent analytics/ads pollution | Strip or override analytics/pixels/Ads IDs in preview injection |
| Tenant isolation | Authenticated actor must own/partner-access the draft; no cross-tenant draft IDs |
| Expire access | Short-lived signed preview tokens (preferred if any unsigned route would expose private config) |

**Security choice:** Prefer **signed, short-lived, authenticated preview URLs** when the snapshot contains non-public business copy or contact details. Do not expose private draft config on a permanent unsigned public route.

*Implementation of this preview service is Phase 3+ and not included here.*

---

## Proposed Phase 3 database tables (not created)

```sql
-- theme_studio_drafts
-- id, owner_user_id, mode, source_site_id, target_site_id, status,
-- brief, foundation_id, selected_concept_id, created_at, updated_at

-- theme_studio_versions
-- id, draft_id, concept_id, concept_json, draft_config_json,
-- adapter_warnings, created_by, created_at
```

Do not add unused production tables until draft workspace work starts.

---

## Phase 3 dependencies

- Wire `canAccessThemeStudio` into HTTP routes  
- Register Brain tasks from contracts (still draft-only)  
- Intake UI (separate from colour MVP)  
- Draft/version persistence  
- Preview service per security decision above  
- Quality review UI  
- Explicit apply/rollback (still not live-by-default)

---

## Confirmation

- No live site behaviour changed in Phases 1–2.  
- No generation writes to `sites`.  
- No provider API calls introduced.  
- Colour-only Theme Studio UI not extended into the V2 product.
