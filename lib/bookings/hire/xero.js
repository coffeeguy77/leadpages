'use strict';

/**
 * Xero Accounting API integration for Bookings hire invoices.
 * Leadpages remains booking authority; Xero is accounting authority for synced docs.
 */

const { encryptSecret, decryptSecret, encryptionConfigured } = require('./tokens');

const XERO_AUTH = 'https://login.xero.com/identity/connect/authorize';
const XERO_TOKEN = 'https://identity.xero.com/connect/token';
const XERO_API = 'https://api.xero.com/api.xro/2.0';
const XERO_CONNECTIONS = 'https://api.xero.com/connections';

const DEFAULT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'accounting.transactions',
  'accounting.contacts',
  'accounting.settings.read'
].join(' ');

function clientConfig() {
  return {
    clientId: process.env.XERO_CLIENT_ID || '',
    clientSecret: process.env.XERO_CLIENT_SECRET || '',
    redirectUri:
      process.env.XERO_BOOKINGS_REDIRECT_URI ||
      process.env.XERO_REDIRECT_URI ||
      ((process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.leadpages.com.au').replace(/\/$/, '') +
        '/api/bookings/xero/callback')
  };
}

function buildAuthUrl(state) {
  const cfg = clientConfig();
  if (!cfg.clientId) {
    const err = new Error('xero_oauth_not_configured');
    err.code = 'not_configured';
    throw err;
  }
  const u = new URL(XERO_AUTH);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', cfg.clientId);
  u.searchParams.set('redirect_uri', cfg.redirectUri);
  u.searchParams.set('scope', DEFAULT_SCOPES);
  u.searchParams.set('state', state);
  return u.toString();
}

function basicAuthHeader() {
  const cfg = clientConfig();
  return 'Basic ' + Buffer.from(cfg.clientId + ':' + cfg.clientSecret).toString('base64');
}

async function exchangeCode(code) {
  const cfg = clientConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: cfg.redirectUri
  });
  const res = await fetch(XERO_TOKEN, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || 'xero_token_exchange_failed');
    err.details = json;
    throw err;
  }
  return json;
}

async function refreshAccessToken(connection) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: decryptSecret(connection.refresh_token_enc)
  });
  const res = await fetch(XERO_TOKEN, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || 'xero_refresh_failed');
    err.details = json;
    throw err;
  }
  return json;
}

