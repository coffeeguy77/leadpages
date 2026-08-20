'use strict';

const crypto = require('crypto');
const { getAdmin } = require('./supabase');

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function generateRawToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Allocate next order number: ORD-2026-00482
 */
async function allocateOrderNumber(orderSystem) {
  const admin = getAdmin();
  const year = new Date().getFullYear();
  // Atomic-ish increment via update returning
  const { data, error } = await admin
    .from('order_systems')
    .update({
      next_order_seq: (orderSystem.next_order_seq || 1) + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderSystem.id)
    .eq('next_order_seq', orderSystem.next_order_seq || 1)
    .select('next_order_seq, order_prefix')
    .maybeSingle();

  let seq;
  let prefix = orderSystem.order_prefix || 'ORD';
  if (error || !data) {
    // Fallback read-modify if race lost
    const fresh = await admin
      .from('order_systems')
      .select('next_order_seq, order_prefix')
      .eq('id', orderSystem.id)
      .single();
    seq = fresh.data.next_order_seq || 1;
    prefix = fresh.data.order_prefix || 'ORD';
    await admin
      .from('order_systems')
      .update({ next_order_seq: seq + 1, updated_at: new Date().toISOString() })
      .eq('id', orderSystem.id);
  } else {
    seq = (data.next_order_seq || 2) - 1;
    prefix = data.order_prefix || 'ORD';
  }
  const num = String(seq).padStart(5, '0');
  return prefix + '-' + year + '-' + num;
}

async function createAccessToken(orderId, siteId, purpose, ttlHours) {
  const admin = getAdmin();
  const raw = generateRawToken();
  const hours = ttlHours != null ? ttlHours : 72;
  const expires = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const { data, error } = await admin
    .from('order_access_tokens')
    .insert({
      order_id: orderId,
      site_id: siteId,
      token_hash: hashToken(raw),
      purpose: purpose || 'portal',
      expires_at: expires
    })
    .select('id, expires_at, purpose')
    .single();
  if (error) throw error;
  return { token: raw, record: data };
}

async function createCustomerSessionToken(opts) {
  const admin = getAdmin();
  const raw = generateRawToken();
  const hours = opts.ttlHours != null ? opts.ttlHours : 24 * 14;
  const expires = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const { data, error } = await admin
    .from('order_access_tokens')
    .insert({
      order_id: null,
      site_id: opts.site_id,
      order_system_id: opts.order_system_id || null,
      customer_id: opts.customer_id,
      token_hash: hashToken(raw),
      purpose: 'portal_customer',
      expires_at: expires,
      meta: opts.meta || {}
    })
    .select('id, expires_at, purpose, customer_id')
    .single();
  if (error) throw error;
  return { token: raw, record: data };
}

async function storeSmsOtp(opts) {
  const admin = getAdmin();
  const code = String(opts.code || '');
  const phone = String(opts.phone_e164 || '');
  const hours = 10 / 60; // 10 minutes
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  // Revoke prior OTPs for this phone/system
  await admin
    .from('order_access_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('site_id', opts.site_id)
    .eq('purpose', 'sms_otp')
    .is('revoked_at', null)
    .contains('meta', { phone_e164: phone });
  const { data, error } = await admin
    .from('order_access_tokens')
    .insert({
      order_id: null,
      site_id: opts.site_id,
      order_system_id: opts.order_system_id || null,
      customer_id: opts.customer_id || null,
      token_hash: hashToken(phone + ':' + code),
      purpose: 'sms_otp',
      expires_at: expires,
      meta: { phone_e164: phone }
    })
    .select('id, expires_at')
    .single();
  if (error) throw error;
  return data;
}

async function verifySmsOtp(opts) {
  const admin = getAdmin();
  const phone = String(opts.phone_e164 || '');
  const code = String(opts.code || '').trim();
  const { data } = await admin
    .from('order_access_tokens')
    .select('*')
    .eq('site_id', opts.site_id)
    .eq('purpose', 'sms_otp')
    .eq('token_hash', hashToken(phone + ':' + code))
    .is('revoked_at', null)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  await admin
    .from('order_access_tokens')
    .update({ revoked_at: new Date().toISOString(), last_used_at: new Date().toISOString() })
    .eq('id', data.id);
  return data;
}

async function resolveAccessToken(raw) {
  if (!raw) return null;
  const admin = getAdmin();
  const { data } = await admin
    .from('order_access_tokens')
    .select('*')
    .eq('token_hash', hashToken(raw))
    .maybeSingle();
  if (!data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  await admin
    .from('order_access_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);
  return data;
}

module.exports = {
  hashToken,
  generateRawToken,
  allocateOrderNumber,
  createAccessToken,
  createCustomerSessionToken,
  storeSmsOtp,
  verifySmsOtp,
  resolveAccessToken
};
