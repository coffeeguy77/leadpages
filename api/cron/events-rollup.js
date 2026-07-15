// api/cron/events-rollup.js — roll raw `events` older than retention into `event_daily`, then delete.
// Schedule via vercel.json. Secured with CRON_SECRET (same as billing cron).
// Processes complete UTC days so upserts are absolute (no double-count across batches).

const { createClient } = require('@supabase/supabase-js');
const {
  keepDays,
  retentionCutoffIso,
  aggregateRawEvents,
  dayKey
} = require('../../lib/event-rollup');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let key = auth;
  try {
    if (!key) key = new URL(req.url, 'http://x').searchParams.get('key') || '';
  } catch (e) { /* ignore */ }
  return key === secret;
}

function dayRange(day) {
  const start = day + 'T00:00:00.000Z';
  const d = new Date(start);
  const end = new Date(d.getTime() + 86400000).toISOString();
  return { start: start, end: end };
}

async function oldestEligibleDay(beforeIso) {
  const { data, error } = await admin
    .from('events')
    .select('created_at')
    .lt('created_at', beforeIso)
    .not('site_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  if (!data || !data.length) return null;
  return dayKey(data[0].created_at);
}

async function fetchDayEvents(day) {
  const { start, end } = dayRange(day);
  const out = [];
  const page = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from('events')
      .select('id,site_id,event,created_at,props')
      .gte('created_at', start)
      .lt('created_at', end)
      .not('site_id', 'is', null)
      .order('created_at', { ascending: true })
      .range(from, from + page - 1);
    if (error) throw error;
    const rows = data || [];
    out.push.apply(out, rows);
    if (rows.length < page) break;
    from += page;
    if (out.length > 200000) break; // safety
  }
  return out;
}

async function upsertDaily(rows) {
  if (!rows.length) return 0;
  const payload = rows.map(function (r) {
    return {
      site_id: r.site_id,
      day: r.day,
      event: r.event,
      count: r.count,
      locations: r.locations,
      updated_at: new Date().toISOString()
    };
  });
  const { error } = await admin.from('event_daily').upsert(payload, {
    onConflict: 'site_id,day,event'
  });
  if (error) throw error;
  return payload.length;
}

async function deleteDay(day) {
  const { start, end } = dayRange(day);
  const { error, count } = await admin
    .from('events')
    .delete({ count: 'exact' })
    .gte('created_at', start)
    .lt('created_at', end)
    .not('site_id', 'is', null);
  if (error) throw error;
  return count != null ? count : 0;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'method' });
  }
  if (!authorized(req)) return json(res, 401, { error: 'unauthorized' });

  const keep = keepDays();
  const cutoff = retentionCutoffIso(Date.now(), keep);
  const cutoffDay = dayKey(cutoff);
  const maxDays = Math.min(60, Math.max(1, parseInt(process.env.EVENTS_ROLLUP_MAX_DAYS || '14', 10) || 14));

  let daysDone = [];
  let upserted = 0;
  let deleted = 0;

  try {
    const probe = await admin.from('event_daily').select('site_id').limit(1);
    if (probe.error) {
      return json(res, 200, {
        ok: false,
        skipped: 'event_daily_missing',
        message: 'Apply db/event_daily.sql in Supabase, then re-run cron.',
        error: probe.error.message,
        keepDays: keep,
        cutoff
      });
    }

    for (let i = 0; i < maxDays; i++) {
      const day = await oldestEligibleDay(cutoff);
      if (!day || day >= cutoffDay) break;

      const rows = await fetchDayEvents(day);
      const map = aggregateRawEvents(rows);
      upserted += await upsertDaily(Array.from(map.values()));
      deleted += await deleteDay(day);
      daysDone.push(day);
    }

    return json(res, 200, {
      ok: true,
      keepDays: keep,
      cutoff,
      days: daysDone,
      upserted,
      deleted
    });
  } catch (e) {
    console.error('events-rollup:', e && e.message);
    return json(res, 500, {
      error: String(e && e.message || e),
      days: daysDone,
      upserted,
      deleted
    });
  }
};
