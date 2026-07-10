/**
 * Online Quote System — CRM lead creation for quote submissions.
 */

const { getAdmin } = require('./supabase');
const { clean } = require('./http');
const { formatMoney } = require('./serializers');

async function createQuoteLead(site, session, calc) {
  const admin = getAdmin();
  const details = {
    quoteSessionId: session.id,
    productId: (calc.inputs && calc.inputs.productId) || null,
    hours: (calc.inputs && calc.inputs.hours) || null,
    guestCount: (calc.inputs && calc.inputs.guestCount) || null,
    addonIds: (calc.inputs && calc.inputs.addonIds) || [],
    travelZoneId: (calc.inputs && calc.inputs.travelZoneId) || null,
    totalCents: calc.totalCents,
    totalFormatted: formatMoney(calc.totalCents),
    breakdownSummary: (calc.breakdown || []).map(function(row) {
      return row.label + ': ' + formatMoney(row.totalCents);
    }).join(' · ')
  };

  const message = 'Online quote — ' + formatMoney(calc.totalCents) +
    (details.productId ? ' · ' + details.productId : '');

  const { data, error } = await admin.from('leads').insert({
    site_id: site.id,
    owner_user_id: site.owner_user_id || null,
    name: clean(session.contact_name, 120) || null,
    email: clean(session.contact_email, 160) || null,
    phone: clean(session.contact_phone, 60) || null,
    kind: 'quote',
    details,
    message,
    status: 'new',
    site: site.business_name || null,
    source: 'online_quote'
  }).select('id').single();

  if (error) throw new Error(error.message);
  return data.id;
}

module.exports = { createQuoteLead };
