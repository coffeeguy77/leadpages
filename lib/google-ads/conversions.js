const { adsFetch, digits, ensureAccessToken, resolveLoginCustomerId } = require('./client');

const DEFAULT_ACTIONS = [
  { key: 'form_submission', name: 'LeadPages — Form Submission', category: 'SUBMIT_LEAD_FORM' },
  { key: 'call_click', name: 'LeadPages — Call Click', category: 'CONTACT' },
  { key: 'email_click', name: 'LeadPages — Email Click', category: 'CONTACT' },
  { key: 'directions_click', name: 'LeadPages — Directions Click', category: 'GET_DIRECTIONS' }
];

async function listConversionActions(accessToken, customerId, loginCustomerId) {
  const { searchStream } = require('./client');
  const rows = await searchStream(
    accessToken,
    customerId,
    `SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.type
     FROM conversion_action WHERE conversion_action.status != 'REMOVED'`,
    loginCustomerId
  );
  return rows.map((r) => {
    const c = r.conversionAction || r.conversion_action || {};
    return {
      id: String(c.id || ''),
      name: c.name || '',
      status: c.status || '',
      resourceName: c.resourceName || c.resource_name || (`customers/${digits(customerId)}/conversionActions/${c.id}`)
    };
  });
}

async function ensureConversionActions(admin, conn) {
  const access = await ensureAccessToken(admin, conn);
  const login = resolveLoginCustomerId(conn);
  const existing = await listConversionActions(access, conn.customer_id, login);
  const byName = {};
  existing.forEach((a) => { byName[a.name.toLowerCase()] = a; });

  const map = Object.assign({}, conn.conversion_actions || {});
  const creates = [];

  for (let i = 0; i < DEFAULT_ACTIONS.length; i++) {
    const def = DEFAULT_ACTIONS[i];
    if (map[def.key] && map[def.key].resourceName) continue;
    const found = byName[def.name.toLowerCase()];
    if (found) {
      map[def.key] = { name: found.name, id: found.id, resourceName: found.resourceName };
      continue;
    }
    creates.push(def);
  }

  if (creates.length) {
    const cid = digits(conn.customer_id);
    const operations = creates.map((def) => ({
      create: {
        name: def.name,
        type: 'UPLOAD_CLICKS',
        category: def.category,
        status: 'ENABLED',
        viewThroughLookbackWindowDays: 1,
        clickThroughLookbackWindowDays: 90
      }
    }));
    const res = await adsFetch(`customers/${cid}/conversionActions:mutate`, {
      method: 'POST',
      accessToken: access,
      loginCustomerId: resolveLoginCustomerId(conn),
      body: { operations }
    });
    const results = res.results || [];
    results.forEach((r, idx) => {
      const def = creates[idx];
      const rn = r.resourceName || r.resource_name;
      const id = rn ? rn.split('/').pop() : '';
      map[def.key] = { name: def.name, id, resourceName: rn };
    });
  }

  if (admin && conn.site_id) {
    await admin.from('google_ads_connections').update({
      conversion_actions: map,
      updated_at: new Date().toISOString()
    }).eq('site_id', conn.site_id);
  }
  conn.conversion_actions = map;
  return map;
}

/**
 * Upload a click conversion. Returns { status, response?, error? }.
 * Never throws to callers who wrap it.
 */
