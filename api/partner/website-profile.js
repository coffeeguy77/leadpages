// GET/POST /api/partner/website-profile — structured Partner Website profile
// Super-admins may act as a partner via ?partner_id= / body.partner_id.
const { validateWebsiteProfile, mergeWebsiteProfilePatch } = require('../../lib/partner-website/validate');
const { computeProfileCompletion } = require('../../lib/partner-website/completion');
const { resolvePartnerThemeContent, PLATFORM_SERVICES, ENQUIRY_GOALS, ENQUIRY_FEATURES } = require('../../lib/partner-website/resolver');
const { PLATFORM_FAQS } = require('../../lib/partner-website/platform-defaults');
const { websiteProfileFromRow, saveWebsiteProfile } = require('../../lib/partner-website/profile-store');
const { normalizeLogoForStorage } = require('../../lib/partner-website/logo');
const { isSparseWebsiteProfile, buildCultureStarterProfile } = require('../../lib/partner-website/culture-starter');
const { INDUSTRY_TABS } = require('../../lib/partner-website/webculture-theme');
const { admin, resolvePartnerActor } = require('../../lib/partner/resolve-actor');

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function ensureProfile(partnerId) {
  const profRow = await admin.from('partner_profiles').select('*').eq('partner_id', partnerId).maybeSingle();
  let prof = profRow.data;
  if (!prof) {
    const ins = await admin.from('partner_profiles').insert({ partner_id: partnerId }).select('*').single();
    prof = ins.data;
  }
  return prof;
}

async function listShowcaseSites(partnerId) {
  const rows = (await admin.from('sites')
    .select('id,slug,business_name,is_mockup,is_partner_home,show_on_showcase,status,config')
    .or('servicing_partner_id.eq.' + partnerId + ',referring_partner_id.eq.' + partnerId + ',commission_partner_id.eq.' + partnerId)
    .order('created_at', { ascending: false })
    .limit(200)).data || [];
  return rows
    .filter(function(s) { return !s.is_partner_home; })
    .map(function(s) {
      const cfg = s.config || {};
      return {
        id: s.id,
        slug: s.slug,
        business_name: s.business_name,
        is_mockup: !!s.is_mockup,
        show_on_showcase: !!s.show_on_showcase,
        status: s.status,
        trade: String(cfg.trade || '').trim() || null
      };
    });
}

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');

  let body = {};
  if (req.method === 'POST') body = await readBody(req);

  const actor = await resolvePartnerActor(req, { body: body });
  if (actor.error) return res.status(actor.error.status).json(actor.error.body);
  const partner = actor.partner;

  const prof = await ensureProfile(partner.id);
  const directory = (await admin.from('partner_directory').select('*').eq('partner_id', partner.id).maybeSingle()).data;
  const currentWp = websiteProfileFromRow(prof) || {};

  if (req.method === 'GET') {
    let wp = validateWebsiteProfile(currentWp);
    let seeded = false;
    if (isSparseWebsiteProfile(wp)) {
      wp = validateWebsiteProfile(mergeWebsiteProfilePatch(buildCultureStarterProfile(partner, directory), currentWp));
      seeded = true;
    }
    const content = resolvePartnerThemeContent({
      prof: Object.assign({}, prof, {
        showcase_config: Object.assign({}, (prof && prof.showcase_config) || {}, {
          templateKey: 'webculture',
          websiteProfile: wp
        })
      }),
      partner: partner,
      directory: directory,
      demos: [],
      base: 'leadpages.com.au',
      home: null
    });
    const completion = computeProfileCompletion(content);
    const showcaseSites = await listShowcaseSites(partner.id);
    return res.status(200).json({
      ok: true,
      as_admin: !!actor.asAdmin,
      partner: { id: partner.id, display_name: partner.display_name, status: partner.status },
      profile: prof,
      websiteProfile: wp,
      seededFromCultureDemo: seeded,
      resolvedPreview: content,
      completion,
      showcaseSites: showcaseSites,
      industryTabDefaults: INDUSTRY_TABS.map(function(t) { return { key: t.key, label: t.label }; }),
      platform: {
        services: PLATFORM_SERVICES,
        faqs: PLATFORM_FAQS,
        enquiryGoals: ENQUIRY_GOALS,
        enquiryFeatures: ENQUIRY_FEATURES
      }
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'GET or POST only' });

  const section = String(body.section || 'all').trim();
  const patch = body.websiteProfile || body.profile || body;

  let current = validateWebsiteProfile(currentWp);
  if (section !== 'all') {
    current = mergeWebsiteProfilePatch(current, { [section]: patch });
  } else {
    current = mergeWebsiteProfilePatch(current, patch);
  }

  const validated = validateWebsiteProfile(current);
  const now = new Date().toISOString();
  const saved = await saveWebsiteProfile(admin, partner.id, validated, now);
  if (!saved.ok) return res.status(500).json({ ok: false, error: 'Could not save profile.' });

  const identityTouched = section === 'all' || section === 'identity' || !!(patch && patch.identity);
  if (identityTouched) {
    const cur = await admin.from('partner_profiles').select('showcase_config').eq('partner_id', partner.id).maybeSingle();
    const cfg = Object.assign({}, (cur.data && cur.data.showcase_config) || {});
    const profileLogo = normalizeLogoForStorage(validated.identity && validated.identity.logoUrl);
    if (profileLogo) cfg.logo = profileLogo;
    else delete cfg.logo;
    const logoUp = await admin.from('partner_profiles').update({ showcase_config: cfg, updated_at: now }).eq('partner_id', partner.id).select('*').single();
    if (!logoUp.error && logoUp.data) saved.profile = logoUp.data;
  }

  const content = resolvePartnerThemeContent({ prof: saved.profile, partner, directory, demos: [], base: 'leadpages.com.au', home: null });
  return res.status(200).json({
    ok: true,
    as_admin: !!actor.asAdmin,
    profile: saved.profile,
    websiteProfile: validated,
    completion: computeProfileCompletion(content),
    storedInShowcaseConfig: !!saved.storedInShowcaseConfig
  });
};
