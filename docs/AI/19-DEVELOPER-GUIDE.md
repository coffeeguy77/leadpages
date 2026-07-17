# 19 — Developer Guide

**Document:** `AI/19-DEVELOPER-GUIDE`  
**Status:** Partial — `createBrain()` available; feature migrations still Phase 7+  
**Prerequisites:** [13-INTERNAL-API-CONTRACTS](13-INTERNAL-API-CONTRACTS.md), [02-VISION-AND-PRINCIPLES](02-VISION-AND-PRINCIPLES.md)

---

## Conceptual feature flow

1. Feature identifies a **task type** (`content.landing_draft`).  
2. Feature requests **approved business context slices**.  
3. Feature supplies user input (brief, caption, …).  
4. Brain selects **routing policy**.  
5. Prompt engine renders the **active prompt version**.  
6. Provider adapter performs the request.  
7. Output is **validated** (schema when structured).  
8. Usage and cost are **logged**.  
9. Feature receives a **provider-independent** result.  
10. User **previews and approves** before publish when consequential.

---

## Development rules

1. Never import provider SDKs into feature modules.  
2. Never store production prompts only in feature UI code.  
3. Never trust unvalidated model output for config/Ads writes.  
4. Never expose provider keys client-side.  
5. Always pass tenant + site identity.  
6. Always use approved task IDs.  
7. Always log usage via Brain.  
8. Always provide a safe failure state.  
9. Always require approval for consequential publishing unless an authorised automation policy exists.

---

## Example (Phase 3 runtime)

```js
const { createBrain } = require('../../lib/brain');
const brain = createBrain();

// Load site yourself (resolver does not hit the DB yet).
const result = await brain.generateStructured({
  correlationId,
  taskId: 'content.landing_draft',
  promptId: 'content.landing_draft',
  siteId: site.id,
  site,
  actor: { userId, role },
  contextSlices: ['site.identity', 'site.services', 'site.brand'],
  input: { brief: req.body.brief },
  responseSchema: {
    type: 'object',
    required: ['title', 'bodyMarkdown'],
    properties: {
      title: { type: 'string' },
      bodyMarkdown: { type: 'string' }
    }
  }
});
if (!result.ok) return res.status(502).json({ error: result.error });
// AI suggests — preview/approve before writing sites.config
return res.json({ draft: result.output, usage: result.usage, prompt: result.prompt });
```

---

## Related

- Migration examples: [16-MIGRATION-PLAN](16-MIGRATION-PLAN.md)
