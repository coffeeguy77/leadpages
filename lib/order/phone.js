'use strict';

/**
 * AU phone normalisation for Order Engine CRM / SMS / portal.
 * Reuses quote-system rules; keeps a local copy so order APIs stay self-contained.
 */

function normaliseAuPhone(phone) {
  var digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('61')) return '+' + digits;
  if (digits.startsWith('0')) return '+61' + digits.slice(1);
  if (digits.length === 9) return '+61' + digits;
  return '+61' + digits;
}

function displayAuPhone(e164) {
  var d = String(e164 || '').replace(/\D/g, '');
  if (d.startsWith('61') && d.length === 11) {
    return '0' + d.slice(2, 5) + ' ' + d.slice(5, 8) + ' ' + d.slice(8);
  }
  return String(e164 || '');
}

function phonesMatch(a, b) {
  var x = normaliseAuPhone(a);
  var y = normaliseAuPhone(b);
  return !!(x && y && x === y);
}

module.exports = { normaliseAuPhone, displayAuPhone, phonesMatch };
