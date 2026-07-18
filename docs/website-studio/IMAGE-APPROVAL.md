# Image Approval & Draft Import

**Updated:** 2026-07-18 (Phase 3)

## Draft lifecycle

1. Composer resolves structured image briefs during concept generation  
2. Selections stored on draft: `__websiteComposer.imageSelections[]`  
3. Preview reuses stored URLs / metadata (no re-search)  
4. User may search again / pick alternate via Image Service APIs  
5. User may mark `approvalStatus: 'approved'`  
6. Import plan → Cloudinary path via `/api/image-service/import-cloudinary` + `/api/cloudinary/sign`  
7. Preserve original provider attribution after import (`importStatus`)

Live publishing / applying approved images to production sites is **out of scope for Phase 3**.

---

## Approval statuses

| Status | Meaning |
|--------|---------|
| `selected` | Chosen during generation |
| `approved` | User confirmed in Website Studio |
| `placeholder` | Safe fallback; not production-ready |
| `imported` | Cloudinary asset reference stored (post-upload) |

---

## Website Studio UI controls (prepared)

On `/theme-studio-v2` panel **4b. Images**:

- View selected images + attribution  
- Search again (server Image Service)  
- Modify search phrase  
- Review alternates  
- Approve selection (session mark; draft persist deepened in Phase 4)  
- Plan Cloudinary import  

AI generation controls are not shown for partners/clients. Superuser AI remains server-gated even if requested manually.

---

## Production rule (future)

Before an image is part of an approved production configuration:

- Selection approved  
- Imported to permitted Cloudinary path  
- Cloudinary reference stored  
- Pexels source metadata preserved  
- No hotlinking published customer sites to temporary search URLs  
