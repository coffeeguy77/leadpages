'use strict';

/**
 * Persist open Next Best Actions into si_recommendations (soft-fail if schema pending).
 */

async function persistRecommendations(admin, siteId, findings) {
  if (!admin || !siteId || !Array.isArray(findings) || !findings.length) {
    return { ok: false, skipped: 'missing' };
  }

  const open = findings.filter(function (f) {
    return f && f.status === 'open' && (f.recipeId || f.code);
  });
  if (!open.length) return { ok: true, upserted: 0 };

  let upserted = 0;
  let skippedSchema = false;

  for (let i = 0; i < Math.min(40, open.length); i++) {
    const f = open[i];
    const recipeId = f.recipeId || f.code;
    const title = String(f.title || recipeId).slice(0, 200);
    try {
      // Soft de-dupe: skip if an open row with same recipe+title exists
      const { data: existing, error: selErr } = await admin
        .from('si_recommendations')
        .select('id')
        .eq('site_id', siteId)
        .eq('recipe_id', recipeId)
        .eq('status', 'open')
        .eq('title', title)
        .limit(1);
      if (selErr) {
        if (/relation|does not exist/i.test(String(selErr.message || ''))) {
          skippedSchema = true;
          break;
        }
        continue;
      }
      if (existing && existing.length) continue;

      const { error } = await admin.from('si_recommendations').insert({
        site_id: siteId,
        recipe_id: recipeId,
        status: 'open',
        severity: f.severity || 'medium',
        title: title,
        plain_language: f.plainLanguage || null,
        evidence: f.evidence || {},
        confidence: f.confidence != null ? f.confidence : null,
        updated_at: new Date().toISOString()
      });
      if (error) {
        if (/relation|does not exist/i.test(String(error.message || ''))) {
          skippedSchema = true;
          break;
        }
        continue;
      }
      upserted += 1;
    } catch (_e) {
      skippedSchema = true;
      break;
    }
  }

  return {
    ok: !skippedSchema,
    upserted: upserted,
    skipped: skippedSchema ? 'schema_pending' : undefined
  };
}

module.exports = {
  persistRecommendations: persistRecommendations
};
