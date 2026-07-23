'use strict';

/**
 * Search Intelligence annotations — publish / handoff / schema events.
 */

async function recordAnnotation(admin, siteId, opts) {
  const o = opts || {};
  if (!admin || !siteId || !o.annotationType) {
    return { ok: false, error: 'missing_args' };
  }
  try {
    const { data, error } = await admin
      .from('si_annotations')
      .insert({
        site_id: siteId,
        annotation_type: String(o.annotationType),
        title: o.title || null,
        detail: o.detail || {},
        occurred_at: o.occurredAt || new Date().toISOString()
      })
      .select('id,created_at')
      .single();
    if (error) {
      if (/relation|does not exist/i.test(String(error.message || ''))) {
        return { ok: false, skipped: 'schema_pending' };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data.id, createdAt: data.created_at };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

async function listAnnotations(admin, siteId, opts) {
  const o = opts || {};
  if (!admin || !siteId) return { ok: true, annotations: [], available: false };
  try {
    let q = admin
      .from('si_annotations')
      .select('id,annotation_type,title,detail,occurred_at,created_at')
      .eq('site_id', siteId)
      .order('occurred_at', { ascending: false })
      .limit(o.limit || 50);
    if (o.type) q = q.eq('annotation_type', o.type);
    const { data, error } = await q;
    if (error) {
      if (/relation|does not exist/i.test(String(error.message || ''))) {
        return { ok: true, annotations: [], available: false, schemaPending: true };
      }
      throw new Error(error.message);
    }
    return { ok: true, annotations: data || [], available: true };
  } catch (e) {
    throw e;
  }
}

module.exports = {
  recordAnnotation: recordAnnotation,
  listAnnotations: listAnnotations
};
