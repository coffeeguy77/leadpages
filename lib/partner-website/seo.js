/**
 * SEO metadata for Partner Website pages.
 */

const { esc } = require('../partner-templates/shared');
const { publicPhotoAlt } = require('./public-identity');

function buildSeoMeta(content, base) {
  content = content || {};
  const partner = content.partner || {};
  const hero = content.hero || {};
  const location = content.serviceArea || {};
  const region = location.primaryRegion || 'your area';
  const agency = partner.agencyName || 'LeadPages Partner';
  const publicName = partner.publicName || partner.firstName || 'your local LeadPages Partner';
  const profileSeo = content.profileSeo || {};

  const defaultTitle = agency
    ? 'Website Design in ' + region + ' | ' + agency + ' — LeadPages Partner'
    : 'Website Design in ' + region + ' | LeadPages Partner';
  const defaultDesc = agency
    ? 'Work directly with ' + agency + ', your local LeadPages website partner in ' + region + '. Explore live demos and plan a professional website for your business.'
    : 'Work directly with ' + publicName + ', your local LeadPages website partner in ' + region + '. Explore live demos and plan a professional website for your business.';

  const title = profileSeo.titleOverride || (content.seo && content.seo.title) || defaultTitle;
  const description = profileSeo.descriptionOverride
    || (content.seo && content.seo.description)
    || hero.supportingText
    || defaultDesc;
  const slug = content.meta && content.meta.websiteSlug;
  const canonical = slug ? 'https://' + base + '/' + encodeURIComponent(slug) : '';
  const ogImage = profileSeo.ogImage || (content.seo && content.seo.ogImage) || partner.logoUrl || partner.headshotUrl || '';

  let jsonLd = [];
  if (agency && region) {
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
      const personName = publicPhotoAlt(partner.displayName, agency, { displaySurnamePublicly: false });
      jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: personName,
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
