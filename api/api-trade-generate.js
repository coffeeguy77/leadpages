// api/trade-generate.js
// POST { trade, category?, partnerId? }
// 1. Checks if service_packs already has this slug — if so, picks a random variant
//    or generates a new one if < 3 variants exist
// 2. Calls Claude claude-sonnet-4-6 with the trade pack prompt
// 3. Validates the returned JSON
// 4. Saves to service_packs with next variant number
// 5. Returns the pack

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const MAX_VARIANTS = 5; // generate up to 5 unique versions per trade
const MAX_TOKENS   = 4000;

function slugify(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildPrompt(trade, category) {
  var slug = slugify(trade);
  return `You are generating a "trade starter content pack" for LeadPages, an Australian tradie landing-page builder. Produce ONE complete pack for the trade: "${trade}".

IMPORTANT — location tokens: Use the literal token {city} wherever the city/town belongs, {suburb} wherever a local suburb belongs, and {region} wherever the state/region belongs. Do NOT hardcode any real city name. Example: "Serving {city} and surrounding {region} areas."

Return ONLY a single valid JSON object — no markdown, no commentary, no code fences — with EXACTLY this shape:

{
  "slug": "${slug}",
  "category": "${category || 'General'}",
  "pack": {
    "label": "Short trade name, Title Case, 1-3 words",
    "tradeType": "What to call the worker, e.g. \\"Drain Specialist\\"",
    "theme": { "pipe": "#hex primary brand colour", "hivis": "#hex accent", "steel": "#hex near-black", "safety": "#hex light tint" },
    "services": [ EXACTLY 6 items of { "on": true, "icon": "<single emoji>", "title": "2-4 words", "body": "one short sentence" } ],
    "sections": {
      "header": { "cta": "Speak to a <trade>", "button": "Call now" },
      "emerg": { "text": "one short urgency or availability line" },
      "hero": {
        "eyebrow": "short label · qualifier",
        "title": "2-3 word hook",
        "titleHl": "2-4 word highlighted finish",
        "sub": "1-2 sentences using {city} and {region}",
        "badges": [ EXACTLY 4 items of { "icon": "one of ✓ ★ $ ⚡", "text": "2-3 words" } ]
      },
      "services": { "eyebrow": "What we do", "heading": "punchy 3-5 words", "intro": "one sentence" },
      "why": {
        "eyebrow": "Why {{businessName}}",
        "heading": "3-5 words",
        "items": [ EXACTLY 4 items of { "n": "one of 01 24/7 ★ ⌂", "title": "2-3 words", "body": "one sentence" } ]
      },
      "area": {
        "eyebrow": "Where we work",
        "heading": "Across {city} & {region}",
        "intro": "one sentence using {city}",
        "suburbs": ["{suburb}", "{suburb}", "{suburb}", "{suburb}", "{suburb}", "{suburb}", "{suburb}", "{suburb}", "{suburb}", "{suburb}"]
      },
      "reviews": {
        "eyebrow": "From the neighbours",
        "heading": "3-5 words",
        "items": [ EXACTLY 3 items of { "who": "First L. — {suburb}", "text": "\\"a quote that uses {{businessName}} once\\"" } ]
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
        "blurb": "one sentence summary using {city}",
        "legal": "{{businessName}} — <relevant licence line placeholder>. ABN 00 000 000 000. Fully insured. Servicing {city} & {region}. © 2026 {{businessName}}.",
        "services": [ EXACTLY 4 items of { "label": "short", "href": "#quote" } ]
      }
    }
  }
}

Rules:
- Australian English; confident, plain, local-tradie tone.
- Use {{businessName}} where the business name belongs (why.eyebrow, one or two reviews, footer).
- Use {city}, {suburb}, {region} for ALL location references — never hardcode a real place name.
- "steel" must be near-black; pick colours that suit the trade.
- Hit counts exactly: 6 services, 4 badges, 4 why items, 3 reviews, 3 points, 5 jobOptions, 2 faq, 4 footer services, 10 suburbs (all as "{suburb}" token).
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
  return null; // valid
}

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Auth: any signed-in user (partner or admin)
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in required' });
  let user = null;
  try {
    const ur = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    user = await ur.json();
    if (!user || !user.id) return res.status(401).json({ error: 'Invalid session' });
  } catch (e) { return res.status(401).json({ error: 'Auth failed' }); }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const trade    = String(body.trade || '').trim();
  const category = String(body.category || 'General').trim();
  if (!trade || trade.length < 2) return res.status(400).json({ error: 'Trade name required (min 2 chars)' });
  if (trade.length > 80) return res.status(400).json({ error: 'Trade name too long' });

  const slug = slugify(trade);

  try {
    // Check existing variants
    const { data: existing } = await sb.from('service_packs')
      .select('id,variant,slug,label,pack,use_count')
      .eq('slug', slug)
      .eq('is_approved', true)
      .order('variant', { ascending: true });

    const variants = existing || [];

    // If we already have variants and caller wants to reuse one, return a random existing variant
    // Only generate new if: no variants exist, OR body.forceNew=true, OR we're under MAX_VARIANTS
    const wantNew = !variants.length || body.forceNew === true;

    if (!wantNew && variants.length > 0) {
      // Return a random existing variant (weighted by lower use_count)
      const pick = variants[Math.floor(Math.random() * variants.length)];
      await sb.from('service_packs').update({ use_count: (pick.use_count || 0) + 1 }).eq('id', pick.id);
      return res.status(200).json({
        ok: true, source: 'existing', variant: pick.variant,
        slug: pick.slug, pack: pick.pack, label: pick.label,
        totalVariants: variants.length,
      });
    }

    if (variants.length >= MAX_VARIANTS) {
      // At cap — return random existing
      const pick = variants[Math.floor(Math.random() * variants.length)];
      return res.status(200).json({
        ok: true, source: 'existing_cap', variant: pick.variant,
        slug: pick.slug, pack: pick.pack, label: pick.label,
        totalVariants: variants.length,
      });
    }

    // Generate new variant via Claude
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'AI generation not configured (ANTHROPIC_API_KEY missing)' });
    }

    const prompt = buildPrompt(trade, category);
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text().catch(() => '');
      return res.status(502).json({ error: 'AI generation failed', detail: err.slice(0, 200) });
    }

    const aiJson = await aiRes.json();
    const rawText = (aiJson.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

    // Strip any accidental markdown fences
    const clean = rawText.replace(/^```(json)?/im, '').replace(/```$/m, '').trim();

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch (e) { return res.status(502).json({ error: 'AI returned invalid JSON', raw: rawText.slice(0, 500) }); }

    const validErr = validatePack(parsed);
    if (validErr) return res.status(502).json({ error: 'AI pack validation failed: ' + validErr, raw: clean.slice(0, 500) });

    const nextVariant = variants.length + 1;

    // Save to service_packs
    const { data: saved, error: saveErr } = await sb.from('service_packs').insert({
      slug,
      category: parsed.category || category,
      label: parsed.pack.label || trade,
      pack: parsed.pack,
      variant: nextVariant,
      generated_by: user.id,
      is_approved: true,
      use_count: 1,
    }).select('id,variant,slug,label,pack').single();

    if (saveErr) return res.status(500).json({ error: 'Save failed: ' + saveErr.message });

    return res.status(200).json({
      ok: true, source: 'generated', variant: nextVariant,
      slug: saved.slug, pack: saved.pack, label: saved.label,
      totalVariants: nextVariant,
    });

  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
};
