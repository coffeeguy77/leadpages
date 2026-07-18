# Image Approval & Draft Import

**Updated:** 2026-07-18 (Phase 4)

## Draft lifecycle

1. Composer resolves structured image briefs during concept generation  
2. Selections stored on draft: `__websiteComposer.imageSelections[]`  
3. Preview reuses stored URLs / metadata (no re-search on ordinary preview)  
4. User may search again / pick alternate via Image Service APIs  
5. User marks approval state; persisted via `POST /api/theme-studio/persist-images`  
6. Import plan → Cloudinary only for selected/approved assets  
7. Preserve original provider attribution after import  

Live publishing / applying images to production sites is **out of scope for Phase 4**.

---

## Approval statuses

| Status | Meaning |
|--------|---------|
| `proposed` | Candidate from search |
| `selected` | Chosen during generation |
| `approved` | User confirmed |
| `rejected` | User rejected |
| `replacement-requested` | Needs new search |
| `import-planned` | Cloudinary import planned |
| `imported` | Cloudinary asset stored |
| `failed` | Provider / import failure recorded |

Persisted fields include: selected asset, alternates, source, attribution, approval state, user, timestamp, search query, brief, draft version, import result.

---

## Website Studio UI

On `/theme-studio-v2` Images panel:

- View selected images + attribution  
- Search again (server Image Service)  
- Review alternates  
- Approve / reject → persists to draft version  
- Plan Cloudinary import (selected/approved only)  

AI generation controls are not shown for partners/clients. Superuser AI remains server-gated.

---

## Failure behaviour

Provider failure during generation does not fail the whole concept.  
It records the provider error, uses an approved fallback/placeholder, and surfaces an image warning in diagnostics.
