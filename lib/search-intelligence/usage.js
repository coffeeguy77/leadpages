'use strict';

/**
 * Shared provider usage meter → si_provider_usage.
 */

async function meterUsage(admin, siteId, meter, units, meta) {
  if (!admin || !siteId || !meter) return { ok: false, skipped: 'missing' };
  try {
    const { error } = await admin.from('si_provider_usage').insert({
      site_id: siteId,
      meter: String(meter),
      units: Math.max(1, Number(units) || 1),
      provider: (meta && meta.provider) || null,
      meta: meta || {}
    });
    if (error) {
      if (/relation|does not exist/i.test(String(error.message || ''))) {
        return { ok: false, skipped: 'schema_pending' };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

async function usageSummary(admin, siteId, opts) {
  const o = opts || {};
  const days = Math.max(1, Math.min(90, o.days || 30));
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const empty = { ok: true, siteId: siteId, days: days, byMeter: {}, totalUnits: 0, available: false };
  if (!admin || !siteId) return empty;
  try {
    const { data, error } = await admin
      .from('si_provider_usage')
      .select('meter,units,provider,created_at')
      .eq('site_id', siteId)
      .gte('created_at', since.toISOString())
      .limit(5000);
    if (error) return empty;
    const byMeter = {};
    let total = 0;
    (data || []).forEach(function (r) {
      const m = r.meter || 'unknown';
      byMeter[m] = (byMeter[m] || 0) + Number(r.units || 0);
      total += Number(r.units || 0);
    });
    return {
      ok: true,
      siteId: siteId,
      days: days,
      byMeter: byMeter,
      totalUnits: total,
      available: true,
      labelClass: 'measured'
    };
  } catch (_e) {
    return empty;
  }
}

module.exports = {
  meterUsage: meterUsage,
  usageSummary: usageSummary
};
