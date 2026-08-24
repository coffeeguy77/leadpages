'use strict';

const VALID_SMS_KINDS = new Set([
  'transactional',
  'otp',
  'broadcast',
  'abandoned',
  'import_notice',
  'other'
]);

/** Rough GSM-7 segment count for billing (160 / 153). */
function estimateSegments(body) {
  var len = String(body || '').length;
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

/**
 * Map event_type / sms_kind to order_sms_usage.kind (check constraint).
 */
function normalizeSmsKind(raw) {
  var k = String(raw || '').trim().toLowerCase();
  if (VALID_SMS_KINDS.has(k)) return k;
  if (k === 'abandoned_cart' || k === 'abandoned_cart_2' || k.indexOf('abandoned') >= 0) {
    return 'abandoned';
  }
  if (k === 'otp' || k === 'sms_otp' || k.indexOf('otp') >= 0) return 'otp';
  if (k === 'broadcast' || k === 'broadcast_open_cart') return 'broadcast';
  if (k.indexOf('import') >= 0) return 'import_notice';
  return 'transactional';
}

module.exports = {
  estimateSegments,
  normalizeSmsKind
};
