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
  const cat = category || 'General';
  return `You are generating a "trade starter content pack" for LeadPages, an Australian tradie landing-page builder. Produce ONE complete pack for the trade: "${trade}".

Return ONLY a single valid JSON object — no markdown, no commentary, no code fences — with EXACTLY this shape and these counts:

{
  "slug": "${slug}",
  "category": "${cat}",
  "pack": {
    "label": "Short trade name, Title Case, 1-3 words",
    "tradeType": "What to call the worker, e.g. \\"Drain Specialist\\"",
    "theme": { "pipe": "#hex primary", "hivis": "#hex accent", "steel": "#hex near-black", "safety": "#hex light tint" },
    "services": [ EXACTLY 6 of { "on": true, "icon": "<single emoji>", "title": "2-4 words", "body": "one short sentence" } ],
    "sections": {
      "header": { "cta": "Speak to a <trade>", "button": "Call now" },
      "emerg": { "text": "one short urgency or availability line; may begin with \\"⚠ \\"" },
      "hero": { "eyebrow": "short label · qualifier", "title": "2-3 word hook", "titleHl": "2-4 word highlighted finish", "sub": "1-2 sentences, mention {location}", "badges": [ EXACTLY 4 of { "icon": "one of ✓ ★ $ ⚡", "text": "2-3 words" } ] },
      "services": { "eyebrow": "What we do", "heading": "punchy 3-5 words", "intro": "one sentence" },
      "why": { "eyebrow": "Why {business}", "heading": "3-5 words", "items": [ EXACTLY 4 of { "n": "one of 01 24/7 ★ ⌂", "title": "2-3 words", "body": "one sentence" } ] },
      "area": { "eyebrow": "Where we work", "heading": "Across {location}", "intro": "one sentence", "suburbs": ["{location}","{location}","{location}","{location}","{location}","{location}","{location}","{location}","{location}","{location}"] },
      "reviews": { "eyebrow": "From the neighbours", "heading": "3-5 words", "items": [ EXACTLY 3 of { "who": "First L. — {location}", "text": "\\"a quote that uses {business} once\\"" } ] },
      "quote": { "eyebrow": "Fast quote", "sub": "one sentence", "button": "Send & get my call back", "formTitle": "Get my quote", "lblName": "Name", "lblPhone": "Phone", "lblSuburb": "Suburb", "lblDetail": "Anything else? (optional)", "successTitle": "Got it — sit tight. ✓", "heading": "one sentence", "lblJob": "a question label", "points": [ EXACTLY 3 of { "text": "short" } ], "jobOptions": [ EXACTLY 5 of { "text": "short option" } ] },
      "faq": { "eyebrow": "Good to know", "heading": "Quick answers.", "items": [ EXACTLY 2 of { "q": "a question?", "a": "1-2 sentence answer" } ] },
      "footer": { "blurb": "one sentence summary", "legal": "{business} — <relevant licence line> (placeholder). ABN 00 000 000 000. Fully insured. Servicing {location}. © 2026 {business}.", "services": [ EXACTLY 4 of { "label": "short", "href": "#quote" } ] }
    }
  }
}

Rules:
- Australian English; confident, plain, local-tradie tone (not corporate).
- Use the literal token {business} wherever the business name belongs (why.eyebrow, one or two reviews, footer.blurb and footer.legal). Use {location} for city/area references (hero, area, reviews). Do NOT invent a business name or hardcode a real city.
- "steel" must be near-black; pick colours that suit the trade.
- Hit the counts exactly: 6 services, 4 badges, 4 why items, 3 reviews, 3 points, 5 jobOptions, 2 faq, 4 footer services, 10 suburbs (keep suburbs as listed — each value is the literal string "{location}").
- Keep every string short (one concise sentence max). Escape every internal double-quote as \\".
- Output the JSON object only. Do not wrap it in markdown.`;
}

/** Extract and parse JSON from Claude text output (tolerates fences, preamble, trailing commas, smart quotes, truncation). */
function sanitiseAiJsonText(raw) {
  let text = String(raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .trim();

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) text = fenceMatch[1].trim();

  const start = text.indexOf('{');
  if (start > 0) text = text.slice(start);

  // Drop trailing prose after the outermost object when intact.
  const end = findMatchingObjectEnd(text);
  if (end > 0) text = text.slice(0, end + 1);

  return text;
}

function findMatchingObjectEnd(text) {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function stripTrailingCommas(s) {
  return String(s || '').replace(/,\s*([\]}])/g, '$1');
}

