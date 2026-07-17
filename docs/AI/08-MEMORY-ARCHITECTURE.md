# 08 — Memory Architecture

**Document:** `AI/08-MEMORY-ARCHITECTURE`  
**Status:** Proposed — cautious; mostly post-V1  
**Prerequisites:** [07-BUSINESS-CONTEXT](07-BUSINESS-CONTEXT.md), [11-SECURITY-AND-PERMISSIONS](11-SECURITY-AND-PERMISSIONS.md)

---

## Types of memory

| Type | Definition | V1 |
|------|------------|-----|
| Request memory | Single call messages | Implicit |
| Conversation memory | Multi-turn assist | Optional short window (assist already caps history client-side) |
| Feature-session memory | Wizard state (Theme Studio) | Later |
| Site memory | Approved decisions / brand notes | Later |
| Business memory | Cross-site account memory | Later / careful |
| Partner memory | Partner-level preferences | Later |
| User preferences | Model/verbosity prefs | Later |
| Historical decisions | “User rejected X” | Later |
| Marketing performance memory | Campaign learnings | Marketing Hub later |

---

## What should be stored

- Approved structured outputs the user accepted (optional, with attribution)  
- Short conversation transcripts for assist **if** retention policy allows  
- Eval labels and regression fixtures (anonymised)

## What should not be stored

- Raw provider secrets  
- Full unrestricted website dumps  
- Other tenants’ data  
- Permanent logs of every token by default without redaction policy  

---

## Controls

| Control | Requirement |
|---------|-------------|
| Retention | Default short TTL for conversations; configurable |
| Consent | Document when storing beyond request |
| Deletion | Honour user/site deletion paths |
| Tenant isolation | Composite keys always include site/account |
| Inspection | Superuser can inspect metadata; body access audited |
| User correction | Prefer overwrite with “user corrected” flag |
| Stale detection | Timestamp + config hash mismatch invalidates |
| Source attribution | Link memory to prompt version + request ID |

---

## Existing cache (not “memory product”)

`suburb_intros` is a **deterministic content cache**, not conversational memory. Brain should treat it as a task-level cache adapter.

---

## Related

- Observability: [10-OBSERVABILITY-AND-COSTS](10-OBSERVABILITY-AND-COSTS.md)  
- Data model: [12-DATA-MODEL](12-DATA-MODEL.md)
