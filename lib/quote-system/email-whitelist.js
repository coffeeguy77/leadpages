/**
 * Online Quote System — per-site verified email whitelist / customer accounts.
 * Accounts are keyed by email. Phone is recorded for SMS; name aliases accumulate.
 */

const { getAdmin } = require('./supabase');
const { normaliseAuPhone } = require('./phone');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function mergeNameAliases(existing, primary, nextName) {
  const out = [];
  const seen = {};
  function push(n) {
    const v = normalizeName(n);
    if (!v) return;
    const key = v.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    out.push(v);
  }
  push(primary);
  (Array.isArray(existing) ? existing : []).forEach(push);
  push(nextName);
  return out.slice(0, 20);
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

async function getWhitelistedAccount(siteId, email) {
  const normalized = normalizeEmail(email);
  if (!siteId || !normalized || normalized.indexOf('@') < 3) return null;
  const admin = getAdmin();
  const { data } = await admin.from('quote_verified_emails')
    .select('*')
    .eq('site_id', siteId)
    .eq('email', normalized)
    .maybeSingle();
  return data || null;
}

/**
 * Upsert whitelist row. Optional phone / name are merged onto the account.
 */
async function whitelistEmail(siteId, email, opts) {
  const normalized = normalizeEmail(email);
  if (!siteId || !normalized || normalized.indexOf('@') < 3) return false;
  opts = opts || {};
  const admin = getAdmin();
  const existing = await getWhitelistedAccount(siteId, normalized);
  const name = normalizeName(opts.name);
  const phone = opts.phone ? normaliseAuPhone(opts.phone) : '';
  const aliases = mergeNameAliases(
    existing && existing.name_aliases,
    existing && existing.primary_name,
    name
  );
  const row = {
    site_id: siteId,
    email: normalized,
    verified_at: (existing && existing.verified_at) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    primary_name: name || (existing && existing.primary_name) || null,
    name_aliases: aliases,
    phone: phone || (existing && existing.phone) || null
  };
  const { error } = await admin.from('quote_verified_emails')
    .upsert(row, { onConflict: 'site_id,email' });
  if (error) throw new Error(error.message);
  return true;
}

async function listWhitelistedEmails(siteId, limit) {
  if (!siteId) return [];
  const admin = getAdmin();
  const { data, error } = await admin.from('quote_verified_emails')
    .select('id,email,phone,primary_name,name_aliases,verified_at,created_at,updated_at')
    .eq('site_id', siteId)
    .order('updated_at', { ascending: false })
    .limit(Math.min(200, Math.max(1, limit || 100)));
  if (error) throw new Error(error.message);
  return data || [];
}

async function removeWhitelistedEmail(siteId, email) {
  const normalized = normalizeEmail(email);
  if (!siteId || !normalized) return false;
  const admin = getAdmin();
  const { error } = await admin.from('quote_verified_emails')
    .delete()
    .eq('site_id', siteId)
    .eq('email', normalized);
  if (error) throw new Error(error.message);
  return true;
}

module.exports = {
  normalizeEmail,
  normalizeName,
  mergeNameAliases,
  isEmailWhitelisted,
  getWhitelistedAccount,
  whitelistEmail,
  listWhitelistedEmails,
  removeWhitelistedEmail
};
