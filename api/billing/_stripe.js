// api/billing/_stripe.js — shared helpers for the billing endpoints.
// Underscore-prefixed so Vercel does NOT treat it as its own route; the other
// billing functions require('./_stripe'). Uses raw Stripe REST (no SDK, so no
// package.json change) and the service-role Supabase client.

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ---- form encoding for Stripe (supports nested objects/arrays) ----
function formEncode(obj, pre) {
  const out = [];
  for (const k in obj) {
    const v = obj[k];
    if (v == null) continue;
    const key = pre ? pre + '[' + k + ']' : k;
    if (Array.isArray(v)) {
      v.forEach((it, i) => {
        if (it != null && typeof it === 'object') out.push(formEncode(it, key + '[' + i + ']'));
        else out.push(encodeURIComponent(key + '[' + i + ']') + '=' + encodeURIComponent(it));
      });
    } else if (typeof v === 'object') {
      out.push(formEncode(v, key));
    } else {
      out.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
    }
  }
  return out.filter(Boolean).join('&');
}

// ---- Stripe REST call ----
async function stripe(path, method, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    method: method || 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params ? formEncode(params) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || ('Stripe error ' + r.status));
  return j;
}

// ---- verify a Supabase session token (admin/broker/customer) ----
async function getUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

function isAdminEmail(email) {
  const list = (process.env.SUPER_ADMIN_EMAILS || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
  return !!email && list.includes(String(email).toLowerCase());
}

// ---- read the raw request body (needed for webhook signature) ----
function rawBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && Buffer.isBuffer(req.body)) return resolve(req.body);
    if (typeof req.body === 'string') return resolve(Buffer.from(req.body));
    const chunks = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ---- verify Stripe webhook signature (t=...,v1=...) ----
function verifyStripeSig(rawBuf, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = {};
  String(sigHeader).split(',').forEach((kv) => { const i = kv.indexOf('='); if (i > 0) parts[kv.slice(0, i)] = kv.slice(i + 1); });
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(t + '.' + rawBuf.toString('utf8')).digest('hex');
  try {
    const a = Buffer.from(expected), b = Buffer.from(v1);
    if (a.length !== b.length) return false;
    if (!crypto.timingSafeEqual(a, b)) return false;
  } catch (e) { return false; }
  // tolerance: 5 minutes
  if (Math.abs(Math.floor(Date.now() / 1000) - parseInt(t, 10)) > 300) return false;
  return true;
}

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  return res.end(JSON.stringify(obj));
}

module.exports = { sb, stripe, formEncode, getUser, isAdminEmail, rawBody, verifyStripeSig, json };
