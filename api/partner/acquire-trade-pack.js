// POST /api/partner/acquire-trade-pack
// Partner acquires a trade content pack for a target location, avoiding duplicates.
//
// Body: {
//   packSlug?, trade?, category?, targetLocation (required),
//   mode?: 'pick' | 'create',          // create = new trade for community library
//   confirmNewGeneration?: boolean     // user confirmed AI credits for fresh variant
// }
//
// Returns pack JSON + metadata, or needsConfirmation when a new AI variant is required.

const { createClient } = require('@supabase/supabase-js');
const {
  slugify,
  locationSlug,
  contentHash,
  buildPrompt,
  MAX_VARIANTS,
  callClaude,
} = require('../../lib/trade-pack-utils');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getPartner(token) {
  if (!token) return null;
  try {
    const ur = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    const user = await ur.json();
    if (!user || !user.id) return null;
    const pr = await sb.from('partners').select('id,status').eq('user_id', user.id).maybeSingle();
    if (!pr.data || pr.data.status !== 'active') return null;
    return { userId: user.id, partnerId: pr.data.id };
  } catch (_e) {
    return null;
  }
}

async function getUsedPackIds(packSlug, locSlug) {
  try {
    const { data, error } = await sb
      .from('pack_location_usage')
      .select('pack_id')
      .eq('pack_slug', packSlug)
      .eq('location_slug', locSlug);
    if (error) return new Set();
    return new Set((data || []).map((r) => r.pack_id));
  } catch (_e) {
    return new Set();
  }
}

async function recordUsage(row) {
  try {
    await sb.from('pack_location_usage').upsert(row, { onConflict: 'pack_id,location_slug' });
  } catch (_e) {
    /* table may not exist yet — non-fatal for demo create */
  }
}

async function listVariants(slug) {
  const { data } = await sb
    .from('service_packs')
    .select('id,variant,slug,label,pack,use_count,content_hash,category')
    .eq('slug', slug)
    .eq('is_approved', true)
    .order('variant', { ascending: true });
  return data || [];
}

