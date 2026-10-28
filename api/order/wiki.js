'use strict';

/**
 * Staff wiki (Settings → Help & Wiki): GET ?site_id=… → { sections, pages:[{slug,title,section,order,summary,body}] }
 * Staff only (same access as the rest of the order admin). Content: docs/order-wiki/*.md
 */

const { json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess } = require('../../lib/order/auth');
const { SECTIONS, loadPages } = require('../../lib/order/wiki');

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const access = await assertSiteAccess(user, req.query && req.query.site_id);
    if (!access.ok) return json(res, access.code, { error: access.error });
    res.setHeader('Cache-Control', 'private, max-age=300');
    return json(res, 200, { sections: SECTIONS, pages: loadPages() });
  } catch (e) {
    console.error('order/wiki', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
