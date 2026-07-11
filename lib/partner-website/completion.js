/**
 * Profile completion score for Partner Website admin.
 */

function scoreGroup(done, total) {
  if (!total) return 100;
  return Math.round((done / total) * 100);
}

function computeProfileCompletion(content) {
  content = content || {};
  const groups = [];
  const actions = [];

  const partner = content.partner || {};
  const biography = content.biography || {};
  const contact = content.contact || {};
  const location = content.serviceArea || {};
  const demos = content.demos || [];
  const services = content.services || [];
  const testimonials = content.testimonials || [];

  let identityDone = 0; let identityTotal = 4;
  if (partner.displayName) identityDone++;
  else actions.push({ key: 'display-name', label: 'Add your display name' });
  if (partner.agencyName || partner.displayName) identityDone++;
  else actions.push({ key: 'agency-name', label: 'Add your agency name' });
  if (partner.logoUrl) identityDone++;
  else actions.push({ key: 'logo', label: 'Upload your agency logo' });
  if (partner.headshotUrl) identityDone++;
  else actions.push({ key: 'headshot', label: 'Add a profile photo' });
  groups.push({ key: 'identity', label: 'Identity', percent: scoreGroup(identityDone, identityTotal) });

  let contactDone = 0; let contactTotal = 3;
  if (contact.email) contactDone++;
  else actions.push({ key: 'email', label: 'Add a public email address' });
  if (contact.phone) contactDone++;
  else actions.push({ key: 'phone', label: 'Add a direct phone number' });
  if (contact.responseTime || contact.contactHours) contactDone++;
  groups.push({ key: 'contact', label: 'Contact details', percent: scoreGroup(contactDone, contactTotal) });

  let locDone = 0; let locTotal = 2;
  if (location.primaryRegion) locDone++;
  else actions.push({ key: 'region', label: 'Add your service region' });
  if ((location.areas || []).length) locDone++;
  else actions.push({ key: 'areas', label: 'Add your service areas' });
  groups.push({ key: 'location', label: 'Location', percent: scoreGroup(locDone, locTotal) });

  let bioDone = 0; let bioTotal = 2;
  if (biography.shortIntro) bioDone++;
  else actions.push({ key: 'short-intro', label: 'Complete your short introduction' });
  if (biography.fullBio) bioDone++;
  else actions.push({ key: 'full-bio', label: 'Complete your personal biography' });
  groups.push({ key: 'biography', label: 'Biography', percent: scoreGroup(bioDone, bioTotal) });

  let svcDone = services.filter(function(s) { return s.enabled; }).length > 0 ? 1 : 0;
  groups.push({ key: 'services', label: 'Services', percent: svcDone ? 100 : 0 });
  if (!svcDone) actions.push({ key: 'services', label: 'Select services you offer' });

  let demoDone = demos.length >= 3 ? 1 : demos.length > 0 ? 0.5 : 0;
  groups.push({ key: 'demos', label: 'Demos', percent: Math.round(demoDone * 100) });
  if (demos.length < 3) actions.push({ key: 'demos', label: 'Add at least three live demos' });

  let proofDone = testimonials.length > 0 ? 1 : 0;
  groups.push({ key: 'proof', label: 'Proof', percent: proofDone ? 100 : 50 });
  if (!proofDone) actions.push({ key: 'testimonials', label: 'Add a client testimonial (optional)' });

  groups.push({ key: 'seo', label: 'SEO', percent: content.seo && (content.seo.title || content.seo.description) ? 100 : 60 });
  groups.push({ key: 'lead-form', label: 'Lead form', percent: 100 });

  const overall = Math.round(groups.reduce(function(s, g) { return s + g.percent; }, 0) / groups.length);

  return {
    overall: overall,
    groups: groups,
    actions: actions.slice(0, 8)
  };
}

module.exports = { computeProfileCompletion };