async function generateAndSave(trade, category, userId, existingCount) {
  const parsed = await callClaude(buildPrompt(trade, category));
  const slug = parsed.slug || slugify(trade);
  const hash = contentHash(parsed.pack);
  const nextVariant = existingCount + 1;
  const { data: saved, error } = await sb
    .from('service_packs')
    .insert({
      slug,
      category: parsed.category || category || 'General',
      label: parsed.pack.label || trade,
      pack: parsed.pack,
      variant: nextVariant,
      content_hash: hash,
      generated_by: userId,
      is_approved: true,
      use_count: 0,
    })
    .select('id,variant,slug,label,pack,category')
    .single();
  if (error) throw new Error('Save failed: ' + error.message);
  return saved;
}

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const partner = await getPartner(token);
  if (!partner) return res.status(401).json({ ok: false, error: 'Active partner sign-in required' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_e) { body = {}; }
  }
  body = body || {};

  const targetLocation = String(body.targetLocation || '').trim();
  if (!targetLocation || targetLocation.length < 2) {
    return res.status(400).json({ ok: false, error: 'Target location is required (e.g. Canberra, Sydney).' });
  }

  const mode = body.mode === 'create' ? 'create' : 'pick';
  const tradeName = String(body.trade || '').trim();
  const packSlug = slugify(body.packSlug || tradeName);
  const category = String(body.category || 'General').trim();
  const confirmNew = body.confirmNewGeneration === true;
  const locSlug = locationSlug(targetLocation);

  if (!packSlug && mode === 'pick') {
    return res.status(400).json({ ok: false, error: 'Select a trade or enter a new trade name.' });
  }
  if (mode === 'create' && (!tradeName || tradeName.length < 2)) {
    return res.status(400).json({ ok: false, error: 'Enter a name for the new trade (min 2 characters).' });
  }

  try {
    const slug = mode === 'create' ? slugify(tradeName) : packSlug;
    let variants = await listVariants(slug);

    // Brand-new trade — generate first community pack immediately
    if (mode === 'create') {
      if (variants.length) {
        return res.status(409).json({
          ok: false,
          error: `“${variants[0].label}” already exists in the community library. Select it from the trade list.`,
          slug,
        });
      }
      if (!confirmNew) {
        return res.status(200).json({
          ok: false,
          needsConfirmation: true,
          code: 'NEW_TRADE',
          message: `Create a new community trade pack for "${tradeName}"? This uses AI credits and adds the trade to the shared library for all partners.`,
          slug,
          trade: tradeName,
        });
      }
      const saved = await generateAndSave(tradeName, category, partner.userId, 0);
      await recordUsage({
        pack_id: saved.id,
        pack_slug: saved.slug,
        pack_variant: saved.variant,
        location_slug: locSlug,
        location_label: targetLocation,
        content_hash: contentHash(saved.pack),
        partner_id: partner.partnerId,
      });
      await sb.from('service_packs').update({ use_count: 1 }).eq('id', saved.id);
      return res.status(200).json({
        ok: true,
        source: 'new_trade',
        slug: saved.slug,
        label: saved.label,
        category: saved.category,
        variant: saved.variant,
        packId: saved.id,
        pack: saved.pack,
        targetLocation,
        communityAdded: true,
      });
    }

    if (!variants.length) {
      const tradeLabel = tradeName || (body.tradeLabel || '').trim() || slug.replace(/-/g, ' ');
      if (!confirmNew) {
        return res.status(200).json({
          ok: false,
          needsConfirmation: true,
          code: 'NO_PACK',
          message: `No community content exists for this trade yet. Generate the first shared pack for "${tradeLabel}"? (Uses AI credits — available to all partners.)`,
          slug,
          trade: tradeLabel,
        });
      }
      const saved = await generateAndSave(tradeLabel, category, partner.userId, 0);
      await recordUsage({
        pack_id: saved.id,
        pack_slug: saved.slug,
        pack_variant: saved.variant,
        location_slug: locSlug,
        location_label: targetLocation,
        content_hash: contentHash(saved.pack),
        partner_id: partner.partnerId,
      });
      await sb.from('service_packs').update({ use_count: 1 }).eq('id', saved.id);
      return res.status(200).json({
        ok: true,
        source: 'first_pack',
        slug: saved.slug,
        label: saved.label,
        category: saved.category,
        variant: saved.variant,
        packId: saved.id,
        pack: saved.pack,
        targetLocation,
        communityAdded: true,
      });
    }

    const usedIds = await getUsedPackIds(slug, locSlug);
    const available = variants.filter((v) => !usedIds.has(v.id));

    if (available.length) {
      available.sort((a, b) => (a.use_count || 0) - (b.use_count || 0));
      const pick = available[0];
      await sb.from('service_packs').update({ use_count: (pick.use_count || 0) + 1 }).eq('id', pick.id);
      await recordUsage({
        pack_id: pick.id,
        pack_slug: pick.slug,
        pack_variant: pick.variant,
        location_slug: locSlug,
        location_label: targetLocation,
        content_hash: pick.content_hash || contentHash(pick.pack),
        partner_id: partner.partnerId,
      });
      return res.status(200).json({
        ok: true,
        source: 'existing',
        slug: pick.slug,
        label: pick.label,
        category: pick.category,
        variant: pick.variant,
        packId: pick.id,
        pack: pick.pack,
        targetLocation,
        duplicateAvoided: usedIds.size > 0,
        unusedAtLocation: available.length,
      });
    }

    // All variants already used at this location — need fresh AI content
    if (!confirmNew) {
      return res.status(200).json({
        ok: false,
        needsConfirmation: true,
        code: 'LOCATION_EXHAUSTED',
        message: `All ${variants.length} content variant(s) for this trade have already been used in ${targetLocation}. Generate fresh unique content? (Uses AI credits — helps keep copy unique for SEO.)`,
        slug,
        variantsUsed: variants.length,
        targetLocation,
      });
    }

    const saved = await generateAndSave(
      variants[0].label || tradeName || slug,
      variants[0].category || category,
      partner.userId,
      variants.length
    );

    // Reject if hash collides with an existing variant
    const dup = variants.find((v) => v.content_hash && v.content_hash === contentHash(saved.pack));
    if (dup) {
      return res.status(409).json({
        ok: false,
        error: 'Generated content was too similar to an existing variant. Please try again.',
      });
    }

    await recordUsage({
      pack_id: saved.id,
      pack_slug: saved.slug,
      pack_variant: saved.variant,
      location_slug: locSlug,
      location_label: targetLocation,
      content_hash: contentHash(saved.pack),
      partner_id: partner.partnerId,
    });
    await sb.from('service_packs').update({ use_count: 1 }).eq('id', saved.id);

    return res.status(200).json({
      ok: true,
      source: 'generated',
      slug: saved.slug,
      label: saved.label,
      category: saved.category,
      variant: saved.variant,
      packId: saved.id,
      pack: saved.pack,
      targetLocation,
      freshForLocation: true,
      totalVariants: variants.length + 1,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
