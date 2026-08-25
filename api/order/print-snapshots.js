'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const {
  SNAPSHOT_FORMATS,
  isSnapshotFormat,
  recordPrintSnapshot,
  statusForFormats
} = require('../../lib/order/print-snapshots');

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'POST'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });

    const body = req.method === 'POST' ? await readBody(req) : {};
    const siteId = (req.query && req.query.site_id) || body.site_id;
    const pickupDate = (req.query && req.query.pickup_date) || body.pickup_date;
    if (!siteId) return json(res, 400, { error: 'site_id_required' });
    if (!pickupDate) return json(res, 400, { error: 'pickup_date_required' });

    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    const system = await ensureOrderSystem(siteId);
    const actor = { user_id: user.id, label: user.email || null };

    if (req.method === 'GET') {
      var formatsParam = (req.query && req.query.formats) || '';
      var formats = String(formatsParam)
        .split(',')
        .map(function (s) {
          return s.trim();
        })
        .filter(isSnapshotFormat);
      if (!formats.length) formats = SNAPSHOT_FORMATS.slice();
      const status = await statusForFormats({
        system: system,
        site_id: siteId,
        pickup_date: pickupDate,
        formats: formats
      });
      return json(res, 200, status);
    }

    const action = body.action || 'record';
    if (action === 'status') {
      var list = Array.isArray(body.formats) ? body.formats : SNAPSHOT_FORMATS;
      const status = await statusForFormats({
        system: system,
        site_id: siteId,
        pickup_date: pickupDate,
        formats: list
      });
      return json(res, 200, status);
    }

    if (action === 'record') {
      if (!body.format || !isSnapshotFormat(body.format)) {
        return json(res, 400, { error: 'format_required', allowed: SNAPSHOT_FORMATS });
      }
      try {
        const out = await recordPrintSnapshot({
          system: system,
          site_id: siteId,
          pickup_date: pickupDate,
          format: body.format,
          actor: actor
        });
        return json(res, 200, out);
      } catch (e) {
        if (/order_print_snapshots|relation|does not exist/i.test(String(e && e.message))) {
          return json(res, 503, {
            error: 'migration_required',
            message: 'Apply db/migrations/20260825_order_print_snapshots.sql'
          });
        }
        throw e;
      }
    }

    return json(res, 400, { error: 'unknown_action' });
  } catch (e) {
    console.error('order/print-snapshots', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
