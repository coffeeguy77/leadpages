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
  support_phone: '0400 000 000',
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
  phone: '0400 000 000'
};

const demos = [
  {
    id: 'demo-flow-pro',
    slug: 'flow-pro-plumbing',
    business_name: 'Flow Pro Plumbing',
    config: {
      trade: 'Trades',
      showcase: {
        image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=900&q=80'
      },
      scope: {
        description: 'A mobile-first plumbing website built for urgent calls and quote requests.'
      }
    },
    is_mockup: true,
    show_on_showcase: true
  },
  {
    id: 'demo-brightline',
    slug: 'brightline-electrical',
    business_name: 'Brightline Electrical',
    config: {
      trade: 'Trades',
      showcase: {
        image: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=900&q=80'
      },
      scope: {
        description: 'Clear services, fast contact options and local trust signals for electrical work.'
      }
    },
    is_mockup: true,
    show_on_showcase: true
  },
  {
    id: 'demo-corner-table',
    slug: 'corner-table-cafe',
    business_name: 'Corner Table Cafe',
    config: {
      trade: 'Hospitality',
      showcase: {
        image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=900&q=80'
      },
      scope: {
        description: 'A warm venue website with menus, photos and booking-friendly enquiry paths.'
      }
    },
    is_mockup: true,
    show_on_showcase: true
  }
];

const html = buildPartnerLandingHtml(prof, partner, demos, 'leadpages.com.au', {
  templateOverride: 'localwebsiteco',
  showTemplateSwitcher: false
});

fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('Wrote ' + path.join(__dirname, 'index.html'));
