# Theme Studio → Website Studio Migration

## Principle

Rename the **product** safely. Preserve **technical identifiers** until a dedicated migration is approved.

---

## Naming map

| Old (product language) | New |
|------------------------|-----|
| Theme Studio (full product) | **Website Studio** |
| Theme Studio V2 | **Website Studio** (legacy code paths) |
| Theme Studio (colour MVP) | **AI Colour Assistant** |
| (none) | **Website Composer** (internal) |
| (none) | **Marketplace Intelligence** |
| (none) | **Image Service** |
| Brain | **LeadPages Brain** (unchanged system) |

---

## Legacy identifiers (KEEP for now)

| Kind | Identifier | Notes |
|------|------------|-------|
| URL | `/theme-studio` | AI Colour Assistant |
| URL | `/theme-studio/colours` | Alias → colour assistant |
| URL | `/theme-studio-v2` | Website Studio UI (legacy path) |
| API | `/api/theme-studio/*` | Website Studio APIs |
| API | `/api/brain/theme-*` | Colour assistant |
| Module dir | `lib/theme-studio/` | Composer seed |
| Fixtures | `fixtures/theme-studio/` | Keep |
| Tests | `tests/theme-studio-*.test.js` | Keep |
| DB | `theme_studio_drafts` | Keep |
| DB | `theme_studio_versions` | Keep |
| DB | `theme_studio_templates` | Keep |
| Env | `BRAIN_THEME_STUDIO` | Colour assistant flag |
| Env | `THEME_STUDIO_V2` | Website Studio flag (legacy name) |
| Env | `THEME_STUDIO_ALLOW_LIVE_APPLY` | Live apply gate |
| Env | `THEME_STUDIO_MEMORY_STORE` | Test/dev store |
| Env | `THEME_STUDIO_PREVIEW_SECRET` | Preview HMAC |
| Schema | `theme_studio.concept.v1` | Concept schema id |
| Brain tasks | `theme.generate`, `theme.refine` | Colour |
| Brain tasks | `theme_studio.*` | Full product contracts |
| Meta | `source: 'theme_studio'` on theme approve | Keep |
| Config flag | `__themeStudioPreview` | Keep |

**Do not** create parallel production routes that silently diverge. Prefer aliases later (`/website-studio` → same HTML) after approval.

---

## Safe renames (allowed in Phase 1)

| Surface | Change |
|---------|--------|
| Ops Command panel label | “Theme Studio” → “Website Studio” |
| V2 page title / headings | “Theme Studio” → “Website Studio” |
| Docs | New `docs/website-studio/`; archive old Theme Studio docs |
| AI Colour Assistant | Keep / reinforce (already partially renamed) |

---

## Documentation moves

| From | To |
|------|----|
| `docs/AI/THEME-STUDIO-IMPLEMENTATION-AUDIT.md` | `docs/archive/theme-studio/` |
| `docs/AI/21-THEME-STUDIO.md` | `docs/archive/theme-studio/` |
| `docs/AI/23-THEME-STUDIO-V2.md` | `docs/archive/theme-studio/` |

Stubs remain under `docs/AI/` pointing to archive + new Website Studio docs.

---

## Future technical migration (not now)

When approved as its own phase:

1. Add `/website-studio` rewrite → current V2 HTML  
2. Optionally add `website_studio_*` tables and dual-write  
3. Version concept schema to `website_studio.concept.v1`  
4. Rename Brain tasks with aliases  
5. Deprecate `/theme-studio-v2` path after soak  
6. Move colour assistant under Editor Appearance; keep `/theme-studio/colours` redirect  

---

## Compatibility promise

Phase 1 of this reset **does not**:

- Change API request/response contracts  
- Change DB schema  
- Change renderer or publish  
- Break existing bookmarks to `/theme-studio*`  
