/**
 * Provision Bean Culture private_superuser quote config on a quote_systems row.
 * Shared by scripts/seed-bean-culture-quote.js and admin enable API.
 */

const { BEAN_CULTURE_QUOTE_CONFIG } = require('./bean-culture-config');
const { CONFIG_CLASSIFICATION } = require('./constants');
const { getAdmin } = require('./supabase');

const BEAN_CULTURE_SLUG = 'beanculture';

async function provisionBeanCultureConfig(quoteSystemId, userId) {
  const admin = getAdmin();

  const { data: qs, error: qsErr } = await admin.from('quote_systems')
    .update({
      enabled: true,
      configuration_classification: CONFIG_CLASSIFICATION.PRIVATE_SUPERUSER,
      updated_at: new Date().toISOString()
    })
    .eq('id', quoteSystemId)
    .select('*')
    .single();
  if (qsErr) throw new Error(qsErr.message);

  const { data: latest } = await admin.from('quote_system_config_versions')
    .select('version_number,config')
    .eq('quote_system_id', quoteSystemId)
    .order('version_number', { ascending: false })
    .limit(1);

  const nextVersion = (latest && latest[0] ? latest[0].version_number : 0) + 1;
  const configJson = JSON.stringify(BEAN_CULTURE_QUOTE_CONFIG);
  const existingJson = latest && latest[0] ? JSON.stringify(latest[0].config) : '';

  if (existingJson === configJson && qs.active_config_version_id) {
    return { quoteSystem: qs, provisioned: false };
  }

  const { data: version, error: verErr } = await admin.from('quote_system_config_versions').insert({
    quote_system_id: quoteSystemId,
    version_number: nextVersion,
    label: 'Bean Culture Coffee Cart Hire',
    config: BEAN_CULTURE_QUOTE_CONFIG,
    created_by: userId || null
  }).select('*').single();
  if (verErr) throw new Error(verErr.message);

  const { data: updated, error: ptrErr } = await admin.from('quote_systems')
    .update({ active_config_version_id: version.id, updated_at: new Date().toISOString() })
    .eq('id', quoteSystemId)
    .select('*')
    .single();
  if (ptrErr) throw new Error(ptrErr.message);

  return { quoteSystem: updated, provisioned: true, version };
}

module.exports = {
  BEAN_CULTURE_SLUG,
  provisionBeanCultureConfig
};
