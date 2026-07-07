/**
 * Marketplace static data — require() so Vercel bundles JSON into serverless functions.
 * Do not read these files with fs.readFileSync in API routes.
 */
module.exports = {
  appContent: require('../marketplace/app-content.json'),
  sellTemplates: require('../marketplace/sell-templates.json'),
  defaultConfigs: require('../marketplace/playground-default-configs.json'),
  fieldDefs: require('../marketplace/playground-field-defs.json'),
  filePresets: {
    aam1: require('../playground/aam1.json')
  },
  marketplaceVisuals: require('../marketplace/marketplace-visuals.json')
};
