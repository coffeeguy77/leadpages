'use strict';

/**
 * Order Engine messaging — template render + email (Resend) + SMS (Twilio Messages).
 * Provider logic stays here; event orchestration uses notify.js.
 */

const { getAdmin } = require('./supabase');

function renderTemplate(body, vars) {
  let out = String(body || '');
  const map = vars || {};
  Object.keys(map).forEach(function (k) {
    const re = new RegExp('\\{\\{\\s*' + k + '\\s*\\}\\}', 'g');
    out = out.replace(re, map[k] == null ? '' : String(map[k]));
  });
  return out;
}

async function sendEmail({ to, subject, text, html }) {
  if (!process.env.RESEND_API_KEY || !to) return { ok: false, skipped: true, reason: 'email_not_configured' };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.LEADS_FROM || 'LeadPages <noreply@leadpages.com.au>',
      to: [to],
      subject: subject || 'Order update',
      text: text || '',
      html: html || undefined
    })
  });
  let j = null;
  try {
    j = await r.json();
  } catch (_e) {
    j = null;
  }
  return { ok: r.ok, status: r.status, id: j && (j.id || j.data && j.data.id), raw: j };
}

async function sendSms({ to, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from =
    process.env.TWILIO_FROM_NUMBER ||
    process.env.TWILIO_FROM ||
    process.env.TWILIO_SMS_FROM;
  if (!sid || !token || !from || !to) {
    return { ok: false, skipped: true, reason: 'sms_not_configured' };
  }
  const phone = String(to).replace(/\s+/g, '');
  const auth = Buffer.from(sid + ':' + token).toString('base64');
  const params = new URLSearchParams();
  params.set('To', phone);
  params.set('From', from);
  params.set('Body', String(body || '').slice(0, 1500));
  const r = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + auth,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });
  let j = null;
  try {
    j = await r.json();
  } catch (_e) {
    j = null;
  }
  return { ok: r.ok, status: r.status, id: j && j.sid, raw: j };
}

function twilioOtpConfigured() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return false;
  if (process.env.TWILIO_VERIFY_SERVICE_SID) return true;
  if (
    process.env.TWILIO_FROM_NUMBER ||
    process.env.TWILIO_FROM ||
    process.env.TWILIO_SMS_FROM
  ) {
    return true;
  }
  return false;
}

/**
 * Prefer Twilio Verify (same as Quote Builder) when TWILIO_VERIFY_SERVICE_SID is set.
 * Otherwise send a custom body via Messages API (needs TWILIO_FROM_NUMBER).
 */
async function sendPortalOtpSms({ to, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid || !token) {
    return { ok: false, skipped: true, reason: 'sms_not_configured', provider: null };
  }
  if (serviceSid) {
    try {
      const { sendSmsCode } = require('../quote-system/verify');
      const sms = await sendSmsCode(to);
      if (sms && sms.sent) {
        return { ok: true, provider: 'twilio_verify', id: null };
      }
      return {
        ok: false,
        skipped: false,
        reason: (sms && sms.reason) || 'sms_failed',
        provider: 'twilio_verify',
        raw: sms
      };
    } catch (e) {
      return { ok: false, skipped: false, reason: String((e && e.message) || e), provider: 'twilio_verify' };
    }
  }
  const sent = await sendSms({ to: to, body: body });
  return Object.assign({ provider: 'twilio_messages' }, sent);
}

async function checkPortalOtpSms({ to, code }) {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!serviceSid) return { ok: false, reason: 'not_verify' };
  try {
    const { checkSmsCode } = require('../quote-system/verify');
    return await checkSmsCode(to, code);
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e) };
  }
}

async function loadTemplate(systemId, category, channel) {
  const admin = getAdmin();
  let q = admin
    .from('order_message_templates')
    .select('*')
    .eq('order_system_id', systemId)
    .eq('category', category)
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(5);
  const { data } = await q;
  const rows = data || [];
  if (channel) {
    const hit = rows.find(function (r) {
      return r.channel === channel || r.channel === 'both';
    });
    if (hit) return hit;
  }
  return rows[0] || null;
}

async function queueAndSend(opts) {
  const admin = getAdmin();
  const { recordSmsUsage } = require('./sms-usage');
  const { estimateSegments, normalizeSmsKind } = require('./sms-kind');
  const channel = opts.channel === 'sms' ? 'sms' : 'email';
  const body = opts.body || '';
  const subject = opts.subject || null;
  const row = {
    order_system_id: opts.order_system_id,
    site_id: opts.site_id,
    order_id: opts.order_id || null,
    cart_id: opts.cart_id || null,
    customer_id: opts.customer_id || null,
    channel: channel,
    event_type: opts.event_type || 'custom',
    destination: opts.destination,
    subject: subject,
    body: body,
    status: 'queued',
    meta: opts.template_id ? { template_id: opts.template_id } : {}
  };
  const { data: msg, error } = await admin.from('order_messages').insert(row).select('*').single();
  if (error) throw error;

  let result = { ok: false };
  if (channel === 'email') {
    result = await sendEmail({ to: opts.destination, subject: subject || 'Order update', text: body });
  } else {
    result = await sendSms({ to: opts.destination, body: body });
  }

  const patch = {
    status: result.skipped ? 'queued' : result.ok ? 'sent' : 'failed',
    provider_id: result.id || null,
    sent_at: result.ok ? new Date().toISOString() : null,
    meta: Object.assign({}, row.meta || {}, {
      send: result.skipped ? { skipped: result.reason } : { ok: result.ok, status: result.status }
    })
  };
  await admin.from('order_messages').update(patch).eq('id', msg.id);

  if (channel === 'sms' && opts.order_system_id && opts.site_id) {
    await recordSmsUsage({
      order_system_id: opts.order_system_id,
      site_id: opts.site_id,
      customer_id: opts.customer_id || null,
      order_id: opts.order_id || null,
      message_id: msg.id,
      kind: normalizeSmsKind(opts.sms_kind || opts.event_type || 'transactional'),
      destination: opts.destination,
      segments: estimateSegments(body),
      body: body,
      provider_id: result.id || null,
      status: result.skipped ? 'skipped' : result.ok ? 'sent' : 'failed',
      billable: !result.skipped && !!result.ok,
      meta: { event_type: opts.event_type || 'custom' }
    });
  }

  return Object.assign({}, msg, patch, { send: result });
}

module.exports = {
  renderTemplate,
  sendEmail,
  sendSms,
  twilioOtpConfigured,
  sendPortalOtpSms,
  checkPortalOtpSms,
  loadTemplate,
  queueAndSend
};
