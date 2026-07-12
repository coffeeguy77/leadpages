// GET/POST /api/partner/website-profile — structured Partner Website profile
const { createClient } = require('@supabase/supabase-js');
const { validateWebsiteProfile, mergeWebsiteProfilePatch } = require('../../lib/partner-website/validate');
const { computeProfileCompletion } = require('../../lib/partner-website/completion');
const { resolvePartnerThemeContent, PLATFORM_SERVICES, ENQUIRY_GOALS, ENQUIRY_FEATURES } = require('../../lib/partner-website/resolver');
const { PLATFORM_FAQS } = require('../../lib/partner-website/platform-defaults');
const { websiteProfileFromRow, saveWebsiteProfile } = require('../../lib/partner-website/profile-store');
const { extractLogoValue, normalizeLogoForStorage } = require('../../lib/partner-website/logo');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch (_e) { return null; }
}

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

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');

  const user = await getUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const pr = await admin.from('partners').select('id,display_name,email,phone,status').eq('user_id', user.id).maybeSingle();
  const partner = pr.data;
  if (!partner) return res.status(403).json({ ok: false, error: 'not a partner' });
  if (partner.status !== 'active') return res.status(403).json({ ok: false, error: 'partner account is ' + partner.status });

  const profRow = await admin.from('partner_profiles').select('*').eq('partner_id', partner.id).maybeSingle();
  let prof = profRow.data;
  if (!prof) {
    const ins = await admin.from('partner_profiles').insert({ partner_id: partner.id }).select('*').single();
    prof = ins.data;
  }

  const directory = (await admin.from('partner_directory').select('*').eq('partner_id', partner.id).maybeSingle()).data;
  const currentWp = websiteProfileFromRow(prof) || {};

  if (req.method === 'GET') {
    const content = resolvePartnerThemeContent({ prof, partner, directory, demos: [], base: 'leadpages.com.au', home: null });
    const completion = computeProfileCompletion(content);
    return res.status(200).json({
      ok: true,
      profile: prof,
      websiteProfile: validateWebsiteProfile(currentWp),
      resolvedPreview: content,
      completion,
      platform: {
        services: PLATFORM_SERVICES,
        faqs: PLATFORM_FAQS,
        enquiryGoals: ENQUIRY_GOALS,
        enquiryFeatures: ENQUIRY_FEATURES
      }
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'GET or POST only' });

  const body = await readBody(req);
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
    profile: saved.profile,
    websiteProfile: validated,
    completion: computeProfileCompletion(content),
    storedInShowcaseConfig: !!saved.storedInShowcaseConfig
  });
};
