'use strict';
/**
 * Online consent / new-patient form (Nov 2026, first used by Pam Connor & Associates).
 *
 * The form lives on a sub-page: page.blocks === true with a ":::consent" block, and
 * page.consentForm = {
 *   on: true,
 *   recipient: 'name@practice.com',        // where the signed PDF is emailed (read server-side only)
 *   title, intro,                          // shown above the form
 *   documents: [{ title, body, initial }], // text the person reads; initial: true asks for initials
 *   fields: [{ k, label, type, req, ph, opts, showIf, full }],
 *     // type: text | email | tel | date | textarea | radio (opts: ['A','B']) | check (a tick-box,
 *     //       req = must be ticked) | heading (a sub-heading, no answer)
 *     // showIf: { k: 'referralSource', v: 'Doctor' } — only asked when that answer matches
 *     //         (v may be a list); a hidden question is never required and never sent.
 *   declaration,                           // "I, {name}, have read and understood …"
 *   successText
 * }
 *
 * Nothing is stored: the API checks the answers, builds a signed PDF and emails it.
 * The person's own device keeps their progress (localStorage) until they send it.
 */
const PDFDocument = require('pdfkit');

const FIELD_TYPES = { text: 1, email: 1, tel: 1, date: 1, textarea: 1, radio: 1, check: 1, heading: 1 };
const MAX_SIG_BYTES = 400 * 1024;

const clean = (s, n = 400) => (s == null ? '' : String(s)).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || ''));

/** The form config from a page, or null when the page has no live form. */
function formOf(page) {
  const f = page && page.consentForm;
  if (!f || f.on === false || page.blocks !== true || !/:::\s*consent\b/.test(String(page.body || ''))) return null;
  return f;
}

function fieldsOf(form) {
  return (Array.isArray(form.fields) ? form.fields : [])
    .filter((f) => f && clean(f.k, 40) && f.on !== false)
    .map((f) => {
      const type = FIELD_TYPES[f.type] ? f.type : 'text';
      const out = { k: clean(f.k, 40).replace(/[^\w-]/g, ''), label: clean(f.label, type === 'check' ? 400 : 120) || clean(f.k, 40), type, req: type !== 'heading' && f.req === true };
      if (type === 'radio') out.opts = (Array.isArray(f.opts) ? f.opts : []).map((o) => clean(o, 80)).filter(Boolean).slice(0, 12);
      const si = f.showIf;
      if (si && typeof si === 'object' && clean(si.k, 40)) out.showIf = { k: clean(si.k, 40).replace(/[^\w-]/g, ''), v: (Array.isArray(si.v) ? si.v : [si.v]).map((x) => clean(x, 80)) };
      return out;
    });
}
/** Is this question asked, given the other answers? */
function shown(f, answers) {
  if (!f.showIf) return true;
  const got = clean(answers && answers[f.showIf.k], 80);
  return f.showIf.v.indexOf(got) >= 0;
}
function docsOf(form) {
  return (Array.isArray(form.documents) ? form.documents : [])
    .filter((d) => d && (clean(d.title, 120) || clean(d.body, 20)))
    .map((d, i) => ({ i, title: clean(d.title, 120) || 'Document ' + (i + 1), body: String(d.body || '').slice(0, 40000), initial: d.initial === true }));
}

/**
 * Check a submission against the form. Returns { ok, errors[], data } where data holds the
 * cleaned answers ready for the PDF.
 */
