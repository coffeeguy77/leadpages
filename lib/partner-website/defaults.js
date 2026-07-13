/**
 * Default positioning copy from verified partner fields.
 */

function firstName(displayName) {
  const n = String(displayName || '').trim();
  if (!n) return 'your partner';
  return n.split(/\s+/)[0];
}

function primaryRegion(location, prof, directory) {
  const areas = (location && location.serviceAreas) || [];
  if (areas.length) {
    const city = areas.find(function(a) { return a && a.label && /canberra|sydney|melbourne|brisbane|perth|adelaide|hobart|darwin/i.test(a.label); });
    if (city) return city.label;
    const suburb = location && location.primarySuburb;
    if (suburb) {
      const match = areas.find(function(a) { return a && a.label && a.label.toLowerCase() !== suburb.toLowerCase(); });
      if (match) return match.label;
    }
    return areas[0].label;
  }
  if (location && location.primarySuburb) {
    const st = location.state ? ' ' + location.state : '';
    return location.primarySuburb + st;
  }
  if (prof && prof.region) return String(prof.region).trim();
  if (directory && directory.suburb) {
    return directory.suburb + (directory.state ? ', ' + directory.state : '');
  }
  return 'your area';
}

function serviceRegionLabel(location) {
  const areas = (location && location.serviceAreas) || [];
  if (areas.length) {
    return areas.map(function(a) { return a.label; }).slice(0, 6).join(', ');
  }
  return primaryRegion(location);
}

function applyTemplate(str, vars) {
  if (!str) return '';
  return String(str)
    .replace(/\{\{partnerDisplayName\}\}/g, vars.partnerDisplayName || '')
    .replace(/\{\{firstName\}\}/g, vars.firstName || '')
    .replace(/\{\{agencyName\}\}/g, vars.agencyName || '')
    .replace(/\{\{primaryRegion\}\}/g, vars.primaryRegion || '')
    .replace(/\{\{primarySuburb\}\}/g, vars.primarySuburb || '')
    .replace(/\{\{serviceRegion\}\}/g, vars.serviceRegion || '');
}

function buildDefaultPositioning(vars) {
  return {
    heroEyebrow: 'YOUR LOCAL LEADPAGES PARTNER',
    heroHeadline: 'Websites built for local businesses.',
    heroHighlight: 'Personal support. Powerful systems.',
    heroSupporting: applyTemplate(
      'Work directly with {{firstName}}, your local website partner in {{primarySuburb}}. Get a professionally built website, live demos you can explore, and ongoing support from someone who understands your business.',
      vars
    ),
    primaryCta: 'Plan my website',
    secondaryCta: 'Explore live demos',
    partnerPromise: 'Local service, personal support, and powerful website infrastructure backed by LeadPages.',
    personalServiceStatement: applyTemplate(
      '{{firstName}} is your direct contact — from first conversation through launch and beyond.',
      vars
    ),
    localCredibilityStatement: applyTemplate(
      'Supporting businesses across {{serviceRegion}} with websites designed to generate real enquiries.',
      vars
    ),
    platformBackingStatement: 'Your local partner manages strategy, content, and setup. LeadPages provides secure hosting, technical infrastructure, backups, and central platform support behind every site.'
  };
}

function buildDefaultBiography(vars, experience) {
  const exp = (experience && experience.yearsInWeb) || (experience && experience.yearsInBusiness) || '';
  const expPart = exp ? ' With experience in ' + exp + ',' : '';
  return applyTemplate(
    '{{agencyName}} works directly with businesses across {{serviceRegion}} to plan, launch, and improve professional websites.' + expPart + ' {{firstName}} helps business owners turn their services into clear, credible websites designed to generate enquiries.',
    vars
  );
}

module.exports = {
  firstName,
  primaryRegion,
  serviceRegionLabel,
  applyTemplate,
  buildDefaultPositioning,
  buildDefaultBiography
};
