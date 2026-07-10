/**
 * Online Quote System — marketplace subscription entitlement checks.
 */

const { getAdmin } = require('./supabase');
const { CONFIG_CLASSIFICATION } = require('./constants');

const SECTION_KEY = 'onlineQuote';

let cachedAppId = null;

async function getOnlineQuoteAppId() {
  if (cachedAppId) return cachedAppId;
  const admin = getAdmin();
  const { data } = await admin.from('app_registry')
    .select('id')
    .eq('section_key', SECTION_KEY)
    .maybeSingle();
  cachedAppId = data && data.id ? data.id : null;
  return cachedAppId;
}

function subscriptionIsActive(sub) {
  if (!sub) return false;
  const now = new Date();
  if (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') return true;
  if (sub.status === 'cancelled' && sub.access_until && new Date(sub.access_until) > now) return true;
  return false;
}

async function hasActiveQuoteAppSubscription(siteId) {
  const appId = await getOnlineQuoteAppId();
  if (!appId || !siteId) return false;
  const admin = getAdmin();
  const { data: sub } = await admin.from('site_app_subscriptions')
    .select('status, access_until')
    .eq('site_id', siteId)
    .eq('app_id', appId)
    .maybeSingle();
  return subscriptionIsActive(sub);
}

async function isQuotePlatformExempt(siteId) {
  const admin = getAdmin();
  const { data: qs } = await admin.from('quote_systems')
    .select('configuration_classification')
    .eq('site_id', siteId)
    .maybeSingle();
  return !!(qs && qs.configuration_classification === CONFIG_CLASSIFICATION.PRIVATE_SUPERUSER);
}

/**
 * Returns whether a site may run the public quote wizard (subscription or platform exempt).
 */
async function assertQuoteAppEntitled(siteId) {
  if (!siteId) return { ok: false, error: 'no_site' };
  if (await isQuotePlatformExempt(siteId)) return { ok: true, exempt: true };
  if (await hasActiveQuoteAppSubscription(siteId)) return { ok: true };
  return { ok: false, error: 'subscription_required' };
}

module.exports = {
  SECTION_KEY,
  getOnlineQuoteAppId,
  subscriptionIsActive,
  hasActiveQuoteAppSubscription,
  isQuotePlatformExempt,
  assertQuoteAppEntitled
};