function validate(form, body) {
  const errors = [];
  const answers = (body && typeof body.answers === 'object' && body.answers) || {};
  const fields = fieldsOf(form);
  const docs = docsOf(form);
  const values = {};
  fields.forEach((f) => {
    if (f.type === 'heading') return;
    if (!shown(f, answers)) { values[f.k] = ''; return; }
    if (f.type === 'check') {
      const on = answers[f.k] === true || answers[f.k] === 'yes';
      if (f.req && !on) errors.push(f.k);
      values[f.k] = on ? 'yes' : '';
      return;
    }
    let v = clean(answers[f.k], f.type === 'textarea' ? 600 : 160);
    if (f.type === 'radio' && v && f.opts.length && f.opts.indexOf(v) < 0) { errors.push(f.k); values[f.k] = ''; return; }
    if (f.req && !v) errors.push(f.k);
    else if (v && f.type === 'email' && !isEmail(v)) errors.push(f.k);
    else if (v && f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors.push(f.k);
    values[f.k] = v;
  });
  const read = (body && body.read) || {};
  const initials = (body && body.initials) || {};
  const docOut = docs.map((d) => {
    const ok = read[d.i] === true || read[String(d.i)] === true;
    if (!ok) errors.push('read:' + d.i);
    const ini = clean(initials[d.i] != null ? initials[d.i] : initials[String(d.i)], 8);
    if (d.initial && !ini) errors.push('initials:' + d.i);
    return { title: d.title, body: d.body, initial: d.initial, initials: ini, read: ok };
  });
  const name = clean(body && body.signedName, 120);
  if (!name) errors.push('signedName');
  const agree = body && body.agree === true;
  if (!agree) errors.push('agree');
  const sig = String((body && body.signature) || '');
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(sig);
  let sigBuf = null;
  if (m) { try { sigBuf = Buffer.from(m[1], 'base64'); } catch (e) { sigBuf = null; } }
  if (!sigBuf || sigBuf.length < 200 || sigBuf.length > MAX_SIG_BYTES || sigBuf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') errors.push('signature');
  const asked = fields.filter((f) => f.type === 'heading' || shown(f, answers));
  return { ok: errors.length === 0, errors, data: { fields: asked, values, docs: docOut, name, signature: sigBuf } };
}

/** "2026-11-05" in Australian eastern time. */
function isoDay(d) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); } catch (e) { return d.toISOString().slice(0, 10); }
}
/** "Thursday 5 November 2026, 9:14 am" in Australian eastern time. */
function stamp(d) {
  try {
    return new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
  } catch (e) { return d.toISOString(); }
}
function prettyDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return Number(m[3]) + ' ' + months[Number(m[2]) - 1] + ' ' + m[1];
}
/** Markdown-ish text → plain paragraphs for the PDF (keeps bullets, drops ** and links). */
function plainText(md) {
  return String(md || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/^\s*\|?\s*:?-{2,}.*$/gm, '')
    .replace(/^\s*\|(.*)\|\s*$/gm, (_, r) => r.split('|').map((c) => c.trim()).join(' — '));
}

/**
 * Where to get the logo for the PDF: form.pdfLogo, else the site logo when it is a PNG/JPEG
 * (the PDF can't draw SVG). Only our own hosts or Cloudinary, so a config can't make the
 * server fetch anything else. Paths starting with / are on www.leadpages.com.au.
 */
function logoUrlOf(form, cfg) {
  const lg = cfg && cfg.logo;
  const site = lg && typeof lg === 'object' ? lg.imageUrl : (typeof lg === 'string' ? lg : '');
  const cands = [form && form.pdfLogo, site];
  for (let i = 0; i < cands.length; i++) {
    let u = clean(cands[i], 500);
    if (!u) continue;
    if (/^\/[^/]/.test(u)) u = 'https://www.leadpages.com.au' + u;
    let p; try { p = new URL(u); } catch (e) { continue; }
    if (p.protocol !== 'https:') continue;
    if (!/(^|\.)leadpages\.com\.au$|^res\.cloudinary\.com$/i.test(p.hostname)) continue;
    if (!/\.(png|jpe?g)$/i.test(p.pathname) && p.hostname !== 'res.cloudinary.com') continue;
    if (p.hostname === 'res.cloudinary.com' && /\.svg$/i.test(p.pathname)) continue;
    return p.toString();
  }
  return '';
}
/** PNG or JPEG bytes? */
function isRaster(buf) {
  if (!buf || buf.length < 8) return false;
  return buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a' || (buf[0] === 0xff && buf[1] === 0xd8);
}

