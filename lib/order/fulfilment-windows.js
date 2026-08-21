'use strict';

const { getAdmin } = require('./supabase');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateStr(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function parseTime(t) {
  if (!t) return null;
  const s = String(t).slice(0, 8);
  const parts = s.split(':');
  if (parts.length < 2) return null;
  return { h: Number(parts[0]), m: Number(parts[1]) || 0, s: Number(parts[2]) || 0 };
}

function formatTimeLabel(t) {
  const p = parseTime(t);
  if (!p) return String(t || '');
  var h = p.h;
  var suffix = h >= 12 ? 'pm' : 'am';
  var h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return p.m ? h12 + ':' + pad2(p.m) + suffix : h12 + suffix;
}

function formatWindowLabel(start, end) {
  return formatTimeLabel(start) + '–' + formatTimeLabel(end);
}

function normaliseTimeDb(t) {
  if (!t) return null;
  const s = String(t).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s + ':00';
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return s;
}

async function listWindows(systemId) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('order_fulfilment_windows')
    .select('*')
    .eq('order_system_id', systemId)
    .eq('active', true)
    .order('weekday', { ascending: true, nullsFirst: false })
    .order('specific_date', { ascending: true, nullsFirst: false })
    .order('window_start');
  if (error) throw error;
  return data || [];
}

async function listAllWindowsAdmin(systemId) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('order_fulfilment_windows')
    .select('*')
    .eq('order_system_id', systemId)
    .order('active', { ascending: false })
    .order('weekday', { ascending: true, nullsFirst: false })
    .order('specific_date', { ascending: true, nullsFirst: false })
    .order('window_start');
  if (error) throw error;
  return data || [];
}

/**
 * Build bookable pickup slots from fulfilment windows for the next `days` days
 * starting at earliestDate (YYYY-MM-DD).
 */
function buildPickupSlots(windows, earliestDate, days) {
  const wins = (windows || []).filter(function (w) {
    return w && w.active !== false;
  });
  if (!wins.length || !earliestDate) return [];

  const start = new Date(earliestDate + 'T12:00:00');
  if (Number.isNaN(start.getTime())) return [];
  const horizon = Math.max(1, Math.min(Number(days) || 28, 60));
  const out = [];

  for (var i = 0; i < horizon; i++) {
    const d = new Date(start.getTime());
    d.setDate(start.getDate() + i);
    const dateStr = toDateStr(d);
    const weekday = d.getDay(); // 0 Sun … 6 Sat

    wins.forEach(function (w) {
      var match = false;
      if (w.specific_date) {
        match = String(w.specific_date).slice(0, 10) === dateStr;
      } else if (w.weekday != null && w.weekday !== '') {
        match = Number(w.weekday) === weekday;
      }
      if (!match) return;
      const startT = String(w.window_start).slice(0, 8);
      const endT = String(w.window_end).slice(0, 8);
      out.push({
        id: w.id + ':' + dateStr,
        window_id: w.id,
        date: dateStr,
        window_start: startT,
        window_end: endT,
        label: dateStr + ' · ' + formatWindowLabel(startT, endT),
        capacity: w.capacity != null ? Number(w.capacity) : null
      });
    });
  }
  return out;
}

async function createWindow(system, siteId, body) {
  const admin = getAdmin();
  const row = {
    order_system_id: system.id,
    site_id: siteId,
    weekday: body.specific_date != null && body.specific_date !== '' ? null : body.weekday != null ? Number(body.weekday) : null,
    specific_date: body.specific_date || null,
    window_start: normaliseTimeDb(body.window_start),
    window_end: normaliseTimeDb(body.window_end),
    capacity: body.capacity != null && body.capacity !== '' ? Number(body.capacity) : null,
    active: body.active !== false
  };
  if (!row.window_start || !row.window_end) {
    throw Object.assign(new Error('window_times_required'), { code: 400 });
  }
  if (row.weekday == null && !row.specific_date) {
    throw Object.assign(new Error('weekday_or_date_required'), { code: 400 });
  }
  const { data, error } = await admin.from('order_fulfilment_windows').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

async function updateWindow(systemId, windowId, body) {
  const admin = getAdmin();
  const patch = { };
  if (body.window_start !== undefined) patch.window_start = normaliseTimeDb(body.window_start);
  if (body.window_end !== undefined) patch.window_end = normaliseTimeDb(body.window_end);
  if (body.capacity !== undefined) patch.capacity = body.capacity === '' || body.capacity == null ? null : Number(body.capacity);
  if (body.active !== undefined) patch.active = !!body.active;
  if (body.weekday !== undefined) patch.weekday = body.weekday === '' || body.weekday == null ? null : Number(body.weekday);
  if (body.specific_date !== undefined) patch.specific_date = body.specific_date || null;
  const { data, error } = await admin
    .from('order_fulfilment_windows')
    .update(patch)
    .eq('id', windowId)
    .eq('order_system_id', systemId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function deleteWindow(systemId, windowId) {
  const admin = getAdmin();
  const { error } = await admin
    .from('order_fulfilment_windows')
    .delete()
    .eq('id', windowId)
    .eq('order_system_id', systemId);
  if (error) throw error;
  return true;
}

function findMatchingSlot(slots, pickupDate, windowStart, windowEnd) {
  return (slots || []).find(function (s) {
    return (
      s.date === pickupDate &&
      String(s.window_start).slice(0, 5) === String(windowStart || '').slice(0, 5) &&
      String(s.window_end).slice(0, 5) === String(windowEnd || '').slice(0, 5)
    );
  });
}

module.exports = {
  listWindows,
  listAllWindowsAdmin,
  buildPickupSlots,
  createWindow,
  updateWindow,
  deleteWindow,
  formatWindowLabel,
  formatTimeLabel,
  findMatchingSlot,
  normaliseTimeDb
};
