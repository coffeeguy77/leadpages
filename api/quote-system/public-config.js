/**
 * GET /api/quote-system/public-config?slug=beanculture
 * Returns wizard shell only — no pricing. Server-side tenant guard.
 */

const { readBody, json } = require('../../lib/quote-system/http');
const {
  resolveSiteBySlug,
  getQuoteSystemForSite,
  getActiveConfig
} = require('../../lib/quote-system/auth');
const { serializePublicConfig } = require('../../lib/quote-system/serializers');
const { CONFIG_CLASSIFICATION } = require('../../lib/quote-system/constants');
const { assertQuoteAppEntitled } = require('../../lib/quote-system/billing');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const url = new URL(req.url, 'https://x');
    const slug = (url.searchParams.get('slug') || '').trim().toLowerCase();
    if (!slug) return json(res, 400, { ok: false, error: 'slug_required' });

    const site = await resolveSiteBySlug(slug);
    if (!site) return json(res, 404, { ok: false, error: 'site_not_found' });

    const quoteSystem = await getQuoteSystemForSite(site.id);
    if (!quoteSystem || !quoteSystem.enabled) {
      return json(res, 200, {
        ok: true,
        enabled: false,
        shell: { products: [], addons: [], beverages: [], wizard: { steps: [] }, business: {} }
      });
    }

    const entitled = await assertQuoteAppEntitled(site.id);
    if (!entitled.ok) {
      return json(res, 200, {
        ok: true,
        enabled: false,
        subscriptionRequired: true,
        shell: { products: [], addons: [], beverages: [], wizard: { steps: [] }, business: {} }
      });
    }

    const configVersion = await getActiveConfig(quoteSystem);
    const config = configVersion ? configVersion.config : {};

    if (quoteSystem.configuration_classification === CONFIG_CLASSIFICATION.BLANK) {
      return json(res, 200, {
        ok: true,
        enabled: true,
        classification: 'blank',
        shell: serializePublicConfig({}, quoteSystem).shell
      });
    }

    return json(res, 200, Object.assign({ ok: true }, serializePublicConfig(config, quoteSystem)));
  } catch (e) {
    console.error('quote-system/public-config:', e && e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
