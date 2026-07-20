# AI Website Team

**Status:** Phase 1 shipped (advisory)  
**Audience:** Engineers and AI agents  
**Related:** [Site Brain](SITE-BRAIN.md) · [Specialists](SPECIALISTS.md) · [Capability Registry](CAPABILITY-REGISTRY.md)

---

## What this is

The **AI Website Team** helps authorised users improve **existing** LeadPages websites inside `manage.html`. It is not Website Studio and does not generate new sites.

Phase 1 is **advisory only**: Atlas reviews Site Brain + editor context and proposes recommendations. Nothing publishes or mutates live `sites.config` through AI Team APIs.

## Phase 1 scope

| Included | Excluded |
|----------|----------|
| Website Studio On Ice (superuser only) | Scout SEO execution |
| Persistent Site Brain + bootstrap review | Forge / editor mutation |
| Specialist registry (Atlas interactive) | Account Brain |
| Real Marketplace capability registry | Publish via AI Team |
| Atlas advisory + Guardian validation | Nine “coming soon” primary cards |
| Editor panel + permissions + audit + tests | Silent memory fallback in deployed envs |

## Entry points

| Surface | Path |
|---------|------|
| Editor nav | `manage.html` → **AI Website Team** (`#av-ai-team`) |
| Client script | `assets/ai-website-team.js` |
| Site Brain APIs | `api/site-brain/*` |
| AI Team APIs | `api/ai-team/*` |
| Libraries | `lib/site-brain/`, `lib/ai-team/` |
| SQL | `db/site_brain.sql` |

## Read next

1. [VISION](VISION.md)  
2. [ARCHITECTURE](ARCHITECTURE.md)  
3. [SITE-BRAIN](SITE-BRAIN.md)  
4. [CAPABILITY-REGISTRY](CAPABILITY-REGISTRY.md)  
5. [ROADMAP](ROADMAP.md)
