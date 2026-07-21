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

/** Strip spaces/dashes so "494 679" and "494679" match the emailed code. */
function normalizeOtpCode(code) {
  return String(code == null ? '' : code).replace(/\D/g, '').slice(0, 8);
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function codeExpiry() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + VERIFY_CODE_TTL_MINUTES);
  return d.toISOString();
}

async function invalidatePendingVerifications(sessionId, channel, exceptId) {
  const admin = getAdmin();
  let q = admin.from('quote_verifications')
    .update({ expires_at: new Date(0).toISOString() })
    .eq('session_id', sessionId)
    .eq('channel', channel)
    .is('verified_at', null);
  if (exceptId) q = q.neq('id', exceptId);
  await q;
}

async function storeVerification(sessionId, channel, destination, code) {
  const admin = getAdmin();
  await invalidatePendingVerifications(sessionId, channel);
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

async function findPendingVerifications(sessionId, channel) {
  const admin = getAdmin();
  const { data } = await admin.from('quote_verifications')
    .select('*')
    .eq('session_id', sessionId)
    .eq('channel', channel)
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .limit(10);
  return data || [];
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
  if (!key) {
    console.error('quote-system sendEmailCode: RESEND_API_KEY missing');
    return { sent: false, reason: 'no_key' };
  }
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
        subject: 'Your quote verification code — ' + (businessName || 'Quote'),
        html
      })
    });
    if (!r.ok) {
      const t = await r.text().catch(function() { return ''; });
      console.error('quote-system sendEmailCode resend_' + r.status + ':', t.slice(0, 400));
      return { sent: false, reason: 'resend_' + r.status, body: t.slice(0, 200) };
    }
    return { sent: true };
  } catch (e) {
    console.error('quote-system sendEmailCode:', e && e.message);
    return { sent: false, reason: (e && e.message) || 'fetch_error' };
  }
}

/**
 * Send a verification code unless a valid pending code already exists for this email
 * AND we are not forcing a fresh send.
 * Pass force:true to invalidate the pending code and email a fresh one (Resend).
 * If Resend fails after insert, invalidate the pending row so we do not pretend a
 * code is "already on its way".
 */
async function ensureEmailVerificationSent(sessionId, email, businessName, opts) {
  const destination = String(email || '').trim().toLowerCase();
  const force = !!(opts && opts.force);
  if (!destination || destination.indexOf('@') < 3) {
    return { sent: false, reason: 'valid_email_required' };
  }

  const pending = await findLatestVerification(sessionId, VERIFY_CHANNEL.EMAIL);
  if (
    !force &&
    pending &&
    pending.destination === destination &&
    new Date(pending.expires_at) > new Date()
  ) {
    // Pending row exists — but do not claim delivery. Caller should force-resend
    // when the customer says they never got the email.
    return { sent: false, alreadyPending: true, reason: 'already_pending' };
  }

  const code = generateCode();
  let row;
  try {
    row = await storeVerification(sessionId, VERIFY_CHANNEL.EMAIL, destination, code);
  } catch (storeErr) {
    console.error('quote-system storeVerification:', storeErr && storeErr.message);
    return { sent: false, reason: 'store_failed', message: storeErr && storeErr.message };
  }

  const mail = await sendEmailCode(destination, code, businessName);
  if (!mail.sent) {
    try {
      if (row && row.id) await invalidatePendingVerifications(sessionId, VERIFY_CHANNEL.EMAIL);
    } catch (_) { /* ignore */ }
  }
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

  const normalized = normalizeOtpCode(code);
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
        body: new URLSearchParams({ To: phone, Code: normalized }).toString()
      }
    );
    const data = await r.json().catch(function() { return {}; });
    return { ok: data.status === 'approved', status: data.status };
  } catch (e) {
    return { ok: false, reason: (e && e.message) || 'fetch_error' };
  }
}

/**
 * Accept a code that matches ANY still-pending row for this session (not only the
 * latest). Handles races where calculate/resend emailed multiple codes.
 */
async function verifyEmailCode(sessionId, code) {
  const normalized = normalizeOtpCode(code);
  if (!normalized || normalized.length < 4) {
    return { ok: false, error: 'invalid_code' };
  }

  const rows = await findPendingVerifications(sessionId, VERIFY_CHANNEL.EMAIL);
  if (!rows.length) return { ok: false, error: 'no_pending' };

  const now = new Date();
  const usable = rows.filter(function(row) {
    return new Date(row.expires_at) > now &&
      (row.attempt_count || 0) < MAX_VERIFY_ATTEMPTS;
  });
  if (!usable.length) {
    const latest = rows[0];
    if ((latest.attempt_count || 0) >= MAX_VERIFY_ATTEMPTS) {
      return { ok: false, error: 'too_many_attempts' };
    }
    return { ok: false, error: 'expired' };
  }

  const want = hashCode(normalized);
  const match = usable.find(function(row) { return row.code_hash === want; });
  if (!match) {
    // Burn an attempt on the newest usable row only.
    const latest = usable[0];
    await incrementAttempts(latest.id, (latest.attempt_count || 0) + 1);
    return { ok: false, error: 'invalid_code' };
  }

  await markVerified(match.id);
  await invalidatePendingVerifications(sessionId, VERIFY_CHANNEL.EMAIL, match.id);
  return { ok: true };
}

module.exports = {
  hashCode,
  normalizeOtpCode,
  generateCode,
  storeVerification,
  findLatestVerification,
  sendEmailCode,
  ensureEmailVerificationSent,
  sendSmsCode,
  checkSmsCode,
  verifyEmailCode
};
