'use strict';

const { json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { previewImport, commitImport, parseCsv, PRESET_BUTCHER_LINE_ITEMS } = require('../../lib/order/import');

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'POST'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });

    if (req.method === 'GET') {
      return json(res, 200, {
        presets: [PRESET_BUTCHER_LINE_ITEMS],
        kinds: [
          { id: 'customers', label: 'Customers (create or update by phone)' },
          { id: 'products', label: 'Products' },
          { id: 'order_history', label: 'Order history (line items → customers + orders)' }
        ]
      });
    }

    const body = req.body || {};
    const siteId = body.site_id || (req.query && req.query.site_id);
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    const system = await ensureOrderSystem(siteId);

    const action = body.action || 'preview';
    const kind = body.kind || 'order_history';
    if (['customers', 'products', 'order_history'].indexOf(kind) < 0) {
      return json(res, 400, { error: 'bad_kind' });
    }

    let rows = Array.isArray(body.rows) ? body.rows : null;
    if (!rows && body.csv_text) rows = parseCsv(body.csv_text);
    if (!rows || !rows.length) return json(res, 400, { error: 'no_rows' });

    if (body.preset === 'butcher_line_items') {
      body.mapping = Object.assign({}, PRESET_BUTCHER_LINE_ITEMS.mapping);
      body.has_header = false;
      body.kind = 'order_history';
    }

    if (action === 'preview') {
      const preview = previewImport({
        kind: body.kind || kind,
        rows: rows,
        has_header: !!body.has_header,
        mapping: body.mapping || {}
      });
      return json(res, 200, { ok: true, preview: preview });
    }

    if (action === 'commit') {
      if (!body.mapping || !Object.keys(body.mapping).length) {
        return json(res, 400, { error: 'mapping_required' });
      }
      const stats = await commitImport({
        kind: kind,
        system: system,
        site: access.site,
        rows: rows,
        has_header: !!body.has_header,
        mapping: body.mapping,
        create_missing_products: body.create_missing_products !== false,
        filename: body.filename || null,
        actor_id: user.id
      });
      return json(res, 200, { ok: true, stats: stats });
    }

    return json(res, 400, { error: 'bad_action' });
  } catch (e) {
    console.error('order/import', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
