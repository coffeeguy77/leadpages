/**
 * Marketplace static data — require() so Vercel bundles JSON into serverless functions.
 * Do not read these files with fs.readFileSync in API routes.
 */
module.exports = {
  appContent: require('../marketplace/app-content.json'),
  sellTemplates: require('../marketplace/sell-templates.json'),
  defaultConfigs: require('../marketplace/playground-default-configs.json'),
  fieldDefs: require('../marketplace/playground-field-defs.json'),
  demoSites: require('../marketplace/demo-sites.json'),
  filePresets: {
    aam1: require('../playground/aam1.json'),
    'trustbar-aam1': require('../playground/trustbar-aam1.json'),
    'trustbar-accountant': require('../playground/trustbar-accountant.json'),
    'trustbar-bean-culture': require('../playground/trustbar-bean-culture.json'),
    'trustbar-beauty': require('../playground/trustbar-beauty.json'),
    'trustbar-builder': require('../playground/trustbar-builder.json'),
    'trustbar-cafe-badges': require('../playground/trustbar-cafe-badges.json'),
    'trustbar-cafe-images': require('../playground/trustbar-cafe-images.json'),
    'trustbar-carpenter-badges': require('../playground/trustbar-carpenter-badges.json'),
    'trustbar-carpenter-images': require('../playground/trustbar-carpenter-images.json'),
    'trustbar-electrician': require('../playground/trustbar-electrician.json'),
    'trustbar-event-hire': require('../playground/trustbar-event-hire.json'),
    'trustbar-landscaper-badges': require('../playground/trustbar-landscaper-badges.json'),
    'trustbar-landscaper-images': require('../playground/trustbar-landscaper-images.json'),
    'trustbar-medical': require('../playground/trustbar-medical.json'),
    'trustbar-plumber': require('../playground/trustbar-plumber.json'),
    'trustbar-rendering': require('../playground/trustbar-rendering.json'),
    'trustbar-restaurant': require('../playground/trustbar-restaurant.json'),
    'ssb-veterans-cycling': require('../playground/ssb-veterans-cycling.json')
  },
  marketplaceVisuals: require('../marketplace/marketplace-visuals.json'),
  trustBarV2: require('../marketplace/trust-bar-v2.json'),
  scrollingSponsorBannerV2: require('../marketplace/scrolling-sponsor-banner-v2.json')
};
