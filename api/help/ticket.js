// POST /api/help/ticket — customer paid-help / human-assist request.
// Auth required. Emails ops (Resend) when configured, persists to help_tickets when table exists,
// and returns ok so the client can also open Support chat.

const crypto = require('crypto');

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function clean(s, n) {
  return String(s == null ? '' : s).trim().slice(0, n || 2000);
}

async function getUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (_e) {
    return null;
  }
}

function adminClient() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function sendEmail(payload, user) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { emailed: false, reason: 'no_resend' };
  const to = (process.env.HELP_TICKET_TO || process.env.SUPER_ADMIN_EMAILS || '')
    .split(/[,;\s]+/)
    .map(function (x) { return x.trim(); })
    .filter(Boolean);
  if (!to.length) return { emailed: false, reason: 'no_recipients' };
  const from = process.env.RESEND_FROM || 'LeadPages Help <noreply@leadpages.com.au>';
  const subject = '[Help] ' + (payload.urgency === 'urgent' ? 'URGENT · ' : '') + (payload.topicTitle || 'Paid help request');
  const text = [
    'Paid help request from Manage Help Centre',
    '',
    'From: ' + (user.email || user.id),
    'User id: ' + user.id,
    'Site: ' + (payload.siteName || '—') + (payload.siteId ? ' (' + payload.siteId + ')' : ''),
    'Topic: ' + (payload.topicTitle || payload.topicId || '—'),
    'Urgency: ' + (payload.urgency || 'normal'),
    'Path: ' + (payload.path || '—'),
    '',
    payload.message || ''
  ].join('\n');
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ from: from, to: to, subject: subject, text: text })
    });
    if (!r.ok) {
      const t = await r.text().catch(function () { return ''; });
      return { emailed: false, reason: 'resend_' + r.status, detail: t.slice(0, 200) };
    }
    return { emailed: true };
  } catch (e) {
    return { emailed: false, reason: String(e.message || e) };
  }
}

module.exports = async function (req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const user = await getUser(req);
  if (!user || !user.id) return json(res, 401, { ok: false, error: 'Sign in to request help.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_e) { body = {}; }
  }
  body = body || {};

  const payload = {
    topicId: clean(body.topicId, 80),
    topicTitle: clean(body.topicTitle, 160),
    urgency: ['normal', 'soon', 'urgent'].indexOf(body.urgency) >= 0 ? body.urgency : 'normal',
    message: clean(body.message, 4000),
    siteId: clean(body.siteId, 80) || null,
    siteName: clean(body.siteName, 160),
    path: clean(body.path, 300)
  };
  if (!payload.message) return json(res, 400, { ok: false, error: 'Message required.' });

  const ticketId = crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
  let stored = false;
  try {
    const sb = adminClient();
    const row = {
      id: ticketId,
      user_id: user.id,
      user_email: user.email || null,
      site_id: payload.siteId,
      topic_id: payload.topicId || null,
      topic_title: payload.topicTitle || null,
      urgency: payload.urgency,
      message: payload.message,
      path: payload.path || null,
      status: 'open',
      created_at: new Date().toISOString()
    };
    const ins = await sb.from('help_tickets').insert(row);
    if (!ins.error) stored = true;
  } catch (_e) {
    stored = false;
  }

  const mail = await sendEmail(payload, user);

  return json(res, 200, {
    ok: true,
    ticketId: ticketId,
    stored: stored,
    emailed: !!mail.emailed,
    openSupport: true,
    message: 'Request received. Opening Support so you can keep chatting with us.'
  });
};