async function getValidAccessToken(admin, connection) {
  const expires = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0;
  if (connection.access_token_enc && expires > Date.now() + 60000) {
    return decryptSecret(connection.access_token_enc);
  }
  const refreshed = await refreshAccessToken(connection);
  const patch = {
    access_token_enc: encryptSecret(refreshed.access_token),
    access_token_expires_at: new Date(Date.now() + (refreshed.expires_in || 1800) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    last_error: '',
    sync_health: 'healthy'
  };
  if (refreshed.refresh_token) {
    patch.refresh_token_enc = encryptSecret(refreshed.refresh_token);
  }
  await admin.from('booking_xero_connections').update(patch).eq('id', connection.id);
  Object.assign(connection, patch);
  return refreshed.access_token;
}

async function listTenants(accessToken) {
  const res = await fetch(XERO_CONNECTIONS, {
    headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' }
  });
  const json = await res.json();
  if (!res.ok) throw new Error('xero_connections_failed');
  return json;
}

async function xeroRequest(accessToken, tenantId, method, path, body) {
  const res = await fetch(XERO_API + path, {
    method: method,
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Xero-Tenant-Id': tenantId,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(function () {
    return {};
  });
  return { ok: res.ok, status: res.status, data: json };
}

function centsToXero(cents) {
  return Math.round(Number(cents) || 0) / 100;
}

async function findOrCreateContact(admin, connection, system, customer) {
  const access = await getValidAccessToken(admin, connection);
  const { data: link } = await admin
    .from('booking_xero_contact_links')
    .select('*')
    .eq('customer_id', customer.id)
    .maybeSingle();
  if (link && link.xero_contact_id) {
    return { ok: true, contactId: link.xero_contact_id, reused: true };
  }

  const where = [];
  if (customer.email) where.push('EmailAddress!=null&&EmailAddress="' + String(customer.email).replace(/"/g, '') + '"');
  let matches = [];
  if (where.length) {
    const q = await xeroRequest(
      access,
      connection.tenant_id,
      'GET',
      '/Contacts?where=' + encodeURIComponent(where[0])
    );
    matches = (q.data && q.data.Contacts) || [];
  }
  if (matches.length > 1 && connection.contact_conflict_mode === 'ask') {
    return { ok: false, error: 'ambiguous_contact', matches: matches };
  }
  if (matches.length === 1) {
    await admin.from('booking_xero_contact_links').insert({
      booking_system_id: system.id,
      site_id: system.site_id,
      customer_id: customer.id,
      xero_contact_id: matches[0].ContactID,
      last_synced_at: new Date().toISOString(),
      sync_status: 'synced'
    });
    return { ok: true, contactId: matches[0].ContactID, reused: true };
  }

  const created = await xeroRequest(access, connection.tenant_id, 'POST', '/Contacts', {
    Contacts: [
      {
        Name: customer.name || customer.email || 'Customer',
        EmailAddress: customer.email || undefined,
        Phones: customer.phone
          ? [{ PhoneType: 'MOBILE', PhoneNumber: customer.phone }]
          : undefined
      }
    ]
  });
  if (!created.ok) return { ok: false, error: 'contact_create_failed', details: created.data };
  const contactId = created.data.Contacts[0].ContactID;
  await admin.from('booking_xero_contact_links').insert({
    booking_system_id: system.id,
    site_id: system.site_id,
    customer_id: customer.id,
    xero_contact_id: contactId,
    last_synced_at: new Date().toISOString(),
    sync_status: 'synced'
  });
  return { ok: true, contactId: contactId, reused: false };
}

function buildInvoiceLines(quote, connection) {
  const lines = [];
  (quote.line_items || []).forEach(function (li) {
    if (li.is_bond) {
      if (!connection.bond_account_code) return;
      lines.push({
        Description: li.description,
        Quantity: li.quantity || 1,
        UnitAmount: centsToXero(li.unit_price_cents),
        AccountCode: connection.bond_account_code,
        TaxType: 'NONE'
      });
      return;
    }
    lines.push({
      Description: li.description,
      Quantity: li.quantity || 1,
      UnitAmount: centsToXero(li.unit_price_cents),
      AccountCode: connection.revenue_account_code || '200',
      TaxType: connection.tax_type || 'OUTPUT'
    });
  });
  return lines;
}

async function createInvoiceForBooking(admin, connection, system, booking, customer, quote, opts) {
  opts = opts || {};
  const idempotencyKey = opts.idempotencyKey || 'booking-invoice:' + booking.id;
  const { data: existing } = await admin
    .from('booking_xero_invoices')
    .select('*')
    .eq('booking_system_id', system.id)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existing && existing.xero_invoice_id) {
    return { ok: true, invoice: existing, reused: true };
  }

  const contact = await findOrCreateContact(admin, connection, system, customer);
  if (!contact.ok) return contact;

  const access = await getValidAccessToken(admin, connection);
  const dueDays = Number(connection.invoice_due_days) || 7;
  const due = new Date();
  due.setDate(due.getDate() + dueDays);
  const status = connection.default_invoice_status || 'AUTHORISED';

  const payload = {
    Invoices: [
      {
        Type: 'ACCREC',
        Contact: { ContactID: contact.contactId },
        LineItems: buildInvoiceLines(quote, connection),
        Date: new Date().toISOString().slice(0, 10),
        DueDate: due.toISOString().slice(0, 10),
        Reference: booking.reference || booking.id,
        Status: status,
        LineAmountTypes: 'Inclusive',
        BrandingThemeID: connection.branding_theme_id || undefined
      }
    ]
  };

  const created = await xeroRequest(access, connection.tenant_id, 'POST', '/Invoices', payload);
  if (!created.ok) {
    await admin
      .from('booking_xero_connections')
      .update({
        last_error: 'invoice_create_failed',
        sync_health: 'error',
        last_attempted_sync_at: new Date().toISOString()
      })
      .eq('id', connection.id);
    return { ok: false, error: 'invoice_create_failed', details: created.data };
  }

  const inv = created.data.Invoices[0];
  let onlineUrl = null;
  try {
    const online = await xeroRequest(
      access,
      connection.tenant_id,
      'GET',
      '/Invoices/' + inv.InvoiceID + '/OnlineInvoice'
    );
    if (online.ok && online.data && online.data.OnlineInvoices && online.data.OnlineInvoices[0]) {
      onlineUrl = online.data.OnlineInvoices[0].OnlineInvoiceUrl;
    }
  } catch (_e) {}

  const row = {
    booking_id: booking.id,
    booking_system_id: system.id,
    site_id: system.site_id,
    xero_tenant_id: connection.tenant_id,
    xero_contact_id: contact.contactId,
    xero_invoice_id: inv.InvoiceID,
    invoice_number: inv.InvoiceNumber || '',
    invoice_status: inv.Status || status,
    amount_due_cents: Math.round(Number(inv.AmountDue || 0) * 100),
    amount_paid_cents: Math.round(Number(inv.AmountPaid || 0) * 100),
    due_date: inv.DueDate || due.toISOString().slice(0, 10),
    online_invoice_url: onlineUrl,
    idempotency_key: idempotencyKey,
    line_items_json: quote.line_items || [],
    last_synced_at: new Date().toISOString(),
    sync_error: '',
    updated_at: new Date().toISOString()
  };

  const { data: saved, error } = await admin
    .from('booking_xero_invoices')
    .upsert(row, { onConflict: 'booking_system_id,idempotency_key' })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };

  await admin
    .from('booking_hire_details')
    .update({
      xero_invoice_id: inv.InvoiceID,
      xero_invoice_number: inv.InvoiceNumber || '',
      xero_invoice_status: inv.Status || status,
      xero_online_invoice_url: onlineUrl,
      updated_at: new Date().toISOString()
    })
    .eq('booking_id', booking.id);

  if ((connection.auto_send || connection.auto_email) && opts.send !== false) {
    await xeroRequest(access, connection.tenant_id, 'POST', '/Invoices/' + inv.InvoiceID + '/Email', {});
  }

  return { ok: true, invoice: saved || row, xero: inv, onlineUrl: onlineUrl };
}

async function syncPaymentToXero(admin, connection, system, booking, payment, xeroInvoice) {
  const idempotencyKey = 'booking-payment:' + payment.id;
  const { data: existing } = await admin
    .from('booking_xero_payments')
    .select('*')
    .eq('booking_system_id', system.id)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existing) return { ok: true, payment: existing, reused: true };

  const access = await getValidAccessToken(admin, connection);
  const payload = {
    Payments: [
      {
        Invoice: { InvoiceID: xeroInvoice.xero_invoice_id },
        Account: { Code: connection.payment_account_code || '090' },
        Date: new Date().toISOString().slice(0, 10),
        Amount: centsToXero(payment.amount_cents)
      }
    ]
  };
  const created = await xeroRequest(access, connection.tenant_id, 'POST', '/Payments', payload);
  if (!created.ok) return { ok: false, error: 'payment_sync_failed', details: created.data };
  const xp = created.data.Payments[0];
  const row = {
    booking_system_id: system.id,
    site_id: system.site_id,
    booking_id: booking.id,
    booking_payment_id: payment.id,
    xero_invoice_id: xeroInvoice.xero_invoice_id,
    xero_payment_id: xp.PaymentID,
    amount_cents: payment.amount_cents,
    idempotency_key: idempotencyKey,
    last_synced_at: new Date().toISOString()
  };
  await admin.from('booking_xero_payments').insert(row);
  return { ok: true, payment: row, xero: xp };
}

