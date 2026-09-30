/**
 * Online Quote System — EventureOS connector.
 *
 * Sends a finished online quote to an EventureOS account (POST /api/public/quote-intake), which
 * creates or matches the customer and builds an enquiry, event and draft quote with the same lines.
 *
 * Server-only settings (Vercel environment variables — never sites.config, which is public):
 *   EVENTUREOS_INTAKE_KEY      connection key from EventureOS → Settings → Integrations → Quote intake
 *   EVENTUREOS_INTAKE_SITE_ID  the LeadPages site id(s) allowed to send, comma-separated
 *   EVENTUREOS_INTAKE_URL      optional; defaults to the EventureOS production endpoint
 *
 * Off unless both the key and a matching site id are set. Failures are logged and never thrown,
 * so a problem on the EventureOS side can never break a customer's quote.
 */

const DEFAULT_URL = 'https://www.eventureos.com.au/api/public/quote-intake';
const TIMEOUT_MS = 6000;

const SECTION_BY_KIND = {
  equipment: 'Equipment',
  labour: 'Staff',
  beverage: 'Beverages',
  addon: 'Add-ons',
  travel: 'Travel'
};

function settingsFor(siteId) {
  const key = String(process.env.EVENTUREOS_INTAKE_KEY || '').trim();
  const sites = String(process.env.EVENTUREOS_INTAKE_SITE_ID || '')
    .split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  if (!key || !siteId || sites.indexOf(String(siteId)) === -1) return null;
  const url = String(process.env.EVENTUREOS_INTAKE_URL || '').trim() || DEFAULT_URL;
  return { key: key, url: url };
}

function str(v, n) {
  const s = v == null ? '' : String(v).trim();
  return s ? s.slice(0, n || 200) : null;
}

/** Build the EventureOS payload (contract v1) from a stored quote version. Pure — easy to test. */
function buildIntakePayload(opts) {
  const session = opts.session || {};
  const version = opts.version || {};
  const inputs = version.inputs || {};
  const progress = session.progress || {};
  const breakdown = Array.isArray(version.breakdown) ? version.breakdown : [];
  const subtotalCents = Number(version.subtotal_cents) || 0;
  const gstCents = Number(version.gst_cents) || 0;
  // GST is all-or-nothing in the calculator (business.gstRegistered), so read it from the result
  const taxRate = subtotalCents > 0 && gstCents === 0 ? 0 : 10;
  const firstShift = Array.isArray(inputs.shifts) && inputs.shifts.length ? inputs.shifts[0] : {};
  const guests = Number(inputs.guestCount);

  const items = breakdown
    .filter(function(row) { return row && row.label && Number(row.quantity) > 0; })
    .map(function(row) {
      return {
        section: SECTION_BY_KIND[row.kind] || 'Online quote',
        name: str(row.label, 200),
        description: null,
        quantity: Number(row.quantity),
        unit: row.kind === 'labour' ? 'hours' : null,
        unit_price: Math.round(Number(row.unitCents) || 0) / 100,
        tax_rate: taxRate
      };
    });

  return {
    external_id: String(session.id),
    external_version: Number(version.version_number) || 1,
    stage: opts.stage === 'accepted' ? 'accepted' : 'submitted',
    source_label: 'LeadPages',
    customer: {
      name: str(session.contact_name, 200),
      email: str(session.contact_email, 254),
      phone: str(session.contact_phone, 40),
      company: null
    },
    event: {
      name: null,
      type: null,
      date: str(progress.eventDate || inputs.eventDate || firstShift.date, 32),
      start_time: str(firstShift.startTime, 20),
      end_time: str(firstShift.endTime, 20),
      guests: Number.isFinite(guests) && guests > 0 ? Math.round(guests) : null,
      venue: null,
      address: null
    },
    items: items,
    totals: {
      subtotal: subtotalCents / 100,
      gst: gstCents / 100,
      total: (Number(version.total_cents) || 0) / 100
    },
    notes: null,
    valid_until: null,
    portal_url: str(opts.portalUrl, 1000),
    accepted_by: opts.stage === 'accepted' ? str(opts.acceptedBy, 120) : null
  };
}

/**
 * Send one quote version to EventureOS if this site is connected. Never throws.
 * Returns { sent: false, reason } when switched off, or the EventureOS reply.
 */
async function sendQuoteToEventureOS(opts) {
  try {
    const cfg = settingsFor(opts && opts.siteId);
    if (!cfg) return { sent: false, reason: 'not_configured' };
    const payload = buildIntakePayload(opts);
    if (!payload.customer.name && !payload.customer.email) return { sent: false, reason: 'no_contact' };

    const ctrl = new AbortController();
    const timer = setTimeout(function() { ctrl.abort(); }, TIMEOUT_MS);
    try {
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      const body = await res.json().catch(function() { return {}; });
      if (!res.ok || !body.ok) {
        console.error('eventureos intake failed:', res.status, body && body.error);
        return { sent: false, reason: 'http_' + res.status, error: body && body.error };
      }
      return { sent: true, outcome: body.outcome, quoteNumber: body.quote_number };
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    console.error('eventureos intake error:', e && e.message);
    return { sent: false, reason: 'error' };
  }
}

module.exports = { buildIntakePayload, sendQuoteToEventureOS, settingsFor };
