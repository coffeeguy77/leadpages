/**
 * Normalise Australian phone numbers to E.164 (+61…).
 * 0414631463 → +61414631463
 * (04) 1463 1463 → +61414631463
 * 61414631463 → +61414631463
 */

function normaliseAuPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('61')) return '+' + digits;
  if (digits.startsWith('0')) return '+61' + digits.slice(1);
  return '+61' + digits;
}

module.exports = { normaliseAuPhone };
