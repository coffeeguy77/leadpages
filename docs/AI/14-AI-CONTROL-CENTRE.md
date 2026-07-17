# 14 — AI Control Centre

**Document:** `AI/14-AI-CONTROL-CENTRE`  
**Status:** Phase 6 shipped — `/brain-admin` + `/api/brain/control` (usage buffer still in-memory)  
**Prerequisites:** [10-OBSERVABILITY-AND-COSTS](10-OBSERVABILITY-AND-COSTS.md), [05-TASK-ROUTER](05-TASK-ROUTER.md)

---

## Audience

**Super-admin only** (likely under Ops Command / `command.html` patterns — not partner-facing).

---

## Capabilities

### V1 / Phase 6 minimum

- View providers + health check  
- Enable/disable provider  
- View/edit routing policies (task → model/fallback)  
- View usage and estimated cost (by feature/site/partner)  
- View recent failures  
- Feature flags for migrations  
- Test provider connection (no secret echo)

### Later

- Budgets / allowances  
- Prompt version publish/rollback UI  
- Experiments / traffic splits  
- Eval runner  
- Full audit body inspection with break-glass  

---

## Secret UX

- Secrets entered once into env/vault — Control Centre shows **configured: yes/no**, last-four optional, never full key.  
- Rotate = ops changes Vercel env; UI only triggers health recheck.

---

## Non-goals

- Building Theme Studio or Marketing Hub inside Control Centre  
- Exposing Brain to clients  

---

## Related

- Security: [11-SECURITY-AND-PERMISSIONS](11-SECURITY-AND-PERMISSIONS.md)  
- Roadmap: [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md)