/** Build the signed PDF. Resolves to a Buffer. */
function buildPdf({ business, form, data, when, logo }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: clean(form.title, 120) || 'Consent form', Author: business || '' } });
    const out = [];
    doc.on('data', (c) => out.push(c));
    doc.on('end', () => resolve(Buffer.concat(out)));
    doc.on('error', reject);
    const NAVY = '#0A2248', BLUE = '#0B5DA8', GREY = '#4A5668';
    const W = doc.page.width - 100;

    // The practice logo at the top when there is one (PNG/JPEG); otherwise the business name.
    let drewLogo = false;
    if (logo) {
      try { const y0 = doc.y; doc.image(logo, 50, y0, { fit: [240, 72] }); doc.y = y0 + 80; drewLogo = true; } catch (e) { drewLogo = false; }
    }
    if (!drewLogo) doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(18).text(business || '', { width: W });
    doc.x = 50;
    doc.moveDown(0.2).fillColor(BLUE).font('Helvetica').fontSize(13).text(clean(form.title, 120) || 'Consent form');
    doc.moveDown(0.3).fillColor(GREY).fontSize(9.5).text('Submitted online ' + stamp(when || new Date()));
    doc.moveDown(0.6).strokeColor('#DBE5F1').lineWidth(1).moveTo(50, doc.y).lineTo(50 + W, doc.y).stroke();

    const section = (t) => { doc.moveDown(0.9).fillColor(NAVY).font('Helvetica-Bold').fontSize(12.5).text(t); doc.moveDown(0.3); };
    const row = (label, value) => {
      // Row height = the taller of label and answer, so long questions never overlap the next row.
      const v = value || '—';
      const hL = doc.font('Helvetica').fontSize(10).heightOfString(String(label), { width: 150 });
      const hV = doc.font('Helvetica-Bold').fontSize(10.5).heightOfString(String(v), { width: W - 160 });
      const h = Math.max(hL, hV);
      if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const y = doc.y;
      doc.fillColor(GREY).font('Helvetica').fontSize(10).text(label, 50, y, { width: 150 });
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10.5).text(v, 210, y, { width: W - 160 });
      doc.y = y + h;
      doc.moveDown(0.35);
      doc.x = 50;
    };

    section('Details');
    const fl = data.fields;
    fl.forEach((f, i) => {
      if (f.type === 'heading') {
        // A sub-heading only when something follows it (before the next heading).
        let j = i + 1; while (j < fl.length && fl[j].type !== 'heading') j++;
        if (j > i + 1) { doc.moveDown(0.4).fillColor(BLUE).font('Helvetica-Bold').fontSize(11).text(f.label, 50, doc.y, { width: W }); doc.moveDown(0.25); doc.x = 50; }
        return;
      }
      if (f.type === 'check') {
        // Long statement: full width, then the answer underneath.
        doc.fillColor(GREY).font('Helvetica').fontSize(10).text(f.label, 50, doc.y, { width: W });
        doc.moveDown(0.2).fillColor(NAVY).font('Helvetica-Bold').fontSize(10.5).text(data.values[f.k] ? 'Yes — ticked (agreed)' : 'Not ticked', 50, doc.y, { width: W });
        doc.moveDown(0.35); doc.x = 50;
        return;
      }
      row(f.label, f.type === 'date' ? prettyDate(data.values[f.k]) : data.values[f.k]);
    });

    section('Documents read');
    data.docs.forEach((d) => row(d.title, 'Read and understood' + (d.initial ? ' — initialled: ' + (d.initials || '') : '')));

    // Keep the declaration, name, date and signature together on one page.
    if (doc.y + 260 > doc.page.height - doc.page.margins.bottom) doc.addPage();
    section('Declaration');
    const decl = clean(form.declaration, 800) || 'I have read and understood the documents above.';
    doc.fillColor(NAVY).font('Helvetica').fontSize(10.5).text(decl.replace(/\{name\}/g, data.name), { width: W });
    doc.moveDown(0.6);
    row('Full name', data.name);
    row('Date', prettyDate(isoDay(when || new Date())));
    doc.fillColor(GREY).font('Helvetica').fontSize(10).text('Signature', 50, doc.y);
    doc.moveDown(0.2);
    try {
      const y0 = doc.y;
      doc.image(data.signature, 50, y0, { fit: [260, 90] });
      doc.y = y0 + 96;
    } catch (e) {
      doc.text('(signature could not be shown)');
    }
    doc.strokeColor('#9AA9BD').lineWidth(0.8).moveTo(50, doc.y).lineTo(310, doc.y).stroke();

    // The documents as they read when signed, so the record shows what was agreed to.
    data.docs.forEach((d) => {
      doc.addPage();
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(14).text(d.title, { width: W });
      doc.moveDown(0.5).fillColor('#1A2230').font('Helvetica').fontSize(9.5).text(plainText(d.body), { width: W, lineGap: 1.5, paragraphGap: 5 });
    });

    doc.end();
  });
}

module.exports = { isoDay, formOf, fieldsOf, shown, docsOf, validate, logoUrlOf, isRaster, buildPdf, plainText, isEmail, clean, prettyDate };
