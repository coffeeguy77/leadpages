// Shared trade pack helpers — token vocabulary, hashing, prompts, resolution.
const crypto = require('crypto');

const CLAUDE_MODEL = process.env.TRADE_PACK_MODEL || 'claude-sonnet-4-6';
const MAX_VARIANTS = 5;

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function locationSlug(label) {
  return slugify(label) || 'location';
}

/** Normalise pack JSON for fingerprinting (strip tokens so variants compare fairly). */
function normalisePackText(pack) {
  const raw = JSON.stringify(pack || {});
  return raw
    .replace(/\{\{\s*businessName\s*\}\}/gi, '')
    .replace(/\{business\}/gi, '')
    .replace(/\{location\}/gi, '')
    .replace(/\{city\}/gi, '')
    .replace(/\{suburb\}/gi, '')
    .replace(/\{region\}/gi, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function contentHash(pack) {
  return crypto.createHash('sha256').update(normalisePackText(pack)).digest('hex').slice(0, 32);
}

function buildPrompt(trade, category) {
  const slug = slugify(trade);
  return `You are generating a "trade starter content pack" for LeadPages, an Australian tradie landing-page builder. Produce ONE complete pack for the trade: "${trade}".

IMPORTANT — use ONLY these placeholder tokens for personalisation (never hardcode a real business name or place):
- {business} — the client's business name
- {location} — the target city/area (e.g. Canberra, Sydney, Gold Coast)

Example line: "Trusted {business} serving {location} and nearby suburbs."

Return ONLY a single valid JSON object — no markdown, no commentary, no code fences — with EXACTLY this shape:

{
  "slug": "${slug}",
  "category": "${category || 'General'}",
  "pack": {
    "label": "Short trade name, Title Case, 1-3 words",
    "tradeType": "What to call the worker, e.g. \\"Drain Specialist\\"",
    "theme": { "pipe": "#hex primary brand colour", "hivis": "#hex accent", "steel": "#hex near-black", "safety": "#hex light tint" },
    "services": [ EXACTLY 6 items of { "on": true, "icon": "<single emoji>", "title": "2-4 words", "body": "one short sentence using {location} where natural" } ],
    "sections": {
      "header": { "cta": "Speak to a <trade>", "button": "Call now" },
      "emerg": { "text": "one short urgency or availability line" },
      "hero": {
        "eyebrow": "short label · qualifier",
        "title": "2-3 word hook",
        "titleHl": "2-4 word highlighted finish",
        "sub": "1-2 sentences using {location}",
        "badges": [ EXACTLY 4 items of { "icon": "one of ✓ ★ $ ⚡", "text": "2-3 words" } ]
      },
      "services": { "eyebrow": "What we do", "heading": "punchy 3-5 words", "intro": "one sentence" },
      "why": {
        "eyebrow": "Why {business}",
        "heading": "3-5 words",
        "items": [ EXACTLY 4 items of { "n": "one of 01 24/7 ★ ⌂", "title": "2-3 words", "body": "one sentence" } ]
      },
      "area": {
        "eyebrow": "Where we work",
        "heading": "Across {location}",
        "intro": "one sentence using {location}",
        "suburbs": ["{location}", "{location}", "{location}", "{location}", "{location}", "{location}", "{location}", "{location}", "{location}", "{location}"]
      },
      "reviews": {
        "eyebrow": "From the neighbours",
        "heading": "3-5 words",
        "items": [ EXACTLY 3 items of { "who": "First L. — {location}", "text": "\\"a quote that uses {business} once\\"" } ]
      },
      "quote": {
        "eyebrow": "Fast quote",
        "sub": "one sentence",
        "button": "Send & get my call back",
        "formTitle": "Get my quote",
        "lblName": "Name", "lblPhone": "Phone", "lblSuburb": "Suburb", "lblDetail": "Anything else? (optional)",
        "successTitle": "Got it — sit tight. ✓",
        "heading": "one sentence",
        "lblJob": "a question label",
        "points": [ EXACTLY 3 items of { "text": "short" } ],
        "jobOptions": [ EXACTLY 5 items of { "text": "short option" } ]
      },
      "faq": {
        "eyebrow": "Good to know",
        "heading": "Quick answers.",
        "items": [ EXACTLY 2 items of { "q": "a question?", "a": "1-2 sentence answer" } ]
      },
      "footer": {
        "blurb": "one sentence summary using {location}",
        "legal": "{business} — <relevant licence line placeholder>. ABN 00 000 000 000. Fully insured. Servicing {location}. © 2026 {business}.",
        "services": [ EXACTLY 4 items of { "label": "short", "href": "#quote" } ]
      }
    }
  }
}

Rules:
- Australian English; confident, plain, local-tradie tone.
- Use {business} and {location} only — never hardcode real business names or place names.
- Do NOT use {city}, {region}, {suburb}, or {{businessName}} — only {business} and {location}.
- "steel" must be near-black; pick colours that suit the trade.
- Hit counts exactly: 6 services, 4 badges, 4 why items, 3 reviews, 3 points, 5 jobOptions, 2 faq, 4 footer services, 10 suburbs (all "{location}").
- Output the JSON object only.`;
}

function validatePack(obj) {
  if (!obj || typeof obj !== 'object') return 'Not an object';
  const p = obj.pack;
  if (!p) return 'Missing pack field';
  if (!p.label || !p.tradeType) return 'Missing label or tradeType';
  if (!Array.isArray(p.services) || p.services.length < 4) return 'Need at least 4 services';
  if (!p.sections) return 'Missing sections';
  if (!p.sections.hero) return 'Missing hero section';
  if (!p.sections.reviews) return 'Missing reviews section';
  if (!p.sections.quote) return 'Missing quote section';
  if (!p.theme || !p.theme.pipe) return 'Missing theme.pipe colour';
  return null;
}

/** Resolve all token forms into final copy for a specific business + location. */
function resolvePackTokens(pack, businessName, targetLocation) {
  const biz = (businessName || '').trim() || 'Your Business';
  const loc = (targetLocation || '').trim() || 'your area';
  function walk(v) {
    if (typeof v === 'string') {
      return v
        .replace(/\{\{\s*businessName\s*\}\}/gi, biz)
        .replace(/\{business\}/gi, biz)
        .replace(/\{location\}/gi, loc)
        .replace(/\{city\}/gi, loc)
        .replace(/\{suburb\}/gi, loc)
        .replace(/\{region\}/gi, loc);
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k in v) o[k] = walk(v[k]);
      return o;
    }
    return v;
  }
  return walk(JSON.parse(JSON.stringify(pack)));
}

function mergePackIntoConfig(config, pack, businessName, tradeType, targetLocation) {
  const resolved = resolvePackTokens(pack, businessName, targetLocation);
  const next = Object.assign({}, config || {}, {
    trade: tradeType || resolved.tradeType || config.trade || '',
    name: businessName,
    layout: (config && config.layout) || 'classic',
  });
  if (resolved.theme) next.theme = resolved.theme;
  if (resolved.services) next.services = resolved.services;
  if (resolved.sections) {
    next.sections = Object.assign({}, config.sections || {}, resolved.sections);
  }
  const loc = (targetLocation || '').trim() || 'your area';
  next.sections = next.sections || {};
  next.sections.seoTokens = Object.assign({}, next.sections.seoTokens || {}, {
    trade: tradeType || resolved.tradeType || '',
    location: loc,
    city: loc,
    suburb: loc,
    region: loc,
  });
  return next;
}

async function callClaude(prompt) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('AI generation not configured (ANTHROPIC_API_KEY missing)');
  }
  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!aiRes.ok) {
    const err = await aiRes.text().catch(() => '');
    throw new Error('AI generation failed: ' + err.slice(0, 200));
  }
  const aiJson = await aiRes.json();
  const rawText = (aiJson.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const clean = rawText.replace(/^```(json)?/im, '').replace(/```$/m, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (_e) {
    throw new Error('AI returned invalid JSON');
  }
  const validErr = validatePack(parsed);
  if (validErr) throw new Error('AI pack validation failed: ' + validErr);
  return parsed;
}

module.exports = {
  CLAUDE_MODEL,
  MAX_VARIANTS,
  slugify,
  locationSlug,
  contentHash,
  normalisePackText,
  buildPrompt,
  validatePack,
  resolvePackTokens,
  mergePackIntoConfig,
  callClaude,
};
