/**
 * Online Quote System — post-email-verify summary email helper.
 */

const { getQuoteSystemForSite, getActiveConfig } = require('./auth');
const { calculateQuote } = require('./calculator');
const { formatMoney } = require('./serializers');
const { sendEmailVerifiedTotalEmail } = require('./portal-email');
const { getAdmin } = require('./supabase');
const { quoteWizardReturnUrl } = require('./site-url');

async function sendQuoteSummaryEmail(session) {
  if (!session || !session.contact_email) return { sent: false, reason: 'no_email' };

  try {
    const quoteSystem = await getQuoteSystemForSite(session.site_id);
    const configVersion = quoteSystem ? await getActiveConfig(quoteSystem) : null;
    if (!configVersion || !configVersion.config) return { sent: false, reason: 'no_config' };

    const calc = calculateQuote(configVersion.config, session.progress || {});
    const totalFormatted = formatMoney(calc.totalCents);
    const admin = getAdmin();
    const { data: site } = await admin.from('sites')
      .select('slug,business_name,custom_domain')
      .eq('id', session.site_id)
      .maybeSingle();
    const businessName = (configVersion.config.business && configVersion.config.business.name)
      || (site && site.business_name)
      || 'Your provider';

    return sendEmailVerifiedTotalEmail({
      to: session.contact_email,
      businessName,
      totalFormatted,
      returnUrl: site ? quoteWizardReturnUrl(site) : ''
    });
  } catch (e) {
    console.warn('quote-system summary email:', e && e.message);
    return { sent: false, reason: (e && e.message) || 'error' };
  }
}

module.exports = { sendQuoteSummaryEmail };
