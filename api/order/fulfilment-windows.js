'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, getOrderSystemForSite } = require('../../lib/order/auth');
const {
  listAllWindowsAdmin,
  listWindows,
  createWindow,
  updateWindow,
  deleteWindow,
  savePickupSchedule,
  parsePickupSchedule,
  buildPickupSlots
} = require('../../lib/order/fulfilment-windows');
const { toDateStr } = require('../../lib/order/pickup-schedule');

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });

    const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
    const q = req.query || {};
    const siteId = q.site_id || body.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });

    let system = await getOrderSystemForSite(siteId);
    if (!system) return json(res, 404, { error: 'no_system' });

    if (req.method === 'GET') {
      const windows = await listAllWindowsAdmin(system.id);
      const schedule = parsePickupSchedule(system);
      var payload = { windows: windows, schedule: schedule };
      if (q.preview === '1') {
        const active = await listWindows(system.id);
        const today = toDateStr(new Date());
        payload.slot_preview = buildPickupSlots(active, today, 60, schedule);
      }
      return json(res, 200, payload);
    }

    if (req.method === 'POST' && body.action === 'save_schedule') {
      const result = await savePickupSchedule(system, {
        range_start: body.range_start,
        range_end: body.range_end,
        default_window_start: body.default_window_start,
        default_window_end: body.default_window_end,
        closed_weekdays: body.closed_weekdays,
        closed_dates: body.closed_dates
      });
      system = result.system;
      const schedule = result.schedule;
      const active = await listWindows(system.id);
      const today = toDateStr(new Date());
      return json(res, 200, {
        ok: true,
        schedule: schedule,
        slot_preview: buildPickupSlots(active, today, 60, schedule)
      });
    }

    if (req.method === 'POST') {
      const row = await createWindow(system, siteId, body);
      return json(res, 200, { window: row });
    }

    if (req.method === 'PATCH') {
      const id = body.id || body.window_id;
      if (!id) return json(res, 400, { error: 'window_id_required' });
      const row = await updateWindow(system.id, id, body);
      return json(res, 200, { window: row });
    }

    if (req.method === 'DELETE') {
      const id = q.id || q.window_id || body.id || body.window_id;
      if (!id) return json(res, 400, { error: 'window_id_required' });
      await deleteWindow(system.id, id);
      return json(res, 200, { ok: true });
    }
  } catch (e) {
    console.error('order/fulfilment-windows', e);
    const code = e && e.code === 400 ? 400 : 500;
    return json(res, code, { error: String((e && e.message) || e) });
  }
};
