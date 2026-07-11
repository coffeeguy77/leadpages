/**
 * Online Quote System — email and SMS verification (Twilio Verify + Resend).
 */

const crypto = require('crypto');
const { getAdmin } = require('./supabase');
const {
  VERIFY_CHANNEL,
  VERIFY_CODE_TTL_MINUTES,
  MAX_VERIFY_ATTEMPTS
} = require('./constants');

const FROM = process.env.LEADS_FROM || 'leadpages <noreply@leadpages.webculture.au>';

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function codeExpiry() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + VERIFY_CODE_TTL_MINUTES);
  return d.toISOString();
}

async function storeVerification(sessionId, channel, destination, code) {
  const admin = getAdmin();
  const { data, error } = await admin.from('quote_verifications').insert({
    session_id: sessionId,
    channel,
    destination,
    code_hash: hashCode(code),
    expires_at: codeExpiry()
  }).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

async function findLatestVerification(sessionId, channel) {
  const admin = getAdmin();
  const { data } = await admin.from('quote_verifications')
    .select('*')
    .eq('session_id', sessionId)
    .eq('channel', channel)
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .limit(1);
  return data && data[0] ? data[0] : null;
}

async function markVerified(verificationId) {
  const admin = getAdmin();
  await admin.from('quote_verifications')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', verificationId);
}

async function incrementAttempts(verificationId, count) {
  const admin = getAdmin();
  await admin.from('quote_verifications')
    .update({ attempt_count: count })
    .eq('id', verificationId);
}

async function sendEmailCode(email, code, businessName) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: 'no_key' };
  const html =
    '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">' +
    '<h2 style="margin:0 0 8px">Your quote verification code</h2>' +
    '<p style="color:#566;margin:0 0 16px">Enter this code to see your quote total from ' +
    (businessName || 'your provider') + '.</p>' +
    '<div style="font-size:32px;font-weight:800;letter-spacing:6px;padding:16px;background:#f4f6f9;border-radius:12px;text-align:center">' +
    code + '</div>' +
    '<p style="color:#8a93a3;font-size:12px;margin:16px 0 0">Expires in ' + VERIFY_CODE_TTL_MINUTES + ' minutes.</p>' +
    '</div>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: 'Your quote verification code',
        html
      })
    });
    if (!r.ok) return { sent: false, reason: 'resend_' + r.status };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e && e.message) || 'fetch_error' };
  }
}

/**
 * Send a verification code unless a valid pending code already exists for this email.
 */
async function ensureEmailVerificationSent(sessionId, email, businessName) {
  const destination = String(email || '').trim().toLowerCase();
  const pending = await findLatestVerification(sessionId, VERIFY_CHANNEL.EMAIL);
  if (
    pending &&
    pending.destination === destination &&
    new Date(pending.expires_at) > new Date()
  ) {
    return { sent: true, alreadyPending: true };
  }

  const code = generateCode();
  await storeVerification(sessionId, VERIFY_CHANNEL.EMAIL, destination, code);
  const mail = await sendEmailCode(destination, code, businessName);
  return Object.assign({ alreadyPending: false }, mail);
}

async function sendSmsCode(phone, code) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid || !token || !serviceSid) return { sent: false, reason: 'no_twilio' };

  try {
    const auth = Buffer.from(sid + ':' + token).toString('base64');
    const r = await fetch(
      'https://verify.twilio.com/v2/Services/' + serviceSid + '/Verifications',
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + auth,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ To: phone, Channel: 'sms' }).toString()
      }
    );
    if (!r.ok) {
      const t = await r.text().catch(function() { return ''; });
      return { sent: false, reason: 'twilio_' + r.status, body: t.slice(0, 200) };
    }
    return { sent: true, provider: 'twilio_verify' };
  } catch (e) {
    return { sent: false, reason: (e && e.message) || 'fetch_error' };
  }
}

async function checkSmsCode(phone, code) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid || !token || !serviceSid) return { ok: false, reason: 'no_twilio' };

  try {
    const auth = Buffer.from(sid + ':' + token).toString('base64');
    const r = await fetch(
      'https://verify.twilio.com/v2/Services/' + serviceSid + '/VerificationCheck',
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + auth,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ To: phone, Code: code }).toString()
      }
    );
    const data = await r.json().catch(function() { return {}; });
    return { ok: data.status === 'approved', status: data.status };
  } catch (e) {
    return { ok: false, reason: (e && e.message) || 'fetch_error' };
  }
}

async function verifyEmailCode(sessionId, code) {
  const row = await findLatestVerification(sessionId, VERIFY_CHANNEL.EMAIL);
  if (!row) return { ok: false, error: 'no_pending' };
  if (row.attempt_count >= MAX_VERIFY_ATTEMPTS) return { ok: false, error: 'too_many_attempts' };
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: 'expired' };

  await incrementAttempts(row.id, row.attempt_count + 1);
  if (hashCode(code) !== row.code_hash) return { ok: false, error: 'invalid_code' };

  await markVerified(row.id);
  return { ok: true };
}

module.exports = {
  hashCode,
  generateCode,
  storeVerification,
  findLatestVerification,
  sendEmailCode,
  ensureEmailVerificationSent,
  sendSmsCode,
  checkSmsCode,
  verifyEmailCode
};
