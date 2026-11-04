'use strict';
/**
 * Customer-facing email branding (Nov 2026).
 *
 * Emails a business's CUSTOMERS receive (quote codes, quote links, booking and order
 * messages, campaigns) are sent:
 *   From:     "<Business name>" <noreply@leadpages.com.au>   — the inbox shows the business
 *   Reply-To: the business's own email                         — replies reach the business
 *   Footer:   "Powered by LeadPages" (link)
 *
 * Emails to the BUSINESS OWNER (new enquiry alerts, quote accepted, partner emails) keep
 * the plain LeadPages sender so owners can find everything from their site under "LeadPages".
 *
 * The address itself stays on leadpages.com.au: it is the domain verified with Resend
 * (SPF / DKIM / DMARC), so delivery is not put at risk.
 */

const BASE_FROM = process.env.LEADS_FROM || 'LeadPages <noreply@leadpages.com.au>';
const SITE_URL = 'https://www.leadpages.com.au';

const isEmail = (s) => /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(String(s || '').trim());

/** The bare sending address from LEADS_FROM ("noreply@leadpages.com.au"). */
function fromAddress() {
  const m = /<([^>]+)>/.exec(BASE_FROM);
  return (m ? m[1] : BASE_FROM).trim();
}

/** A display name safe for an email header (no quotes, angle brackets, line breaks). */
function cleanName(name) {
  return String(name || '')
    .replace(/[\r\n\t"<>\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 70);
}

/** '"Bean Culture" <noreply@leadpages.com.au>', or the LeadPages sender when no name. */
function customerFrom(businessName) {
  const n = cleanName(businessName);
  return n ? '"' + n + '" <' + fromAddress() + '>' : BASE_FROM;
}

/** The business's own email for replies (same order the lead alerts use), or ''. */
function replyToForSite(site) {
  const cfg = (site && site.config) || {};
  const q = (cfg.sections && cfg.sections.quote) || {};
  const picks = [
    q.notifyMode === 'custom' ? q.notifyEmail : '',
    cfg.email,
    site && site.owner_email
  ];
  for (let i = 0; i < picks.length; i++) {
    if (isEmail(picks[i])) return String(picks[i]).trim();
  }
  return '';
}

function businessNameForSite(site) {
  const cfg = (site && site.config) || {};
  return cleanName(cfg.businessName || cfg.name || (site && site.business_name) || '');
}

/** { from, replyTo, name } for a site row ({ business_name, owner_email, config }). */
function senderForSite(site, nameOverride) {
  const name = cleanName(nameOverride) || businessNameForSite(site);
  return { name, from: customerFrom(name), replyTo: replyToForSite(site) };
}

/** Load a site and return its sender. admin = Supabase service client. Never throws. */
async function senderForSiteId(admin, siteId, nameOverride) {
  if (!admin || !siteId) return { name: cleanName(nameOverride), from: customerFrom(nameOverride), replyTo: '' };
  try {
    const { data } = await admin.from('sites')
      .select('id,business_name,owner_email,config')
      .eq('id', siteId)
      .maybeSingle();
    if (data) return senderForSite(data, nameOverride);
  } catch (e) { /* fall through */ }
  return { name: cleanName(nameOverride), from: customerFrom(nameOverride), replyTo: '' };
}

const FOOTER_HTML =
  '<p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #e6e9ef;font-family:system-ui,Arial,sans-serif;font-size:12px;color:#8a93a3;text-align:center">' +
  'Powered by <a href="' + SITE_URL + '" style="color:#8a93a3;text-decoration:underline">LeadPages</a></p>';
const FOOTER_TEXT = '\n\n—\nPowered by LeadPages · ' + SITE_URL;

/** Add the footer once (before </body> when there is one). */
function withFooterHtml(html) {
  const s = String(html || '');
  if (!s || s.indexOf('Powered by <a href="' + SITE_URL) >= 0) return s;
  const i = s.toLowerCase().lastIndexOf('</body>');
  return i >= 0 ? s.slice(0, i) + FOOTER_HTML + s.slice(i) : s + FOOTER_HTML;
}
function withFooterText(text) {
  const s = String(text || '');
  if (!s || s.indexOf('Powered by LeadPages') >= 0) return s;
  return s + FOOTER_TEXT;
}

/**
 * Brand a Resend payload for a customer: sets from, reply_to (unless already set) and the
 * footer on html / text. Returns a new object.
 */
function brandCustomerEmail(payload, sender) {
  const p = Object.assign({}, payload);
  const s = sender || {};
  if (s.from) p.from = s.from;
  if (!p.reply_to && isEmail(s.replyTo)) p.reply_to = s.replyTo;
  if (p.html) p.html = withFooterHtml(p.html);
  if (p.text) p.text = withFooterText(p.text);
  return p;
}

module.exports = {
  BASE_FROM, fromAddress, cleanName, customerFrom, replyToForSite, businessNameForSite,
  senderForSite, senderForSiteId, withFooterHtml, withFooterText, brandCustomerEmail, isEmail
};
