const fs = require('node:fs');
const path = require('node:path');
const { buildPartnerLandingHtml } = require('../../lib/partner-templates');
const { buildLocalWebsiteCoWebsiteProfile } = require('../../lib/partner-website/local-website-co-profile');
const { validateWebsiteProfile } = require('../../lib/partner-website/validate');

const websiteProfile = validateWebsiteProfile(buildLocalWebsiteCoWebsiteProfile());

const prof = {
  partner_id: 'preview-localwebsiteco',
  showcase_slug: 'local-website-co',
  showcase_headline: websiteProfile.positioning.heroHeadline,
  support_email: 'shaun@localwebsiteco.example',
  support_phone: '0414 631 463',
  showcase_config: {
    templateKey: 'localwebsiteco',
    intro: websiteProfile.positioning.heroSupporting,
    websiteProfile: websiteProfile
  }
};

const partner = {
  id: 'preview-localwebsiteco',
  display_name: 'Shaun Matthews',
  email: 'shaun@localwebsiteco.example',
  phone: '0414 631 463'
};

/* Empty demos → theme FALLBACK_DEMOS (partners1 required six). */
const html = buildPartnerLandingHtml(prof, partner, [], 'leadpages.com.au', {
  templateOverride: 'localwebsiteco',
  showTemplateSwitcher: false
});

fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('Wrote ' + path.join(__dirname, 'index.html'));