function connectionPublicView(conn) {
  if (!conn) return null;
  return {
    id: conn.id,
    tenant_id: conn.tenant_id,
    tenant_name: conn.tenant_name,
    revenue_account_code: conn.revenue_account_code,
    deposit_account_code: conn.deposit_account_code,
    bond_account_code: conn.bond_account_code,
    cancellation_account_code: conn.cancellation_account_code,
    cleaning_account_code: conn.cleaning_account_code,
    payment_account_code: conn.payment_account_code,
    tax_type: conn.tax_type,
    default_invoice_status: conn.default_invoice_status,
    branding_theme_id: conn.branding_theme_id,
    invoice_due_days: conn.invoice_due_days,
    auto_create_on: conn.auto_create_on,
    auto_send: !!(conn.auto_send || conn.auto_email),
    auto_email: !!(conn.auto_send || conn.auto_email),
    attach_agreement: conn.attach_agreement,
    contact_conflict_mode: conn.contact_conflict_mode,
    last_successful_sync_at: conn.last_successful_sync_at,
    last_attempted_sync_at: conn.last_attempted_sync_at,
    last_error: conn.last_error,
    sync_health: conn.sync_health,
    connected_at: conn.connected_at,
    encryption_ready: encryptionConfigured()
  };
}

module.exports = {
  DEFAULT_SCOPES,
  clientConfig,
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getValidAccessToken,
  listTenants,
  xeroRequest,
  findOrCreateContact,
  buildInvoiceLines,
  createInvoiceForBooking,
  syncPaymentToXero,
  connectionPublicView,
  centsToXero
};
