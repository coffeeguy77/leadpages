'use strict';

/**
 * Modelled schema.org JSON-LD patches for Leadpages sites.
 * Apply only with human confirmation — never silent publish.
 */

function faqItemsFromConfig(cfg) {
  const faq =
    (cfg && cfg.sections && cfg.sections.faq && Array.isArray(cfg.sections.faq.items) && cfg.sections.faq.items) ||
    (cfg && Array.isArray(cfg.faqs) && cfg.faqs) ||
    [];
  return faq
    .map(function (f) {
      const q = String((f && (f.q || f.question || f.title)) || '').trim();
      const a = String((f && (f.a || f.answer || f.body)) || '').trim();
      if (!q || !a) return null;
      return {
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a }
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

function areaServed(cfg) {
  const areas =
    (cfg &&
      cfg.sections &&
      cfg.sections.serviceAreas &&
      Array.isArray(cfg.sections.serviceAreas.areas) &&
      cfg.sections.serviceAreas.areas) ||
    [];
  const labels = areas
    .map(function (a) {
      return typeof a === 'string' ? a : (a && (a.name || a.suburb || a.label)) || '';
    })
    .filter(Boolean)
    .slice(0, 12);
  if (labels.length) return labels;
  if (cfg && cfg.region) return [String(cfg.region)];
  return ['Australia'];
}

function tradeType(cfg) {
  const trade = String((cfg && cfg.trade) || '').toLowerCase();
  if (trade.indexOf('plumb') >= 0) return 'Plumber';
  if (trade.indexOf('elect') >= 0) return 'Electrician';
  if (trade.indexOf('hvac') >= 0 || trade.indexOf('air con') >= 0) return 'HVACBusiness';
  if (trade.indexOf('roof') >= 0) return 'RoofingContractor';
  if (trade.indexOf('broker') >= 0 || trade.indexOf('mortgage') >= 0) return 'FinancialService';
  return 'LocalBusiness';
}

/**
 * Build modelled JSON-LD graph from site facts only (no invented ratings).
 */
function buildSchemaPatch(site, opts) {
  const o = opts || {};
  const cfg = (site && site.config) || {};
  const name = (site && site.business_name) || cfg.business || cfg.name || 'Business';
  const phone = cfg.phone || cfg.phoneText || null;
  const email = cfg.email || null;
  const url = o.canonicalUrl || null;
  const type = tradeType(cfg);

  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': type,
    name: name,
    areaServed: areaServed(cfg)
  };
  if (phone) localBusiness.telephone = phone;
  if (email) localBusiness.email = email;
  if (url) localBusiness.url = url;
  if (cfg.region) {
    localBusiness.address = {
      '@type': 'PostalAddress',
      addressLocality: String(cfg.region),
      addressCountry: 'AU'
    };
  }

  const blocks = [
    {
      id: 'local_business',
      title: 'Local business markup',
      plainLanguage: 'Helps Google understand who you are and where you serve.',
      jsonLd: localBusiness
    }
  ];

  const faqs = faqItemsFromConfig(cfg);
  if (faqs.length) {
    blocks.push({
      id: 'faq_page',
      title: 'FAQ markup',
      plainLanguage: 'Marks your FAQ answers so they can appear as rich results when eligible.',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs
      }
    });
  }

  const existing = Array.isArray(cfg.seoJsonLd) ? cfg.seoJsonLd : [];
  const existingTypes = existing
    .map(function (b) {
      return b && b['@type'];
    })
    .filter(Boolean);

  return {
    ok: true,
    siteId: site && site.id,
    blocks: blocks,
    existingCount: existing.length,
    existingTypes: existingTypes,
    missing: blocks
      .filter(function (b) {
        const t = b.jsonLd && b.jsonLd['@type'];
        return t && existingTypes.indexOf(t) < 0;
      })
      .map(function (b) {
        return b.id;
      }),
    safeguards: {
      publishAllowed: false,
      autoFixAllowed: false,
      requiresHumanApproval: true,
      note: 'Preview only until you Apply. Does not invent ratings, reviews, or licences.'
    },
    labelClass: 'modelled',
    generatedAt: new Date().toISOString()
  };
}

/**
 * Pure merge: return new config object with seoJsonLd set from selected blocks.
 */
function applySchemaPatchToConfig(config, patch, opts) {
  const o = opts || {};
  const cfg = Object.assign({}, config || {});
  const selected = Array.isArray(o.blockIds) && o.blockIds.length
    ? o.blockIds
    : (patch.blocks || []).map(function (b) {
        return b.id;
      });
  const jsonLd = (patch.blocks || [])
    .filter(function (b) {
      return selected.indexOf(b.id) >= 0;
    })
    .map(function (b) {
      return b.jsonLd;
    });
  cfg.seoJsonLd = jsonLd;
  cfg.seoJsonLdUpdatedAt = new Date().toISOString();
  return cfg;
}

module.exports = {
  buildSchemaPatch: buildSchemaPatch,
  applySchemaPatchToConfig: applySchemaPatchToConfig,
  faqItemsFromConfig: faqItemsFromConfig,
  tradeType: tradeType
};
