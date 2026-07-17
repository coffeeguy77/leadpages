// POST /api/google-ads/test — { siteId, type: 'form'|'call' }
const { createClient } = require('@supabase/supabase-js');
const { ensureConversionActions, uploadClickConversion, recordDelivery } = require('../../lib/google-ads/conversions');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
      return resolve(req.body);
    }
    let raw = ''; req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function authUser(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(obj));
  };
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!authUser(req)) return json(401, { error: 'auth' });

  try {
    const body = await readBody(req);
    const siteId = String(body.siteId || '').trim();
    const type = String(body.type || 'form').toLowerCase();
    if (!siteId) return json(400, { error: 'missing_siteId' });

    const { data: conn } = await admin.from('google_ads_connections').select('*').eq('site_id', siteId).maybeSingle();
    if (!conn || !conn.customer_id) return json(400, { error: 'select_account_first' });

    await ensureConversionActions(admin, conn);
    const { data: fresh } = await admin.from('google_ads_connections').select('*').eq('site_id', siteId).maybeSingle();

    const eventKey = type === 'call' ? 'call_click' : 'form_submission';
    // Test without a real gclid — expect skipped/no_click_id unless tester supplies one
    const gclid = body.gclid ? String(body.gclid).trim() : null;
    const result = await uploadClickConversion(admin, fresh, {
      eventKey,
      gclid,
      occurredAt: new Date()
    });

    await recordDelivery(admin, {
      site_id: siteId,
      event_name: eventKey,
      internal_event: 'test',
      gclid,
      status: result.status === 'skipped' && result.reason === 'no_click_id' ? 'success' : result.status,
      error_message: result.error || result.reason || null,
      google_response: Object.assign({ test: true }, result.response || {}),
      occurred_at: new Date().toISOString(),
      delivered_at: new Date().toISOString()
    });

    const patch = { updated_at: new Date().toISOString() };
    if (type === 'call') patch.call_test_at = new Date().toISOString();
    else patch.form_test_at = new Date().toISOString();
    await admin.from('google_ads_connections').update(patch).eq('site_id', siteId);

    return json(200, {
      ok: true,
      result,
      note: gclid
        ? 'Test conversion uploaded with provided gclid.'
        : 'Conversion action verified. Supply a real gclid to upload a live test conversion.'
    });
  } catch (e) {
    return json(500, { error: (e && e.message) || 'test_failed' });
  }
};
