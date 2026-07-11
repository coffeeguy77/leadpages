/**
 * Standard Partner Website body sections — used by multiple templates.
 */
const sections = require('../partner-website/sections');

function standardSections(content, demoOpts) {
  return ''
    + sections.trustBar(content)
    + sections.industriesSection(content)
    + sections.demosSection(content, demoOpts)
    + sections.servicesSection(content)
    + sections.benefitsSection(content)
    + sections.processSection(content)
    + sections.caseStudiesSection(content)
    + sections.biographySection(content)
    + sections.serviceAreaSection(content)
    + sections.platformBackingSection(content)
    + sections.testimonialsSection(content)
    + sections.faqsSection(content)
    + sections.leadOfferSection(content);
}

module.exports = { standardSections };
