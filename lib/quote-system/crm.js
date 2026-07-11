/**
 * Online Quote System — CRM lead creation for quote submissions.
 */

const { getAdmin } = require('./supabase');
const { clean } = require('./http');
const { formatMoney } = require('./serializers');

function labelFor(list, id) {
  if (!id) return '';
  const item = (list || []).find(function(x) { return x.id === id; });
  return item ? item.label : String(id);
}

function buildQuoteLeadContent(session, calc, config) {
  const cfg = config || {};
  const inputs = calc.inputs || {};
  const productLabel = labelFor(cfg.products, inputs.productId);
  const beverageLabel = labelFor(cfg.beverages, inputs.beverageId);
  const addonLabels = (inputs.addonIds || []).map(function(id) {
    return labelFor(cfg.addons, id);
  }).filter(Boolean);
  const travelLabel = labelFor(cfg.travelZones, inputs.travelZoneId);
  const totalFormatted = formatMoney(calc.totalCents);
  const breakdownSummary = (calc.breakdown || []).map(function(row) {
    return row.label + ': ' + formatMoney(row.totalCents);
  }).join(' · ');

  const summaryLines = [];
  if (productLabel) summaryLines.push('Equipment: ' + productLabel);
  if (inputs.hours) summaryLines.push('Duration: ' + inputs.hours + ' hrs');
  if (inputs.guestCount) summaryLines.push('Guests: ' + inputs.guestCount);
  if (beverageLabel) summaryLines.push('Beverage: ' + beverageLabel);
  if (addonLabels.length) summaryLines.push('Add-ons: ' + addonLabels.join(', '));
  if (travelLabel) summaryLines.push('Travel: ' + travelLabel);

  const messageParts = ['Online quote — ' + totalFormatted];
  if (summaryLines.length) messageParts.push(summaryLines.join(' · '));
  if (breakdownSummary) messageParts.push(breakdownSummary);

  const details = {
    quoteSessionId: session.id,
    productId: inputs.productId || null,
    productLabel: productLabel || null,
    hours: inputs.hours || null,
    guestCount: inputs.guestCount || null,
    beverageId: inputs.beverageId || null,
    beverageLabel: beverageLabel || null,
    addonIds: inputs.addonIds || [],
    addonLabels,
    travelZoneId: inputs.travelZoneId || null,
    travelLabel: travelLabel || null,
    totalCents: calc.totalCents,
    totalFormatted,
    breakdownSummary,
    breakdown: (calc.breakdown || []).map(function(row) {
      return { label: row.label, total: formatMoney(row.totalCents) };
    }),
    emailVerified: !!session.email_verified_at,
    smsVerified: !!session.sms_verified_at
  };

  return {
    message: messageParts.join('\n'),
    details
  };
}

async function createQuoteLead(site, session, calc, config) {
  const admin = getAdmin();
  const payload = buildQuoteLeadContent(session, calc, config);

  const { data, error } = await admin.from('leads').insert({
    site_id: site.id,
    owner_user_id: site.owner_user_id || null,
    name: clean(session.contact_name, 120) || null,
    email: clean(session.contact_email, 160) || null,
    phone: clean(session.contact_phone, 60) || null,
    kind: 'quote',
    details: payload.details,
    message: payload.message,
    status: 'new',
    site: site.business_name || null,
    source: 'online_quote'
  }).select('id').single();

  if (error) throw new Error(error.message);
  return data.id;
}

module.exports = {
  labelFor,
  buildQuoteLeadContent,
  createQuoteLead
};
