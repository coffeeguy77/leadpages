'use strict';

const { getAdmin } = require('./supabase');
const {
  parsePickupSchedule,
  mergePickupScheduleSettings
} = require('./pickup-schedule');
const {
  buildPickupSlots,
  findMatchingSlot,
  formatWindowLabel,
  formatTimeLabel
} = require('./pickup-slots');

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

async function savePickupSchedule(system, patch) {
  const admin = getAdmin();
  const settings = mergePickupScheduleSettings((system && system.settings) || {}, patch || {});
  const { data, error } = await admin
    .from('order_systems')
    .update({ settings: settings, updated_at: new Date().toISOString() })
    .eq('id', system.id)
    .select('*')
    .single();
  if (error) throw error;
  return { system: data, schedule: parsePickupSchedule(data) };
}

module.exports = {
  listWindows,
  listAllWindowsAdmin,
  buildPickupSlots,
  createWindow,
  updateWindow,
  deleteWindow,
  savePickupSchedule,
  parsePickupSchedule,
  formatWindowLabel,
  formatTimeLabel,
  findMatchingSlot,
  normaliseTimeDb
};
