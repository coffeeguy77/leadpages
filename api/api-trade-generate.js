// api/trade-generate.js — legacy/admin trade pack generation (delegates to shared lib).

const { createClient } = require('@supabase/supabase-js');
const {
  slugify,
  contentHash,
  buildPrompt,
  callClaude,
  validatePack,
  MAX_VARIANTS,
} = require('../lib/trade-pack-utils');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in required' });
  let user = null;
  try {
    const ur = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    user = await ur.json();
    if (!user || !user.id) return res.status(401).json({ error: 'Invalid session' });
  } catch (_e) {
    return res.status(401).json({ error: 'Auth failed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_e) { body = {}; }
  }
  body = body || {};

  const trade = String(body.trade || '').trim();
  const category = String(body.category || 'General').trim();
  if (!trade || trade.length < 2) return res.status(400).json({ error: 'Trade name required (min 2 chars)' });
  if (trade.length > 80) return res.status(400).json({ error: 'Trade name too long' });

  const slug = slugify(trade);

  try {
    const { data: existing } = await sb
      .from('service_packs')
      .select('id,variant,slug,label,pack,use_count,content_hash')
      .eq('slug', slug)
      .eq('is_approved', true)
      .order('variant', { ascending: true });

    const variants = existing || [];
    const wantNew = !variants.length || body.forceNew === true;

    if (!wantNew && variants.length > 0) {
      const pick = variants[Math.floor(Math.random() * variants.length)];
      await sb.from('service_packs').update({ use_count: (pick.use_count || 0) + 1 }).eq('id', pick.id);
      return res.status(200).json({
        ok: true,
        source: 'existing',
        variant: pick.variant,
        slug: pick.slug,
        pack: pick.pack,
        label: pick.label,
        totalVariants: variants.length,
      });
    }

    if (variants.length >= MAX_VARIANTS && !body.forceNew) {
      const pick = variants[Math.floor(Math.random() * variants.length)];
      return res.status(200).json({
        ok: true,
        source: 'existing_cap',
        variant: pick.variant,
        slug: pick.slug,
        pack: pick.pack,
        label: pick.label,
        totalVariants: variants.length,
      });
    }

    const parsed = await callClaude(buildPrompt(trade, category));
    const validErr = validatePack(parsed);
    if (validErr) return res.status(502).json({ error: 'AI pack validation failed: ' + validErr });

    const nextVariant = variants.length + 1;
    const hash = contentHash(parsed.pack);

    const { data: saved, error: saveErr } = await sb
      .from('service_packs')
      .insert({
        slug,
        category: parsed.category || category,
        label: parsed.pack.label || trade,
        pack: parsed.pack,
        variant: nextVariant,
        content_hash: hash,
        generated_by: user.id,
        is_approved: true,
        use_count: 1,
      })
      .select('id,variant,slug,label,pack')
      .single();

    if (saveErr) return res.status(500).json({ error: 'Save failed: ' + saveErr.message });

    return res.status(200).json({
      ok: true,
      source: 'generated',
      variant: nextVariant,
      slug: saved.slug,
      pack: saved.pack,
      label: saved.label,
      totalVariants: nextVariant,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
};
