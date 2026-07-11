/**
 * GET  /api/quote-system/admin/config?site_id=...
 * POST /api/quote-system/admin/config  { site_id, config?, enabled?, label? }
 * Full config for authorised admins; private_superuser requires super admin.
 */

const { readBody, json, clean } = require('../../../lib/quote-system/http');
const {
  requireUser,
  assertSiteAccess,
  getQuoteSystemForSite,
  getActiveConfig,
  canReadFullConfig,
  canWriteConfig,
  isSuperAdmin
} = require('../../../lib/quote-system/auth');
const { serializeAdminConfig } = require('../../../lib/quote-system/serializers');
const { CONFIG_CLASSIFICATION } = require('../../../lib/quote-system/constants');
const { getAdmin } = require('../../../lib/quote-system/supabase');
const { BEAN_CULTURE_SLUG, provisionBeanCultureConfig } = require('../../../lib/quote-system/provision-bean-culture');

async function ensureQuoteSystem(siteId, classification) {
  const admin = getAdmin();
  let qs = await getQuoteSystemForSite(siteId);
  if (qs) return qs;

  const { data, error } = await admin.from('quote_systems').insert({
    site_id: siteId,
    enabled: false,
    configuration_classification: classification || CONFIG_CLASSIFICATION.BLANK
  }).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

async function insertConfigVersion(quoteSystemId, config, userId, label) {
  const admin = getAdmin();
  const { data: latest } = await admin.from('quote_system_config_versions')
    .select('version_number')
    .eq('quote_system_id', quoteSystemId)
    .order('version_number', { ascending: false })
    .limit(1);

  const versionNumber = (latest && latest[0] ? latest[0].version_number : 0) + 1;
  const { data, error } = await admin.from('quote_system_config_versions').insert({
    quote_system_id: quoteSystemId,
    version_number: versionNumber,
    label: label || ('v' + versionNumber),
    config: config || {},
    created_by: userId || null
  }).select('*').single();
  if (error) throw new Error(error.message);

  await admin.from('quote_systems')
    .update({ active_config_version_id: data.id, updated_at: new Date().toISOString() })
    .eq('id', quoteSystemId);

  return data;
}

module.exports = async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'auth' });

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'https://x');
      const siteId = clean(url.searchParams.get('site_id'), 80);
      if (!siteId) return json(res, 400, { ok: false, error: 'site_id_required' });

      const access = await assertSiteAccess(user, siteId);
      if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

      const isSuper = await isSuperAdmin(user.id);
      const quoteSystem = await getQuoteSystemForSite(siteId);
      if (!quoteSystem) {
        return json(res, 200, {
          ok: true,
          quoteSystem: null,
          message: 'not_configured'
        });
      }

      const configVersion = await getActiveConfig(quoteSystem);
      const mayRead = canReadFullConfig(quoteSystem, { isSuper, isAdminRequest: true });

      if (!mayRead) {
        return json(res, 403, {
          ok: false,
          error: 'classification_restricted',
          classification: quoteSystem.configuration_classification
        });
      }

      return json(res, 200, {
        ok: true,
        admin: serializeAdminConfig(configVersion, quoteSystem)
      });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const siteId = clean(body.site_id, 80);
      if (!siteId) return json(res, 400, { ok: false, error: 'site_id_required' });

      const access = await assertSiteAccess(user, siteId);
      if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

      const isSuper = await isSuperAdmin(user.id);
      let quoteSystem = await getQuoteSystemForSite(siteId);
      if (!quoteSystem) {
        quoteSystem = await ensureQuoteSystem(siteId, CONFIG_CLASSIFICATION.BLANK);
      }

      if (!canWriteConfig(quoteSystem, { isSuper })) {
        return json(res, 403, { ok: false, error: 'write_restricted' });
      }

      const admin = getAdmin();
      const { data: siteRow } = await admin.from('sites').select('slug').eq('id', siteId).maybeSingle();
      const siteSlug = (siteRow && siteRow.slug) || '';
      const shouldProvisionBeanCulture = isSuper && (
        body.provision === 'bean-culture' ||
        (body.enabled && siteSlug === BEAN_CULTURE_SLUG)
      );

      if (shouldProvisionBeanCulture) {
        const result = await provisionBeanCultureConfig(quoteSystem.id, user.id);
        quoteSystem = result.quoteSystem;
      } else {
        const patch = {};
        if (body.enabled !== undefined) patch.enabled = !!body.enabled;

        if (body.config && typeof body.config === 'object') {
          const configVersion = await insertConfigVersion(
            quoteSystem.id,
            body.config,
            user.id,
            clean(body.label, 120) || null
          );
          quoteSystem.active_config_version_id = configVersion.id;
        }

        if (Object.keys(patch).length) {
          const { data } = await admin.from('quote_systems')
            .update(patch)
            .eq('id', quoteSystem.id)
            .select('*')
            .single();
          if (data) quoteSystem = data;
        }
      }

      const active = await getActiveConfig(quoteSystem);
      return json(res, 200, {
        ok: true,
        admin: serializeAdminConfig(active, quoteSystem)
      });
    }

    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch (e) {
    console.error('quote-system/admin/config:', e && e.message);
    const msg = String(e && e.message || e);
    if (/relation.*quote_systems.*does not exist/i.test(msg)) {
      return json(res, 503, { ok: false, error: 'schema_missing', message: 'Run db/quote_systems_schema.sql in Supabase first.' });
    }
    return json(res, 500, { ok: false, error: 'server_error', message: msg });
  }
};