/** Close truncated JSON so a cut-off Claude reply can still parse when enough of the pack exists. */
function repairTruncatedJson(s) {
  let text = String(s || '');

  function scan(src) {
    let inString = false;
    let escape = false;
    const stack = [];
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (inString) {
        if (escape) { escape = false; continue; }
        if (c === '\\') { escape = true; continue; }
        if (c === '"') inString = false;
        continue;
      }
      if (c === '"') { inString = true; continue; }
      if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if ((c === '}' || c === ']') && stack.length && stack[stack.length - 1] === c) stack.pop();
    }
    return { inString: inString, stack: stack };
  }

  let state = scan(text);
  if (state.inString) {
    if (/,\s*"[^"\\]*$/.test(text)) {
      // Cut mid-key: ,"lab  → drop incomplete property
      text = text.replace(/,\s*"[^"\\]*$/, '');
    } else if (/:\s*"[^"\\]*$/.test(text)) {
      // Cut mid-string value: :"Dies  → close string
      text += '"';
    } else {
      text += '"';
    }
    state = scan(text);
  }

  text = text.replace(/,\s*$/, '');
  state = scan(text);
  while (state.stack.length) {
    text += state.stack.pop();
  }
  return stripTrailingCommas(text);
}

function escapeBrokenControlCharsInStrings(s) {
  let out = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (!inString) {
      out += c;
      if (c === '"') inString = true;
      continue;
    }
    if (escape) {
      out += c;
      escape = false;
      continue;
    }
    if (c === '\\') {
      out += c;
      escape = true;
      continue;
    }
    if (c === '"') {
      out += c;
      inString = false;
      continue;
    }
    if (c === '\n') { out += '\\n'; continue; }
    if (c === '\r') { out += '\\r'; continue; }
    if (c === '\t') { out += '\\t'; continue; }
    out += c;
  }
  return out;
}

function parseAiJson(rawText) {
  if (!rawText || !String(rawText).trim()) {
    throw new Error('AI returned empty response');
  }

  const candidates = [];
  const base = sanitiseAiJsonText(rawText);
  candidates.push(base);
  candidates.push(stripTrailingCommas(base));
  candidates.push(escapeBrokenControlCharsInStrings(stripTrailingCommas(base)));
  candidates.push(repairTruncatedJson(base));
  candidates.push(escapeBrokenControlCharsInStrings(repairTruncatedJson(base)));

  let lastErr = null;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!candidate || candidate[0] !== '{') continue;
    try {
      return JSON.parse(stripTrailingCommas(candidate));
    } catch (e) {
      lastErr = e;
    }
  }

  throw new Error((lastErr && lastErr.message) || 'could not parse JSON');
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

