# Website Studio — Vision

## Intent

Website Studio is the LeadPages product that turns a business brief into **complete website concepts** — layout, sections, marketplace apps, content, imagery direction, theme, and CTAs — then previews them through the real renderer and applies only after explicit approval.

It is **not** a colour palette tool.

---

## System chain

```text
LeadPages Brain
    ↓
Website Studio          (user feature)
    ↓
Website Composer        (internal engine)
    ↓
Marketplace Intelligence
    ↓
Image Service
    ↓
Renderer
    ↓
Draft Preview
    ↓
Approval
    ↓
Publish
```

**AI Colour Assistant** remains a separate feature (colour tokens only).

---

## What “complete website” means

A concept must be able to stand alone as a draft site config that:

1. Matches the business industry (trade **or** non-trade)  
2. Uses compatible layouts, sections, and marketplace apps  
3. Contains on-industry copy (no cross-industry leakage)  
4. Declares imagery needs (later fulfilled by Image Service)  
5. Renders correctly in desktop and mobile preview  
6. Never writes live production sites during generation or preview  

---

## Audience (V1)

- Superusers  
- Partners  

Normal client accounts stay out until a later enablement flag. Access must be role-enforced, not link-hiding.

---

## Non-goals (V1)

- Replacing the Editor (`manage.html`)  
- Mutating Google Ads or live analytics during preview  
- Building temporary production sites for every concept  
- Blindly renaming all technical identifiers overnight  
- Applying drafts to live sites before an approved application phase  
- Partner/client AI image generation  

Phase 4 delivers end-to-end draft building through **Approve website draft**. Publish/apply remains a later phase.
