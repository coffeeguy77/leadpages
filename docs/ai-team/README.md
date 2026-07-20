# AI Website Team

**Status:** Phase 2 architecture lock (Execution Plans)  
**Audience:** Engineers and AI agents  
**Related:** [Site Brain](SITE-BRAIN.md) · [Execution](EXECUTION.md) · [Specialists](SPECIALISTS.md)

---

## What this is

The **AI Website Team** helps authorised users improve **existing** LeadPages websites inside `manage.html`. It is not Website Studio and does not generate new sites.

Canonical pipeline (every future AI action):

**Recommendation → Execution Plan (Forge) → Guardian → Change Preview → Apply → Editor → User Publish**

AI never publishes automatically. Only **Forge** writes `sites.config`.

## Scope

| Included | Excluded |
|----------|----------|
| Site Brain + Site Knowledge (business truth) | Auto-publish |
| Atlas outcome recommendations | Atlas knowing config paths |
| Forge Execution Plans + batch Apply | Other specialists writing config |
| Guardian validation of plans | Treating Echo copy as Site Knowledge |
| Change Preview + rollback | Broader specialist execution before this pipeline |
| Editor page/section context | |

## Entry points

| Surface | Path |
|---------|------|
| Editor nav | `manage.html` → **AI Website Team** |
| Client | `assets/ai-website-team.js` |
| Site Brain APIs | `api/site-brain/*` |
| AI Team APIs | `api/ai-team/*` (incl. `execution-plan`) |
| Libraries | `lib/site-brain/`, `lib/ai-team/` |
| SQL | `db/site_brain.sql` |

## Read next

1. [VISION](VISION.md)  
2. [ARCHITECTURE](ARCHITECTURE.md)  
3. [EXECUTION](EXECUTION.md)  
4. [SITE-BRAIN](SITE-BRAIN.md)  
5. [ROADMAP](ROADMAP.md)
