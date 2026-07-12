#!/usr/bin/env node
/**
 * Seed Web Culture Partner Website profile for the test partner (Shaun Matthews).
 *
 * Usage:
 *   node scripts/seed-web-culture-partner-profile.js
 *   node scripts/seed-web-culture-partner-profile.js --dry-run
 *   node scripts/seed-web-culture-partner-profile.js --slug=partners-website
 *   node scripts/seed-web-culture-partner-profile.js --partner-id=<uuid>
 */
try { require('dotenv').config({ path: '.env.local' }); require('dotenv').config(); } catch (_e) {}

const { createClient } = require('@supabase/supabase-js');
const { validateWebsiteProfile } = require('../lib/partner-website/validate');
const { saveWebsiteProfile } = require('../lib/partner-website/profile-store');
const { extractLogoValue } = require('../lib/partner-website/logo');
const {
  buildWebCultureWebsiteProfile,
  buildWebCultureShowcasePatch
} = require('../lib/partner-website/web-culture-profile');

const dryRun = process.argv.includes('--dry-run');
const slugArg = process.argv.find(function(a) { return a.startsWith('--slug='); });
const partnerArg = process.argv.find(function(a) { return a.startsWith('--partner-id='); });
const targetSlug = slugArg ? slugArg.split('=')[1] : null;
const targetPartnerId = partnerArg ? partnerArg.split('=')[1] : null;

const SEARCH_NAMES = ['Shaun Matthews', 'Web Culture', 'Partners Website'];

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const admin = createClient(url, key);

  let partner = null;
  let prof = null;

  if (targetPartnerId) {
    const pr = await admin.from('partners').select('id,display_name,email,phone,status').eq('id', targetPartnerId).maybeSingle();
    partner = pr.data;
    if (partner) {
      const pf = await admin.from('partner_profiles').select('*').eq('partner_id', partner.id).maybeSingle();
      prof = pf.data;
    }
  } else if (targetSlug) {
    const pf = await admin.from('partner_profiles').select('*,partners(id,display_name,email,phone,status)').ilike('showcase_slug', targetSlug).maybeSingle();
    prof = pf.data;
    partner = prof && prof.partners ? prof.partners : null;
  } else {
    for (const term of SEARCH_NAMES) {
      const pr = await admin.from('partners').select('id,display_name,email,phone,status').ilike('display_name', '%' + term + '%').limit(5);
      if (pr.data && pr.data.length) {
        partner = pr.data[0];
        break;
      }
    }
    if (!partner) {
      const pf = await admin.from('partner_profiles').select('partner_id,showcase_slug,showcase_headline').ilike('showcase_headline', '%Partners Website%').limit(5);
      if (pf.data && pf.data.length) {
        const p2 = await admin.from('partners').select('id,display_name,email,phone,status').eq('id', pf.data[0].partner_id).maybeSingle();
        partner = p2.data;
      }
    }
    if (partner) {
      const pf = await admin.from('partner_profiles').select('*').eq('partner_id', partner.id).maybeSingle();
      prof = pf.data;
    }
  }

  if (!partner) {
    console.error('Could not find test partner. Use --partner-id= or --slug= to target explicitly.');
    process.exit(1);
  }

  const websiteProfile = validateWebsiteProfile(buildWebCultureWebsiteProfile());
  const showcasePatch = buildWebCultureShowcasePatch();
  const existingCfg = (prof && prof.showcase_config) || {};
  const preservedLogo = extractLogoValue(existingCfg.logo);

  console.log('Partner:', partner.display_name, '(' + partner.id + ')');
  console.log('Showcase slug:', prof && prof.showcase_slug ? prof.showcase_slug : '(none)');
  console.log('Template:', showcasePatch.showcase_config.templateKey);
  console.log('Agency:', websiteProfile.identity.agencyName);
  console.log('FAQs:', websiteProfile.partnerFaqs.length, 'partner + platform appended at render');
  console.log('Services enabled:', websiteProfile.serviceSelections.filter(function(s) { return s.enabled; }).length);

  if (dryRun) {
    console.log('\nDry run — no database writes.');
    return;
  }

  const now = new Date().toISOString();
  const saved = await saveWebsiteProfile(admin, partner.id, websiteProfile, now);
  if (!saved.ok) {
    console.error('Failed to save website_profile:', saved.error);
    process.exit(1);
  }

  const profileUpdate = {
    showcase_headline: showcasePatch.showcase_headline,
    showcase_config: Object.assign({}, existingCfg, showcasePatch.showcase_config, {
      websiteProfile: websiteProfile,
      logo: preservedLogo || existingCfg.logo || null
    }),
    updated_at: now
  };
  const up = await admin.from('partner_profiles').update(profileUpdate).eq('partner_id', partner.id);
  if (up.error) {
    console.error('Failed to update showcase fields:', up.error);
    process.exit(1);
  }

  console.log('\nWeb Culture profile seeded successfully.');
  if (prof && prof.showcase_slug) {
    console.log('Preview: https://leadpages.com.au/' + prof.showcase_slug + '?tpl=causehouse');
  }
}

main().catch(function(err) {
  console.error(err);
  process.exit(1);
});
