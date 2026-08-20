'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, getOrderSystemForSite } = require('../../lib/order/auth');
const {
  listAllWindowsAdmin,
  createWindow,
  updateWindow,
  deleteWindow
} = require('../../lib/order/fulfilment-windows');

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

    const system = await getOrderSystemForSite(siteId);
    if (!system) return json(res, 404, { error: 'no_system' });

    if (req.method === 'GET') {
      const windows = await listAllWindowsAdmin(system.id);
      return json(res, 200, { windows: windows });
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