/** Fill sparse AI packs so a nearly-complete truncated response can still be saved. */
function hydrateSparsePack(parsed, trade, category) {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const next = Object.assign({}, parsed);
  next.slug = next.slug || slugify(trade);
  next.category = next.category || category || 'General';
  next.pack = Object.assign({}, next.pack || {});
  const p = next.pack;
  p.label = p.label || String(trade || next.slug || 'Trade').trim();
  p.tradeType = p.tradeType || p.label;
  p.theme = Object.assign({ pipe: '#0B2114', hivis: '#C5E13F', steel: '#0B2114', safety: '#F4F1EA' }, p.theme || {});
  if (!Array.isArray(p.services)) p.services = [];
  while (p.services.length < 4) {
    p.services.push({ on: true, icon: '✓', title: p.label, body: 'Professional ' + p.label.toLowerCase() + ' services for {location}.' });
  }
  p.sections = p.sections || {};
  const s = p.sections;
  s.header = s.header || { cta: 'Speak to a ' + p.tradeType, button: 'Call now' };
  s.emerg = s.emerg || { text: 'Local ' + p.tradeType.toLowerCase() + ' support across {location}.' };
  s.hero = s.hero || {
    eyebrow: p.label + ' · {location}',
    title: p.label + ' work',
    titleHl: 'done properly',
    sub: 'Reliable ' + p.tradeType.toLowerCase() + ' help across {location}.',
    badges: [
      { icon: '✓', text: 'Licensed' },
      { icon: '★', text: 'Local' },
      { icon: '$', text: 'Clear pricing' },
      { icon: '⚡', text: 'Fast call-back' },
    ],
  };
  s.services = s.services || { eyebrow: 'What we do', heading: p.label + ' services', intro: 'Practical help for homes and businesses in {location}.' };
  s.why = s.why || {
    eyebrow: 'Why {business}',
    heading: 'Local and reliable',
    items: [
      { n: '01', title: 'Local', body: 'We know {location} and show up when we say we will.' },
      { n: '★', title: 'Quality', body: 'Careful work first time, not shortcuts.' },
      { n: '⌂', title: 'Clear quotes', body: 'Straight talk and fair pricing.' },
      { n: '24/7', title: 'Responsive', body: 'Quick call-backs when you need help.' },
    ],
  };
  s.area = s.area || {
    eyebrow: 'Where we work',
    heading: 'Across {location}',
    intro: 'Servicing {location} and surrounds.',
    suburbs: Array(10).fill('{location}'),
  };
  s.reviews = s.reviews || {
    eyebrow: 'From the neighbours',
    heading: 'What locals say',
    items: [
      { who: 'Sam P. — {location}', text: '"{business} made the job easy and tidy."' },
      { who: 'Alex R. — {location}', text: '"Clear quote and good communication."' },
      { who: 'Jordan L. — {location}', text: '"Would use {business} again."' },
    ],
  };
  s.quote = s.quote || {
    eyebrow: 'Fast quote',
    sub: 'Tell us what you need and we will call back.',
    button: 'Send & get my call back',
    formTitle: 'Get my quote',
    lblName: 'Name',
    lblPhone: 'Phone',
    lblSuburb: 'Suburb',
    lblDetail: 'Anything else? (optional)',
    successTitle: 'Got it — sit tight. ✓',
    heading: 'Get a call back from {business}',
    lblJob: 'What do you need help with?',
    points: [{ text: 'No obligation' }, { text: 'Fast reply' }, { text: 'Local advice' }],
    jobOptions: [
      { text: 'Service / repair' },
      { text: 'Inspection' },
      { text: 'New install' },
      { text: 'Maintenance' },
      { text: 'Other' },
    ],
  };
  s.faq = s.faq || {
    eyebrow: 'Good to know',
    heading: 'Quick answers.',
    items: [
      { q: 'Do you cover {location}?', a: 'Yes — we regularly service {location} and nearby areas.' },
      { q: 'How fast can I get a quote?', a: 'Send the form and {business} will call back as soon as possible.' },
    ],
  };
  s.footer = s.footer || {
    blurb: '{business} provides ' + p.label.toLowerCase() + ' services across {location}.',
    legal: '{business} — licences and insurance details on request. Servicing {location}. © 2026 {business}.',
    services: [
      { label: 'Services', href: '#services' },
      { label: 'Areas', href: '#areas' },
      { label: 'Reviews', href: '#reviews' },
      { label: 'Quote', href: '#quote' },
    ],
  };
  return next;
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

const PACK_SELECT = 'slug,label,pack,category,variant,use_count';

function packVariant(row) {
  return row && row.variant != null ? row.variant : 1;
}

function packUsageKey(slug, variant) {
  return `${slug}:${variant || 1}`;
}

/** Insert or upsert a service_packs row (slug-keyed; no id column required). */
async function saveServicePack(sb, row) {
  const base = {
    slug: row.slug,
    category: row.category || 'General',
    label: row.label,
    pack: row.pack,
  };
  let attempt = { ...base };
  if (row.variant != null) attempt.variant = row.variant;
  if (row.content_hash) attempt.content_hash = row.content_hash;
  if (row.generated_by) attempt.generated_by = row.generated_by;
  if (row.is_approved != null) attempt.is_approved = row.is_approved;
  if (row.use_count != null) attempt.use_count = row.use_count;

  for (let pass = 0; pass < 8; pass++) {
    let res = await sb.from('service_packs').insert(attempt).select(PACK_SELECT).single();
    if (!res.error && res.data) {
      return { ...res.data, variant: packVariant(res.data) };
    }
    const msg = res.error?.message || '';

    if (/duplicate|unique|violates/i.test(msg)) {
      const upsertRow = { ...base };
      if (attempt.variant != null) upsertRow.variant = attempt.variant;
      res = await sb.from('service_packs').upsert(upsertRow, { onConflict: 'slug' }).select(PACK_SELECT).single();
      if (!res.error && res.data) {
        return { ...res.data, variant: packVariant(res.data) };
      }
      res = await sb.from('service_packs').upsert(base, { onConflict: 'slug' }).select(PACK_SELECT).single();
      if (!res.error && res.data) {
        return { ...res.data, variant: 1 };
      }
    }

    if (/content_hash/i.test(msg)) delete attempt.content_hash;
    else if (/\bvariant\b/i.test(msg)) delete attempt.variant;
    else if (/is_approved/i.test(msg)) delete attempt.is_approved;
    else if (/use_count/i.test(msg)) delete attempt.use_count;
    else if (/generated_by/i.test(msg)) delete attempt.generated_by;
    else throw new Error('Save failed: ' + msg);
  }
  throw new Error('Save failed: could not save service pack');
}

async function bumpPackUseCount(sb, slug, variant) {
  variant = variant || 1;
  let sel = await sb.from('service_packs').select('use_count').eq('slug', slug).eq('variant', variant).maybeSingle();
  let matchVariant = variant;
  if (sel.error && /\bvariant\b/i.test(sel.error.message || '')) {
    sel = await sb.from('service_packs').select('use_count').eq('slug', slug).maybeSingle();
    matchVariant = null;
  }
  const next = ((sel.data && sel.data.use_count) || 0) + 1;
  let q = sb.from('service_packs').update({ use_count: next }).eq('slug', slug);
  if (matchVariant != null) q = q.eq('variant', matchVariant);
  await q;
}

async function listServicePackVariants(sb, slug) {
  let res = await sb
    .from('service_packs')
    .select(PACK_SELECT)
    .eq('slug', slug)
    .eq('is_approved', true)
    .order('variant', { ascending: true });
  if (res.error) {
    const msg = res.error.message || '';
    let q = sb.from('service_packs').select('slug,label,pack,category,use_count').eq('slug', slug);
    if (!/is_approved/i.test(msg)) q = q.eq('is_approved', true);
    res = await q;
  }
  return (res.data || []).map((r) => ({ ...r, variant: packVariant(r) }));
}

async function getUsedPackVariants(sb, packSlug, locSlug) {
  try {
    const { data, error } = await sb
      .from('pack_location_usage')
      .select('pack_slug,pack_variant')
      .eq('pack_slug', packSlug)
      .eq('location_slug', locSlug);
    if (error) return new Set();
    return new Set((data || []).map((r) => packUsageKey(r.pack_slug, r.pack_variant)));
  } catch (_e) {
    return new Set();
  }
}

async function recordPackLocationUsage(sb, row) {
  const usage = {
    pack_slug: row.pack_slug,
    pack_variant: row.pack_variant || 1,
    location_slug: row.location_slug,
    location_label: row.location_label,
    content_hash: row.content_hash || null,
    partner_id: row.partner_id || null,
    site_id: row.site_id || null,
  };
  try {
    await sb.from('pack_location_usage').upsert(usage, { onConflict: 'pack_slug,pack_variant,location_slug' });
  } catch (_e) {
    try {
      await sb.from('pack_location_usage').upsert(usage, { onConflict: 'pack_slug,location_slug' });
    } catch (_e2) {
      /* table may not exist yet — non-fatal */
    }
  }
}

async function callClaude(prompt, attempt = 1) {
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
      max_tokens: 12288,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!aiRes.ok) {
    const err = await aiRes.text().catch(() => '');
    throw new Error('AI generation failed: ' + err.slice(0, 200));
  }
  const aiJson = await aiRes.json();
  const rawText = (aiJson.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const stopReason = aiJson.stop_reason || aiJson.stopReason || '';
  let parsed = null;
  let parseErr = null;
  try {
    parsed = parseAiJson(rawText);
  } catch (e) {
    parseErr = e;
  }

  if (!parsed && attempt < 3 && (stopReason === 'max_tokens' || /Unexpected end of JSON|Unterminated string|Expected property name|Expected ',' or '}'|Expected ',' or '\]'/i.test(String(parseErr && parseErr.message || '')))) {
    return callClaude(
      prompt + '\n\nIMPORTANT: Your previous reply was cut off or invalid JSON. Return ONLY one complete raw JSON object — no markdown, no code fences, no commentary. Keep every string short so the full object fits.',
      attempt + 1
    );
  }

  if (!parsed) {
    if (attempt < 2) {
      return callClaude(
        prompt + '\n\nIMPORTANT: Your previous reply was not valid JSON. Return ONLY the raw JSON object — no markdown, no code fences, no commentary before or after.',
        attempt + 1
      );
    }
    const hint = rawText.length > 80 ? ': ' + rawText.slice(0, 120).replace(/\s+/g, ' ') + '…' : '';
    throw new Error('AI returned invalid JSON' + hint);
  }

  // Prefer the complete pack; if truncated and sparse, hydrate defaults.
  let validErr = validatePack(parsed);
  if (validErr) {
    const tradeMatch = String(prompt).match(/trade:\s*"([^"]+)"/i);
    const catMatch = String(prompt).match(/"category":\s*"([^"]+)"/);
    parsed = hydrateSparsePack(parsed, tradeMatch && tradeMatch[1], catMatch && catMatch[1]);
    validErr = validatePack(parsed);
  }
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
  parseAiJson,
  validatePack,
  hydrateSparsePack,
  resolvePackTokens,
  mergePackIntoConfig,
  callClaude,
  PACK_SELECT,
  packVariant,
  packUsageKey,
  saveServicePack,
  bumpPackUseCount,
  listServicePackVariants,
  getUsedPackVariants,
  recordPackLocationUsage,
};
