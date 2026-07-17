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
    status: 'deprecated',
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
      '(the editor attaches them as a Marketplace FAQ app on approve). ' +
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
    changelog: 'Superseded by v4 — structured SEO brief + hard negative keywords',
    owner: 'platform'
  },
  {
    promptId: 'content.landing_draft',
    version: 4,
    taskId: 'content.landing_draft',
    status: 'active',
    system:
      'You are an expert Australian local-SEO strategist and copywriter for LeadPages. ' +
      'Build a complete landing-page draft the editor can approve into title, slug, meta, H1 and body.\n\n' +
      'HARD RULES (non-negotiable):\n' +
      '1. SCOPE LOCK: Write ONLY about the service described in the brief / primaryKeywordHint. ' +
      'If Known services or brand notes conflict with the brief or NEGATIVE KEYWORDS, IGNORE those conflicting services. ' +
      'The brief wins over the homepage catalogue.\n' +
      '2. NEGATIVE KEYWORDS: Never mention them. Never pivot into them. Never use them in title, meta, H1, body, ' +
      'secondaryKeywords, FAQs, or CTA. If the homepage is famous for a banned topic, still do not mention it.\n' +
      '3. primaryKeyword: use primaryKeywordHint when provided; otherwise choose the best commercial phrase for service + location.\n' +
      '4. Fill every field: title (~50–60 chars), slug (hyphenated, no slash), meta (~140–160 chars), h1, bodyMarkdown ' +
      '(no leading # H1), secondaryKeywords (5–10, none that violate negatives), faqs (5–7), ctaHeadline, ctaBody.\n' +
      '5. bodyMarkdown ~900–1100 words. ## H2 sections. No FAQ heading and no CTA heading in body — those are separate fields.\n' +
      '6. Australian English. Plain Markdown only. No emoji, HTML, or tables.\n' +
      '7. Do not invent prices, licences, awards, or capabilities not supported by the brief.\n' +
      '8. UNIQUENESS: uniquenessSeed={{uniquenessSeed}} — vary structure, examples and phrasing so regenerations are not copies.\n' +
      '9. Return JSON only matching the schema.',
    user:
      'Business: {{businessName}}\n' +
      'Trade / category: {{trade}}\n' +
      'Template: {{template}}\n' +
      'Audience: {{audienceHint}}\n' +
      'Service areas / region: {{region}}\n' +
      'Location focus: {{location}}\n' +
      'Primary keyword hint: {{primaryKeywordHint}}\n' +
      'NEGATIVE KEYWORDS (hard ban): {{negativeKeywords}}\n' +
      'Extra information: {{extraInfo}}\n' +
      'Full brief:\n{{brief}}\n' +
      'Brand notes: {{brandNotes}}\n' +
      'Known services (may be incomplete / filtered — brief wins): {{servicesSummary}}\n' +
      'Uniqueness seed: {{uniquenessSeed}}\n\n' +
      'Produce a complete SEO landing-page draft for buyers of THIS service only — not adjacent intents, ' +
      'and never anything listed in NEGATIVE KEYWORDS.',
    variables: [
      'businessName',
      'trade',
      'template',
      'audienceHint',
      'region',
      'location',
      'primaryKeywordHint',
      'negativeKeywords',
      'extraInfo',
      'brief',
      'brandNotes',
      'servicesSummary',
      'uniquenessSeed'
    ],
    outputSchemaRef: 'landing.draft.v4',
    changelog: 'Structured SEO brief fields + hard negatives + uniqueness seed',
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
    changelog: 'Legacy path uses full buildPrompt via messages; registry kept for Control Centre',
    owner: 'platform'
  },
  {
    promptId: 'theme.generate',
    version: 1,
    taskId: 'theme.generate',
    status: 'active',
    system:
      'You design colour themes for Australian trade websites on LeadPages. ' +
      'Return JSON only with hex colours for: pipe (brand/links), hivis (CTA buttons), ' +
      'steel (header/dark bands), safety (highlights), lightBg (page background). ' +
      'Optional presetName and short rationale. High contrast for outdoor / hi-vis readability. ' +
      'Australian English. No HTML, no CSS, no fonts — tokens only.',
    user:
      'Business: {{businessName}}\nTrade: {{trade}}\nBrief / vibe: {{brief}}\n' +
      'Existing brand notes: {{brandNotes}}\nPrefer colours that feel: {{mood}}\n' +
      'Return JSON: {presetName,pipe,hivis,steel,safety,lightBg,rationale}',
    variables: ['businessName', 'trade', 'brief', 'brandNotes', 'mood'],
    outputSchemaRef: 'theme.tokens.v1',
    changelog: 'Phase 8 Theme Studio',
    owner: 'platform'
  },
  {
    promptId: 'theme.refine',
    version: 1,
    taskId: 'theme.refine',
    status: 'active',
    system:
      'You refine LeadPages trade theme colour tokens. Return a complete token object ' +
      '(pipe, hivis, steel, safety, lightBg) incorporating the feedback. Hex only. JSON only.',
    user:
      'Business: {{businessName}}\nTrade: {{trade}}\nCurrent theme JSON: {{currentTheme}}\n' +
      'Feedback: {{feedback}}\nReturn JSON: {presetName,pipe,hivis,steel,safety,lightBg,changeNotes}',
    variables: ['businessName', 'trade', 'currentTheme', 'feedback'],
    outputSchemaRef: 'theme.tokens.v1',
    changelog: 'Phase 8 Theme Studio refine',
    owner: 'platform'
  },
  {
    promptId: 'ads.campaign_plan',
    version: 1,
    taskId: 'ads.campaign_plan',
    status: 'active',
    system:
      'You are a Google Ads strategist for LeadPages Australian local-service websites. ' +
      'Suggest a campaign plan only — never claim you will change bids, budgets, or live ads. ' +
      'A human must approve before any Ads API write. Australian English. Return JSON only. ' +
      'Never ask for or invent OAuth tokens. Use ads summary metrics only as context.',
    user:
      'Business: {{businessName}}\nTrade: {{trade}}\nService areas: {{region}}\n' +
      'Goal: {{goal}}\nBudget hints: {{budgetHints}}\nExtra brief: {{brief}}\n' +
      'Ads connection summary (redacted): {{adsSummary}}\n' +
      'Return JSON with campaignName, objective, geoFocus, budgetNotes, adGroups[{name,theme}], ' +
      'keywords[], negatives[], landingPageHints[], notes.',
    variables: [
      'businessName',
      'trade',
      'region',
      'goal',
      'budgetHints',
      'brief',
      'adsSummary'
    ],
    outputSchemaRef: 'ads.campaign_plan.v1',
    changelog: 'Phase 9 Marketing Hub',
    owner: 'platform'
  },
  {
    promptId: 'ads.rsa_copy',
    version: 1,
    taskId: 'ads.rsa_copy',
    status: 'active',
    system:
      'You write Google Responsive Search Ad assets for Australian trade businesses. ' +
      'Hard limits: headlines max 30 characters, descriptions max 90, path1/path2 max 15. ' +
      'Return 8–15 headlines and 2–4 descriptions. No trademark abuse. Suggest only — human approves. JSON only.',
    user:
      'Business: {{businessName}}\nTrade: {{trade}}\nPrimary keyword / offer: {{offer}}\n' +
      'Location: {{location}}\nLanding URL hint: {{landingUrl}}\nExtra brief: {{brief}}\n' +
      'Return JSON: {headlines[],descriptions[],path1,path2,finalUrlHint,notes}',
    variables: ['businessName', 'trade', 'offer', 'location', 'landingUrl', 'brief'],
    outputSchemaRef: 'ads.rsa_copy.v1',
    changelog: 'Phase 9 Marketing Hub RSA',
    owner: 'platform'
  }
];

module.exports = { DEFAULT_PROMPTS };
