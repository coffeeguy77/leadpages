/**
 * Online Quote System — shared constants and enums.
 */

const CONFIG_CLASSIFICATION = {
  BLANK: 'blank',
  PUBLIC: 'public',
  PRIVATE_SUPERUSER: 'private_superuser'
};

const RESPONSE_LEVEL = {
  PUBLIC_PROGRESS: 'public_progress',
  EMAIL_VERIFIED_TOTAL: 'email_verified_total',
  FULLY_VERIFIED_QUOTE: 'fully_verified_quote',
  AUTHORISED_ADMIN_QUOTE: 'authorised_admin_quote'
};

const SESSION_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  ABANDONED: 'abandoned'
};

const VERIFY_CHANNEL = {
  EMAIL: 'email',
  SMS: 'sms'
};

const GST_RATE = 0.1;

const SESSION_TTL_DAYS = 30;
const VERIFY_CODE_TTL_MINUTES = 15;
const MAX_VERIFY_ATTEMPTS = 5;

module.exports = {
  CONFIG_CLASSIFICATION,
  RESPONSE_LEVEL,
  SESSION_STATUS,
  VERIFY_CHANNEL,
  GST_RATE,
  SESSION_TTL_DAYS,
  VERIFY_CODE_TTL_MINUTES,
  MAX_VERIFY_ATTEMPTS
};
