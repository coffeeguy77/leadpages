'use strict';

/**
 * Specialist agent registry — internal definitions.
 * Phase 1 exposes Atlas as the only interactive primary specialist.
 */

const SPECIALISTS = Object.freeze([
  {
    id: 'atlas',
    name: 'Atlas',
    role: 'Website Strategist',
    memoryKey: 'atlas',
    phase1Interactive: true,
    responsibilities: [
      'Understand the business and requested outcome',
      'Review current website structure',
      'Recommend the right website journey',
      'Coordinate multi-specialist plans'
    ]
  },
  {
    id: 'nova',
    name: 'Nova',
    role: 'Design Specialist',
    memoryKey: 'nova',
    phase1Interactive: false,
    responsibilities: [
      'Review theme, layout, spacing and imagery',
      'Recommend design improvements using real editor controls'
    ]
  },
  {
    id: 'scout',
    name: 'Scout',
    role: 'SEO Specialist',
    memoryKey: 'scout',
    phase1Interactive: false,
    responsibilities: [
      'Review page SEO',
      'Identify missing service and location pages',
      'Recommend keywords via existing SEO generator (Phase 2)'
    ]
  },
  {
    id: 'pulse',
    name: 'Pulse',
    role: 'Conversion Specialist',
    memoryKey: 'pulse',
    phase1Interactive: false,
    responsibilities: [
      'Review CTAs, forms, trust and conversion paths',
      'Recommend practical conversion improvements'
    ]
  },
  {
    id: 'forge',
    name: 'Forge',
    role: 'Website Builder',
    memoryKey: 'forge',
    phase1Interactive: false,
    responsibilities: [
      'Execute approved draft changes through existing editor capabilities (Phase 2+)'
    ]
  },
  {
    id: 'lens',
    name: 'Lens',
    role: 'Image Specialist',
    memoryKey: 'lens',
    phase1Interactive: false,
    responsibilities: ['Review image quality and recommend permitted images']
  },
  {
    id: 'echo',
    name: 'Echo',
    role: 'Content Specialist',
    memoryKey: 'echo',
    phase1Interactive: false,
    responsibilities: ['Rewrite website content using verified business facts']
  },
  {
    id: 'guardian',
    name: 'Guardian',
    role: 'Quality Specialist',
    memoryKey: 'guardian',
    phase1Interactive: false,
    responsibilities: [
      'Validate proposed changes',
      'Block unsafe or invalid changes'
    ]
  },
  {
    id: 'beacon',
    name: 'Beacon',
    role: 'Marketing Specialist',
    memoryKey: 'beacon',
    phase1Interactive: false,
    responsibilities: ['Recommend campaign and landing-page opportunities (advisory)']
  }
]);

function getSpecialist(id) {
  return SPECIALISTS.find((s) => s.id === String(id || '').toLowerCase()) || null;
}

function listSpecialists() {
  return SPECIALISTS.slice();
}

function interactiveSpecialists() {
  return SPECIALISTS.filter((s) => s.phase1Interactive);
}

module.exports = {
  SPECIALISTS,
  getSpecialist,
  listSpecialists,
  interactiveSpecialists
};
