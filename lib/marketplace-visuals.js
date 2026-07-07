/**
 * Resolve category hero images and in-page screenshot blocks for marketplace apps.
 */
const { categoryForSection } = require('./marketplace-categories');
const visuals = require('../marketplace/marketplace-visuals.json');

function pick(obj, key) {
  const v = obj && obj[key];
  if (!v || !v.url) return null;
  return { url: v.url, alt: v.alt || '', caption: v.caption || '' };
}

function getCategoryHero(sectionKey, meta) {
  if (meta && meta.heroImage && meta.heroImage.url) return meta.heroImage;
  const cat = categoryForSection(sectionKey);
  return pick(visuals.categoryHeroImages, cat);
}

function getScreenshot(sectionKey, meta) {
  if (meta && meta.screenshot && meta.screenshot.url) return meta.screenshot;
  const specific = pick(visuals.sectionScreenshots, sectionKey);
  if (specific) return specific;
  const cat = categoryForSection(sectionKey);
  return pick(visuals.categoryScreenshots, cat);
}

function screenshotBlock(sectionKey, meta, appName) {
  const shot = getScreenshot(sectionKey, meta);
  if (!shot) return null;
  return {
    block_type: 'image',
    payload: {
      url: shot.url,
      alt: shot.alt || (appName + ' on a trade site'),
      caption: shot.caption || ('How ' + (appName || 'this app') + ' looks on a published LeadPages site.')
    }
  };
}

module.exports = {
  getCategoryHero,
  getScreenshot,
  screenshotBlock
};