async function uploadClickConversion(admin, conn, {
  eventKey, gclid, gbraid, wbraid, occurredAt, conversionValue
}) {
  const roles = conn.event_roles || {};
  const role = roles[eventKey] || (eventKey === 'form_submission' || eventKey === 'call_click' ? 'primary' : 'off');
  if (role === 'off') return { status: 'skipped', reason: 'role_off' };

  const action = (conn.conversion_actions || {})[eventKey];
  if (!action || !action.resourceName) {
    return { status: 'failed', error: 'missing_conversion_action' };
  }
  if (!gclid && !gbraid && !wbraid) {
    return { status: 'skipped', reason: 'no_click_id' };
  }

  try {
    const access = await ensureAccessToken(admin, conn);
    const cid = digits(conn.customer_id);
    const conversion = {
      conversionAction: action.resourceName,
      conversionDateTime: formatAdsDateTime(occurredAt || new Date())
    };
    if (gclid) conversion.gclid = gclid;
    else if (gbraid) conversion.gbraid = gbraid;
    else if (wbraid) conversion.wbraid = wbraid;
    if (conversionValue != null) {
      conversion.conversionValue = Number(conversionValue) || 0;
      conversion.currencyCode = 'AUD';
    }

    const res = await adsFetch(`customers/${cid}:uploadClickConversions`, {
      method: 'POST',
      accessToken: access,
      loginCustomerId: resolveLoginCustomerId(conn),
      body: {
        conversions: [conversion],
        partialFailure: true
      }
    });
    const partial = res.partialFailureError || res.partial_failure_error;
    if (partial) {
      return { status: 'failed', error: partial.message || 'partial_failure', response: res };
    }
    return { status: 'success', response: res };
  } catch (e) {
    return { status: 'failed', error: (e && e.message) || 'upload_failed', response: e && e.details };
  }
}

function formatAdsDateTime(d) {
  const dt = d instanceof Date ? d : new Date(d);
  // Google Ads expects "yyyy-mm-dd hh:mm:ss+hh:mm" — use UTC offset +00:00 for simplicity
  const pad = (n) => String(n).padStart(2, '0');
  return (
    dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate()) +
    ' ' + pad(dt.getUTCHours()) + ':' + pad(dt.getUTCMinutes()) + ':' + pad(dt.getUTCSeconds()) + '+00:00'
  );
}

async function recordDelivery(admin, row) {
  if (!admin) return null;
  try {
    const ins = await admin.from('ads_conversion_deliveries').insert(row).select('id').maybeSingle();
    return ins.data;
  } catch (e) {
    console.error('recordDelivery:', e && e.message);
    return null;
  }
}

/**
 * After internal success: enqueue + attempt Google conversion upload.
 */
async function deliverConversion(admin, {
  siteId, eventKey, internalEvent, leadId, attr, occurredAt
}) {
  if (!admin || !siteId) return { status: 'skipped', reason: 'no_site' };
  const { data: conn } = await admin
    .from('google_ads_connections')
    .select('*')
    .eq('site_id', siteId)
    .eq('enabled', true)
    .maybeSingle();
  if (!conn) return { status: 'skipped', reason: 'not_connected' };

  const base = {
    site_id: siteId,
    event_name: eventKey,
    internal_event: internalEvent || null,
    lead_id: leadId || null,
    session_id: (attr && attr.session_id) || null,
    visitor_id: (attr && attr.visitor_id) || null,
    gclid: (attr && attr.gclid) || null,
    gbraid: (attr && attr.gbraid) || null,
    wbraid: (attr && attr.wbraid) || null,
    occurred_at: occurredAt || new Date().toISOString(),
    status: 'pending'
  };

  const result = await uploadClickConversion(admin, conn, {
    eventKey,
    gclid: base.gclid,
    gbraid: base.gbraid,
    wbraid: base.wbraid,
    occurredAt: base.occurred_at
  });

  const action = (conn.conversion_actions || {})[eventKey];
  await recordDelivery(admin, Object.assign({}, base, {
    conversion_action: action && action.resourceName,
    status: result.status,
    google_response: result.response || null,
    error_message: result.error || result.reason || null,
    delivered_at: result.status === 'success' ? new Date().toISOString() : null
  }));

  return result;
}

module.exports = {
  DEFAULT_ACTIONS,
  listConversionActions,
  ensureConversionActions,
  uploadClickConversion,
  deliverConversion,
  recordDelivery,
  formatAdsDateTime
};
