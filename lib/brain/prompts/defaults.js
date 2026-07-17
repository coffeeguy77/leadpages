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
    status: 'active',
    system:
      'You draft landing-page copy for Australian trade businesses. ' +
      'Return JSON only matching the schema. AI suggests; a human will approve before publish.',
    user:
      'Business: {{businessName}}\nTrade: {{trade}}\nBrief: {{brief}}\n' +
      'Brand notes: {{brandNotes}}\nServices: {{servicesSummary}}',
    variables: ['businessName', 'trade', 'brief', 'brandNotes', 'servicesSummary'],
    outputSchemaRef: 'landing.draft.v1',
    changelog: 'Server-side draft prompt to replace broken client aiGenerate',
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
