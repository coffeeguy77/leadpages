// api/consent-form.js — receives an online consent / new-patient form from a tenant sub-page
// (page.consentForm, see lib/consent-form.js), builds a signed PDF and emails it to the
// practice. NOTHING is stored: no database row, no file — the email is the record, and the
// person gets the same PDF back to keep.
//
// Payload: { slug, siteId?, page, answers:{k:v}, read:{i:true}, initials:{i:"AB"},
//            signedName, agree:true, signature:"data:image/png;base64,…", hp, startedAt }
// Reply:   { ok:true, sent:bool, pdf:"<base64>", filename } or { ok:false, errors:[…] }

const { createClient } = require('@supabase/supabase-js');
const { limited } = require('./_rate-limit');
const CF = require('../lib/consent-form');

const FROM = process.env.LEADS_FROM || 'LeadPages <noreply@leadpages.com.au>';
const MAX_BODY = 900 * 1024;

let supabase = null;
function db() {
  if (!supabase) supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return supabase;
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch (e) { return resolve(null); } }
      return resolve(req.body);
    }
    let raw = '', size = 0;
    req.on('data', (c) => { size += c.length; if (size <= MAX_BODY) raw += c; });
    req.on('end', () => { if (size > MAX_BODY) return resolve(null); try { resolve(raw ? JSON.parse(raw) : null); } catch (e) { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function siteFor(body) {
  const cols = 'id, slug, business_name, owner_email, config, status';
  const slug = CF.clean(body.slug, 80);
  const id = CF.clean(body.siteId, 60);
  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    const r = await db().from('sites').select(cols).eq('id', id).maybeSingle();
    if (r.data) return r.data;
  }
  if (slug) {
    const r = await db().from('sites').select(cols).eq('slug', slug).maybeSingle();
    if (r.data) return r.data;
  }
  return null;
}

async function emailPdf({ to, business, form, name, replyTo, pdf, filename }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return { sent: false, reason: !key ? 'no_key' : 'no_recipient' };
  const title = CF.clean(form.title, 120) || 'Consent form';
  const text = title + ' from ' + name + '.\n\nThe signed form is attached as a PDF. It was sent from your website and has not been stored anywhere else.';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: replyTo || undefined,
        subject: title + ' — ' + name,
        text,
        html: '<p style="font-family:Arial,sans-serif;font-size:15px;color:#0A2248"><strong>' + title.replace(/[<>&]/g, '') + '</strong> from ' + name.replace(/[<>&]/g, '') + '.</p>' +
          '<p style="font-family:Arial,sans-serif;font-size:14px;color:#4A5668">The signed form is attached as a PDF. It was sent from your website (' + String(business || '').replace(/[<>&]/g, '') + ') and has not been stored anywhere else.</p>',
        attachments: [{ filename, content: pdf.toString('base64') }]
      })
    });
    if (!r.ok) return { sent: false, reason: 'resend_' + r.status };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: 'fetch_error' };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' });
  if (limited(req, { key: 'consent-form', max: 6, windowMs: 10 * 60000 })) return send(res, 429, { ok: false, error: 'busy' });

  const body = await readBody(req);
  if (!body || typeof body !== 'object') return send(res, 400, { ok: false, error: 'bad_request' });

  // Bots: hidden field filled in, or the form sent within seconds of opening it.
  const started = Number(body.startedAt) || 0;
  if (CF.clean(body.hp, 200) || (started && Date.now() - started < 4000)) return send(res, 200, { ok: true, sent: true });

  let site;
  try { site = await siteFor(body); } catch (e) { site = null; }
  if (!site || site.status === 'deleted') return send(res, 404, { ok: false, error: 'site' });
  const cfg = site.config || {};
  const pageSlug = CF.clean(body.page, 120);
  const page = (Array.isArray(cfg.pages) ? cfg.pages : []).find((p) => p && p.slug === pageSlug && p.status !== 'draft');
  const form = CF.formOf(page);
  if (!form) return send(res, 404, { ok: false, error: 'form' });

  const v = CF.validate(form, body);
  if (!v.ok) return send(res, 422, { ok: false, errors: v.errors });

  const business = CF.clean(cfg.businessName || site.business_name, 120);
  const when = new Date();
  let pdf;
  try { pdf = await CF.buildPdf({ business, form, data: v.data, when }); } catch (e) { return send(res, 500, { ok: false, error: 'pdf' }); }

  const safe = v.data.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'form';
  const filename = (CF.clean(form.fileName, 60) || 'new-patient-form').replace(/[^\w-]/g, '') + '-' + safe + '-' + CF.isoDay(when) + '.pdf';
  // Recipient comes only from the saved site config, never from the request.
  const to = CF.isEmail(form.recipient) ? CF.clean(form.recipient, 200) : (CF.isEmail(cfg.email) ? CF.clean(cfg.email, 200) : CF.clean(site.owner_email, 200));
  const emailField = v.data.fields.find((f) => f.type === 'email');
  const replyTo = emailField && CF.isEmail(v.data.values[emailField.k]) ? v.data.values[emailField.k] : '';
  const mail = await emailPdf({ to, business, form, name: v.data.name, replyTo, pdf, filename });

  return send(res, 200, { ok: true, sent: mail.sent === true, pdf: pdf.toString('base64'), filename });
};
