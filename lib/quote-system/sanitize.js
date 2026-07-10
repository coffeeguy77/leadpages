/**
 * Online Quote System — duplication guards for site config copies.
 * Never copy onlineQuote section bindings or enabled state across tenants.
 */

const { SECTION_KEY } = require('./billing');

const STRIP_SECTION_KEYS = new Set([SECTION_KEY]);

function sanitizeSiteConfig(cfg) {
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return cfg;
  const out = Object.assign({}, cfg);

  if (out.sections && typeof out.sections === 'object') {
    const sections = Object.assign({}, out.sections);
    STRIP_SECTION_KEYS.forEach(function(key) {
      if (!sections[key] || typeof sections[key] !== 'object') return;
      const sec = Object.assign({}, sections[key]);
      sec.on = false;
      delete sec.__ghost;
      delete sec.quoteSystemId;
      delete sec.quote_system_id;
      sections[key] = sec;
    });
    out.sections = sections;
  }

  delete out.quoteSystemId;
  delete out.quote_system_id;

  if (Array.isArray(out.sectionOrder)) {
    out.sectionOrder = out.sectionOrder.slice();
  }

  return out;
}

function shouldSkipTemplateApp(sectionKey) {
  return STRIP_SECTION_KEYS.has(sectionKey);
}

module.exports = {
  SECTION_KEY,
  sanitizeSiteConfig,
  shouldSkipTemplateApp
};
