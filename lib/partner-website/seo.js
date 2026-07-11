/**
 * SEO metadata for Partner Website pages.
 */

const { esc } = require('../partner-templates/shared');

function buildSeoMeta(content, base) {
  content = content || {};
  const partner = content.partner || {};
  const hero = content.hero || {};
  const location = content.serviceArea || {};
  const region = location.primaryRegion || 'your area';
  const name = partner.displayName || 'LeadPages Partner';
  const agency = partner.agencyName || name;

  const defaultTitle = 'Website Design in ' + region + ' | ' + name + ' — LeadPages Partner';
  const defaultDesc = 'Work directly with ' + name + ', your local LeadPages website partner in ' + region + '. Explore live demos and plan a professional website for your business.';

  const title = (content.seo && content.seo.title) || defaultTitle;
  const description = (content.seo && content.seo.description) || hero.supportingText || defaultDesc;
  const slug = content.meta && content.meta.websiteSlug;
  const canonical = slug ? 'https://' + base + '/' + encodeURIComponent(slug) : '';
  const ogImage = (content.seo && content.seo.ogImage) || partner.headshotUrl || partner.logoUrl || '';

  let jsonLd = [];
  if (name && region) {
    const localBusiness = {
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: agency,
      description: description.slice(0, 300),
      areaServed: (location.areas || []).map(function(a) { return a.label; }).slice(0, 8),
      url: canonical || undefined
    };
    if (content.contact && content.contact.email) localBusiness.email = content.contact.email;
    if (content.contact && content.contact.phone) localBusiness.telephone = content.contact.phone;
    jsonLd.push(localBusiness);

    if (partner.headshotUrl || biographyPresent(content)) {
      jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: name,
        jobTitle: 'LeadPages Partner',
        worksFor: { '@type': 'Organization', name: agency },
        areaServed: region
      });
    }
  }

  return {
    title: title,
    description: description.slice(0, 200),
    canonical: canonical,
    ogTitle: title,
    ogDescription: description.slice(0, 200),
    ogImage: ogImage,
    jsonLd: jsonLd
  };
}

function biographyPresent(content) {
  const b = content.biography || {};
  return !!(b.shortIntro || b.fullBio);
}

function seoHeadHtml(seo) {
  if (!seo) return '';
  let html = '';
  if (seo.canonical) html += '<link rel="canonical" href="' + esc(seo.canonical) + '">';
  html += '<meta property="og:type" content="website">';
  html += '<meta property="og:title" content="' + esc(seo.ogTitle) + '">';
  html += '<meta property="og:description" content="' + esc(seo.ogDescription) + '">';
  if (seo.canonical) html += '<meta property="og:url" content="' + esc(seo.canonical) + '">';
  if (seo.ogImage) html += '<meta property="og:image" content="' + esc(seo.ogImage) + '">';
  html += '<meta name="twitter:card" content="summary_large_image">';
  if (seo.jsonLd && seo.jsonLd.length) {
    html += '<script type="application/ld+json">' + JSON.stringify(seo.jsonLd.length === 1 ? seo.jsonLd[0] : seo.jsonLd) + '</script>';
  }
  return html;
}

module.exports = { buildSeoMeta, seoHeadHtml };
