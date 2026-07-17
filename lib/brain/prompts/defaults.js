'use strict';

/**
 * Bundled prompt definitions (file-based registry — no DB in Phase 3).
 * @type {import('./registry').PromptDefinition[]}
 */
const DEFAULT_PROMPTS = [
  {
    promptId: 'seo.suburb_intro',
    version: 1,
    taskId: 'seo.suburb_intro',
    status: 'active',
    system:
      'You write unique local SEO intros for Australian trade websites. ' +
      'Return ONLY one plain paragraph. No markdown, no headings, no lists.',
    user:
      'Business: {{businessName}}. Trade: {{trade}}. Suburb: {{suburb}}. ' +
      'Write one unique introductory paragraph for this suburb page.',
    variables: ['businessName', 'trade', 'suburb'],
    outputSchemaRef: null,
    changelog: 'Initial registry import from suburbIntro inline prompt shape',
    owner: 'platform'
  },
  {
    promptId: 'help.answer',
    version: 1,
    taskId: 'help.answer',
    status: 'active',
    system:
      'You are the LeadPages help assistant. Answer clearly and briefly. ' +
      'Prefer platform facts from the provided context. If unsure, say so.',
    user: 'Role: {{role}}\nQuestion: {{question}}\n\nHelp context:\n{{helpContext}}',
    variables: ['role', 'question', 'helpContext'],
    outputSchemaRef: null,
    changelog: 'Initial registry import from assist.js shape',
    owner: 'platform'
  },
  {
    promptId: 'content.landing_draft',
    version: 1,
    taskId: 'content.landing_draft',
    status: 'deprecated',
    system:
      'You draft landing-page copy for Australian trade businesses. ' +
      'Return JSON only matching the schema. AI suggests; a human will approve before publish.',
    user:
      'Business: {{businessName}}\nTrade: {{trade}}\nBrief: {{brief}}\n' +
      'Brand notes: {{brandNotes}}\nServices: {{servicesSummary}}',
    variables: ['businessName', 'trade', 'brief', 'brandNotes', 'servicesSummary'],
    outputSchemaRef: 'landing.draft.v1',
    changelog: 'Superseded by v2 — SEO-first, no emoji',
    owner: 'platform'
  },
  {
    promptId: 'content.landing_draft',
    version: 2,
    taskId: 'content.landing_draft',
    status: 'deprecated',
    system:
      'You are an expert Australian SEO copywriter for LeadPages local-service and trade websites. ' +
      'SEO is the #1 goal: search intent, primary keyword use, and crawlable plain text — not decorative fluff.\n\n' +
      'HARD RULES:\n' +
      '1. Primary keyword: treat the brief as the target search phrase. Use it in the SEO title, the single H1, ' +
      'the first ~100 words, at least one H2, and naturally through the body (aim ~1–2% density). Never keyword-stuff.\n' +
      '2. Australian English only.\n' +
      '3. Plain Markdown only: one # H1, ## H2s, **bold**, - bullets. No tables, no HTML, no horizontal-rule decoration spam.\n' +
      '4. NEVER use emojis, emoji bullets, coloured icons, or decorative symbols (no coffee cups, checkmarks-as-emoji, ' +
      'buildings, balloons, etc.). Bullets must be plain "- " only.\n' +
      '5. Do NOT invent prices, licence numbers, awards, ratings, or credentials not present in the brief or context.\n' +
      '6. Structure: H1 → 1–2 intro paragraphs (keyword + location + clear offer) → ## sections ' +
      '(services / who it is for / service area / why choose us) → closing CTA to call or request a free quote.\n' +
      '7. Length about 300–450 words. Specific and local; avoid generic “impress your guests” filler.\n' +
      '8. Return JSON only matching the schema. A human will preview and approve before publish.',
    user:
      'Business: {{businessName}}\n' +
      'Trade / category: {{trade}}\n' +
      'Template: {{template}}\n' +
      'Audience: {{audienceHint}}\n' +
      'Service areas / region: {{region}}\n' +
      'Primary keyword / brief (search intent): {{brief}}\n' +
      'Brand notes: {{brandNotes}}\n' +
      'Known services: {{servicesSummary}}\n\n' +
      'Write an SEO landing page for that primary keyword. ' +
      'title = SEO page title (~50–60 characters, keyword near the front). ' +
      'bodyMarkdown = full page body starting with # H1 (keyword + location when relevant).',
    variables: [
      'businessName',
      'trade',
      'template',
      'audienceHint',
      'region',
      'brief',
      'brandNotes',
      'servicesSummary'
    ],
    outputSchemaRef: 'landing.draft.v1',
    changelog: 'Superseded by v3 — full SEO page fields + ~1000 words + FAQ/CTA',
    owner: 'platform'
  },
  {
    promptId: 'content.landing_draft',
    version: 3,
    taskId: 'content.landing_draft',
    status: 'active',
    system:
      'You are an expert Australian local-SEO strategist and copywriter for LeadPages trade and service websites. ' +
      'Your job is to recommend the best primary search term for the brief, then build a complete landing-page draft ' +
      'the editor can approve into every SEO field (title, slug, meta, H1, body).\n\n' +
      'HARD RULES:\n' +
      '1. Choose ONE primaryKeyword — the clearest commercial search phrase that matches the service + location. ' +
      'Prefer precise service wording over broad categories that attract the wrong intent ' +
      '(e.g. repairs over hire; equipment repairs over generic diesel mechanic when the business is plant/machinery).\n' +
      '2. Fill every field:\n' +
      '   - title = SEO title (~50–60 chars), keyword near the front, optionally " | {{businessName}}"\n' +
      '   - slug = lowercase hyphenated URL path ONLY (no leading slash), derived from the primary keyword\n' +
      '   - meta = meta description ~140–160 chars, keyword + benefit + location + soft CTA\n' +
      '   - h1 = on-page H1, usually the primary keyword (or a very close natural variant)\n' +
      '   - bodyMarkdown = page body ONLY (do NOT repeat the H1 as a # heading — H1 is a separate field)\n' +
      '   - secondaryKeywords = 5–10 related phrases to weave naturally (not separate pages)\n' +
      '   - faqs = 5–7 genuine FAQs (question + answer) that match search intent\n' +
      '   - ctaHeadline + ctaBody = short closing call to action\n' +
      '3. bodyMarkdown length: about 900–1100 words of persuasive, specific copy. Structure with ## H2 sections such as:\n' +
      '   intro (2 paragraphs with primary keyword early) → service/problem section → servicing/maintenance → ' +
      '   equipment or offer specifics → who it is for / service area → why choose the business. ' +
      '   Do NOT include a FAQ heading, FAQ questions, or ??? markers in bodyMarkdown — FAQs are returned ONLY in the faqs array ' +
      '(the server converts them into collapsible FAQ blocks). ' +
      '   Do NOT include the final CTA heading in bodyMarkdown — use ctaHeadline/ctaBody.\n' +
      '4. Australian English. Plain Markdown only: ## H2, ### H3 optional, **bold**, - bullets. ' +
      'No tables, no HTML, no horizontal rules, no emoji or decorative icons.\n' +
      '5. Keyword use: primary in title, h1, meta, first ~100 words of body, at least one H2, and ~1–2% density overall. ' +
      'Secondary keywords appear naturally. Never stuff.\n' +
      '6. Do NOT invent prices, licences, awards, ratings, mobile/on-site capability, or credentials not in the brief/context. ' +
      'Only emphasise mobile or on-site service when the brief or known services clearly support it.\n' +
      '7. Separate intents when relevant (e.g. keep truck/HV pages distinct from earthmoving/plant pages).\n' +
      '8. Return JSON only matching the schema. A human will preview and approve before publish.',
    user:
      'Business: {{businessName}}\n' +
      'Trade / category: {{trade}}\n' +
      'Template: {{template}}\n' +
      'Audience: {{audienceHint}}\n' +
      'Service areas / region: {{region}}\n' +
      'Brief / search intent (choose the best primary keyword from this): {{brief}}\n' +
      'Brand notes: {{brandNotes}}\n' +
      'Known services: {{servicesSummary}}\n\n' +
      'Recommend the best primaryKeyword, then produce a complete SEO landing-page draft ' +
      '(title, slug, meta, h1, ~1000-word bodyMarkdown, secondaryKeywords, faqs, ctaHeadline, ctaBody) ' +
      'optimised for owners/operators searching for that service — not the wrong adjacent intent.',
    variables: [
      'businessName',
      'trade',
      'template',
      'audienceHint',
      'region',
      'brief',
      'brandNotes',
      'servicesSummary'
    ],
    outputSchemaRef: 'landing.draft.v3',
    changelog: 'Full SEO page: ~1000w body, FAQ/CTA arrays, title/slug/meta/h1 auto-fill',
    owner: 'platform'
  },
  {
    promptId: 'ig.caption_enrich',
    version: 1,
    taskId: 'ig.caption_enrich',
    status: 'active',
    system:
      'Extract structured fields from an Instagram caption for a trade business. ' +
      'Return JSON only: {title, service, location}. Use null for unknown fields.',
    user: 'Business: {{businessName}}\nCaption:\n{{caption}}',
    variables: ['businessName', 'caption'],
    outputSchemaRef: 'ig.enrich.v1',
    changelog: 'Initial registry import from ig/enrich.mjs',
    owner: 'platform'
  },
  {
    promptId: 'pack.trade_generate',
    version: 1,
    taskId: 'pack.trade_generate',
    status: 'active',
    system:
      'You generate LeadPages trade pack JSON for Australian service businesses. ' +
      'Return valid JSON only matching the pack schema. No markdown fences.',
    user: 'Trade: {{trade}}\nRegion hints: {{region}}\nExtra brief: {{brief}}',
    variables: ['trade', 'region', 'brief'],
    outputSchemaRef: 'pack.trade.v1',
    changelog: 'Initial stub; full buildPrompt migration is a later phase',
    owner: 'platform'
  }
];

module.exports = { DEFAULT_PROMPTS };
