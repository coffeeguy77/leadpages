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

function formatCartsSummary(carts, products) {
  if (!Array.isArray(carts) || !carts.length) return '';
  return carts.map(function(cart, i) {
    const label = labelFor(products, cart.productId) || cart.productId;
    const qty = Math.max(1, Number(cart.quantity) || 1);
    const baristas = Math.max(1, Number(cart.baristas) || 1);
    let line = label + (qty > 1 ? ' ×' + qty : '');
    line += ' — ' + baristas + ' barista' + (baristas > 1 ? 's' : '');
    if (cart.hours != null) line += ', Barista 1 ' + cart.hours + 'h';
    if (cart.extraBaristaMode === 'split') {
      line += ' (Barista 2 split ' + (cart.splitHours || 4) + 'h)';
    } else if (cart.extraBaristaMode === 'full' && (cart.extraBaristas || 0) > 0) {
      line += ' (+full-shift extra)';
    }
    if (carts.length > 1) line = 'Cart ' + (i + 1) + ': ' + line;
    return line;
  }).join(', ');
}

function formatShiftsSummary(shifts) {
  if (!Array.isArray(shifts) || !shifts.length) return '';
  return shifts.map(function(sh, i) {
    const parts = ['Day ' + (i + 1)];
    if (sh.date) parts.push(sh.date);
    if (sh.startTime && sh.endTime) parts.push(sh.startTime + '–' + sh.endTime);
    return parts.join(' ');
  }).join(' · ');
}

function buildQuoteLeadContent(session, calc, config) {
  const cfg = config || {};
  const inputs = calc.inputs || {};
  const productLabel = labelFor(cfg.products, inputs.productId);
  const cartsSummary = formatCartsSummary(inputs.carts, cfg.products);
  const beverageLabel = labelFor(cfg.beverages, inputs.beverageId);
  const addonLabels = (inputs.addonIds || []).map(function(id) {
    return labelFor(cfg.addons, id);
  }).filter(Boolean);
  const travelLabel = labelFor((cfg.travel && cfg.travel.zones) || cfg.travelZones, inputs.travelZoneId);
  const totalFormatted = formatMoney(calc.totalCents);
  const breakdownSummary = (calc.breakdown || []).map(function(row) {
    return row.label + ': ' + formatMoney(row.totalCents);
  }).join(' · ');

  const summaryLines = [];
  if (cartsSummary) summaryLines.push('Equipment: ' + cartsSummary);
  else if (productLabel) summaryLines.push('Equipment: ' + productLabel);
  if (inputs.labourPlanning === 'shifts' && inputs.shifts && inputs.shifts.length) {
    summaryLines.push('Shifts: ' + formatShiftsSummary(inputs.shifts) + ' (' + (inputs.hours || 0) + ' billable hrs)');
  } else if (inputs.hours) {
    summaryLines.push('Duration: ' + inputs.hours + ' hrs');
  }
  if (inputs.unitCount != null && inputs.unitCount !== inputs.guestCount) {
    summaryLines.push('Units: ' + inputs.unitCount);
  } else if (inputs.guestCount) {
    summaryLines.push('Guests: ' + inputs.guestCount);
  }
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
    carts: inputs.carts || [],
    cartsSummary: cartsSummary || null,
    labourPlanning: inputs.labourPlanning || 'hours',
    shifts: inputs.shifts || [],
    hours: inputs.hours || null,
    guestCount: inputs.guestCount || null,
    unitCount: inputs.unitCount != null ? inputs.unitCount : null,
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
  const { isLeadBlocked } = require('../lead-blocklist');
  const inbox = (site && site.config && site.config.leadInbox) || {};
  const blocked = isLeadBlocked({
    email: session.contact_email,
    country: session.contact_country || session.country_code
  }, inbox);
  if (blocked.blocked) {
    return null;
  }

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
