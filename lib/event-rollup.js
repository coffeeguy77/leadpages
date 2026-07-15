/**
 * Pure helpers for rolling raw analytics events into daily rows.
 */

const DEFAULT_KEEP_DAYS = 90;
const ALLOWED = ['page_view', 'call_click', 'lead_submit', 'quote_open', 'cta_click'];

function keepDays() {
  const n = parseInt(process.env.EVENTS_RAW_KEEP_DAYS || '', 10);
  return !isNaN(n) && n >= 14 ? n : DEFAULT_KEEP_DAYS;
}

/** UTC calendar day string YYYY-MM-DD */
function dayKey(isoOrDate) {
  if (!isoOrDate) return '';
  if (typeof isoOrDate === 'string') return isoOrDate.slice(0, 10);
  return new Date(isoOrDate).toISOString().slice(0, 10);
}

/** Exclusive end of retention: raw events with created_at < this ISO are candidates. */
function retentionCutoffIso(nowMs, days) {
  const d = days == null ? keepDays() : days;
  const ms = (nowMs == null ? Date.now() : nowMs) - d * 86400000;
  // Align to UTC midnight so we only roll complete days
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth();
  const day = dt.getUTCDate();
  return new Date(Date.UTC(y, m, day)).toISOString();
}

/**
 * Aggregate raw event rows into daily rollup keys.
 * @param {Array<{site_id?: string, event?: string, created_at?: string, props?: object}>} rows
 * @returns {Map<string, {site_id: string, day: string, event: string, count: number, locations: Record<string,number>|null}>}
 */
function aggregateRawEvents(rows) {
  const map = new Map();
  (rows || []).forEach(function (r) {
    if (!r || !r.site_id) return;
    const event = String(r.event || '');
    if (ALLOWED.indexOf(event) < 0) return;
    const day = dayKey(r.created_at);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    const key = r.site_id + '|' + day + '|' + event;
    let row = map.get(key);
    if (!row) {
      row = { site_id: r.site_id, day: day, event: event, count: 0, locations: null };
      map.set(key, row);
    }
    row.count += 1;
    if (event === 'call_click') {
      const loc = (r.props && r.props.location) ? String(r.props.location).slice(0, 40) : 'other';
      if (!row.locations) row.locations = {};
      row.locations[loc] = (row.locations[loc] || 0) + 1;
    }
  });
  return map;
}

/**
 * Expand daily rollup rows into stats-shaped events the dashboard can count.
 * Uses `count` so clients can sum without inventing N duplicate rows.
 */
function dailyToStatsEvents(dailyRows) {
  return (dailyRows || []).map(function (d) {
    const props = d.locations ? { locations: d.locations } : null;
    return {
      event: d.event,
      site_id: d.site_id,
      created_at: String(d.day).slice(0, 10) + 'T12:00:00.000Z',
      count: Math.max(0, parseInt(d.count, 10) || 0),
      props: props,
      rolled: true
    };
  });
}

function eventWeight(e) {
  if (!e) return 0;
  const n = parseInt(e.count, 10);
  return !isNaN(n) && n > 0 ? n : 1;
}

/** Sum counts by event name (page_view / call_click / lead_submit). */
function sumEventCounts(rows) {
  const c = { page_view: 0, call_click: 0, lead_submit: 0 };
  (rows || []).forEach(function (e) {
    if (e && c[e.event] != null) c[e.event] += eventWeight(e);
  });
  return c;
}

module.exports = {
  ALLOWED,
  DEFAULT_KEEP_DAYS,
  keepDays,
  dayKey,
  retentionCutoffIso,
  aggregateRawEvents,
  dailyToStatsEvents,
  eventWeight,
  sumEventCounts
};
