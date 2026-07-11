/**
 * Online Quote System — per-site verified email whitelist.
 */

const { getAdmin } = require('./supabase');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function isEmailWhitelisted(siteId, email) {
  const normalized = normalizeEmail(email);
  if (!siteId || !normalized || normalized.indexOf('@') < 3) return false;
  const admin = getAdmin();
  const { data } = await admin.from('quote_verified_emails')
    .select('id')
    .eq('site_id', siteId)
    .eq('email', normalized)
    .maybeSingle();
  return !!data;
}

async function whitelistEmail(siteId, email) {
  const normalized = normalizeEmail(email);
  if (!siteId || !normalized || normalized.indexOf('@') < 3) return false;
  const admin = getAdmin();
  const { error } = await admin.from('quote_verified_emails')
    .upsert({
      site_id: siteId,
      email: normalized,
      verified_at: new Date().toISOString()
    }, { onConflict: 'site_id,email' });
  if (error) throw new Error(error.message);
  return true;
}

module.exports = {
  normalizeEmail,
  isEmailWhitelisted,
  whitelistEmail
};
