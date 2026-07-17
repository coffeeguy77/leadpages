# 10 — Observability and Costs

**Document:** `AI/10-OBSERVABILITY-AND-COSTS`  
**Status:** Proposed  
**Prerequisites:** [01-CURRENT-STATE-AUDIT](01-CURRENT-STATE-AUDIT.md)

---

## Current gap

No AI call site persists token usage, cost, latency, or correlation IDs. Partner “AI credits” copy in acquire-trade-pack has **no ledger** in repository code.

---

## What to track (when available)

| Dimension | Examples |
|-----------|----------|
| Identity | provider, model, taskId, feature, promptVersion |
| Tenant | account/user id, partner id, site id |
| Usage | input/output/cached tokens |
| Cost | estimated USD (from price table), billable flag |
| Perf | latencyMs, time-to-first-token (streams) |
| Outcome | success, failure code, retries, fallback used, validation failures |
| Meta | timestamp, correlationId |

---

## Privacy-safe logging

- Default: store metadata + hashes; sample or truncate prompts/responses.  
- Redact emails, phones, tokens, Authorization headers.  
- Retention: hot metrics 90 days (proposed); raw bodies shorter or off by default.  
- Access: superuser Control Centre only for detailed inspection.

---

## Cost controls

| Control | V1 | Later |
|---------|----|-------|
| Per-request estimate | Yes | |
| Per-site / partner daily budget | Soft warn | Hard block |
| Plan allowances | Config | Billing integration |
| Alerts | Log + super email | Slack/ops |
| Provider comparison reports | | Phase 6 |

---

## Reporting

Control Centre views: cost by feature/task/provider; failure rates; p95 latency; top sites by spend. Export CSV later.

---

## Related

- Data model: [12-DATA-MODEL](12-DATA-MODEL.md)  
- Control Centre: [14-AI-CONTROL-CENTRE](14-AI-CONTROL-CENTRE.md)
