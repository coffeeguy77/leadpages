'use strict';

/**
 * Rental agreement templates + immutable generated versions.
 */

const DEFAULT_MERGE_FIELDS = [
  'business_name',
  'abn',
  'business_address',
  'booking_reference',
  'customer_name',
  'customer_phone',
  'customer_email',
  'customer_address',
  'licence_number',
  'licence_expiry',
  'licence_state',
  'resource_name',
  'registration',
  'make_model',
  'pickup_at',
  'return_at',
  'hire_duration',
  'daily_rate',
  'fees',
  'bond',
  'gst',
  'total',
  'cancellation_terms',
  'card_on_file_status',
  'special_conditions',
  'generated_at'
];

function applyMerge(templateHtml, data) {
  return String(templateHtml || '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, function (_, key) {
    const v = data[key];
    return v == null ? '' : String(v);
  });
}

function buildMergeData(system, booking, hire, resource, customer, quote) {
  const addr = (customer && (customer.address_json || customer.address)) || {};
  return {
    business_name: system.business_name || system.name || '',
    abn: system.abn || '',
    business_address: system.address || '',
    booking_reference: booking.reference || booking.id,
    customer_name: (customer && customer.name) || booking.customer_name || '',
    customer_phone: (customer && customer.phone) || booking.customer_phone || '',
    customer_email: (customer && customer.email) || booking.customer_email || '',
    customer_address: [addr.line1, addr.suburb, addr.state, addr.postcode].filter(Boolean).join(', '),
    licence_number: (hire && hire.driver_json && hire.driver_json.licence_number) || '',
    licence_expiry: (hire && hire.driver_json && hire.driver_json.licence_expiry) || '',
    licence_state: (hire && hire.driver_json && hire.driver_json.licence_state) || '',
    resource_name: (resource && (resource.public_name || resource.name)) || '',
    registration: (resource && resource.registration_number) || '',
    make_model: [resource && resource.make, resource && resource.model].filter(Boolean).join(' '),
    pickup_at: (hire && hire.pickup_at) || booking.starts_at,
    return_at: (hire && hire.return_at) || booking.ends_at,
    hire_duration: (hire && hire.hire_days ? hire.hire_days + ' day(s)' : '') || '',
    daily_rate: quote && quote.day_rates && quote.day_rates[0] ? (quote.day_rates[0].rate_cents / 100).toFixed(2) : '',
    fees: quote ? ((quote.extras_cents || 0) / 100).toFixed(2) : '',
    bond: quote ? ((quote.bond_cents || 0) / 100).toFixed(2) : '',
    gst: quote ? ((quote.gst_cents || 0) / 100).toFixed(2) : '',
    total: quote ? ((quote.total_cents || 0) / 100).toFixed(2) : '',
    cancellation_terms: ((system.settings && system.settings.hire && system.settings.hire.cancellation_terms) || ''),
    card_on_file_status: (hire && hire.card_on_file_status) || 'none',
    special_conditions: (hire && hire.meta && hire.meta.special_conditions) || '',
    generated_at: new Date().toISOString()
  };
}

async function generateAgreement(admin, opts) {
  const system = opts.system;
  const booking = opts.booking;
  const hire = opts.hire;
  const resource = opts.resource;
  const customer = opts.customer;
  const quote = opts.quote || (hire && hire.pricing_snapshot_json) || {};

  let template = opts.template;
  if (!template) {
    const templateId = (resource && resource.agreement_template_id) || opts.templateId;
    if (templateId) {
      const { data } = await admin
        .from('booking_agreement_templates')
        .select('*')
        .eq('id', templateId)
        .eq('booking_system_id', system.id)
        .maybeSingle();
      template = data;
    }
    if (!template) {
      const { data } = await admin
        .from('booking_agreement_templates')
        .select('*')
        .eq('booking_system_id', system.id)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      template = data;
    }
  }
  if (!template) return { ok: false, error: 'no_agreement_template' };

  const { data: prior } = await admin
    .from('booking_agreement_versions')
    .select('version_number,status,id')
    .eq('booking_id', booking.id)
    .order('version_number', { ascending: false })
    .limit(1);
  const last = prior && prior[0];
  const nextVersion = last ? last.version_number + 1 : 1;

  if (last && (last.status === 'signed' || last.status === 'sent' || last.status === 'viewed')) {
    await admin
      .from('booking_agreement_versions')
      .update({ status: 'superseded' })
      .eq('id', last.id);
  }

  const mergeData = buildMergeData(system, booking, hire, resource, customer, quote);
  const html = applyMerge(template.body_html, mergeData);

  const row = {
    booking_id: booking.id,
    booking_system_id: system.id,
    site_id: system.site_id,
    template_id: template.id,
    template_version: template.template_version || '1',
    version_number: nextVersion,
    status: 'generated',
    html_snapshot: html,
    merge_data_json: mergeData,
    generated_by: opts.actorUserId || null,
    generated_at: new Date().toISOString()
  };

  const { data: saved, error } = await admin
    .from('booking_agreement_versions')
    .insert(row)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };

  await admin
    .from('booking_hire_details')
    .update({ agreement_status: 'generated', updated_at: new Date().toISOString() })
    .eq('booking_id', booking.id);

  await admin.from('booking_activity').insert({
    booking_id: booking.id,
    booking_system_id: system.id,
    site_id: system.site_id,
    event_type: 'agreement_generated',
    summary: 'Rental agreement v' + nextVersion + ' generated',
    meta: { version_id: saved.id, version_number: nextVersion },
    actor_user_id: opts.actorUserId || null
  });

  return { ok: true, agreement: saved, merge_data: mergeData };
}

module.exports = {
  DEFAULT_MERGE_FIELDS,
  applyMerge,
  buildMergeData,
  generateAgreement
};
