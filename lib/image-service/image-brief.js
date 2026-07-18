'use strict';

/**
 * Structured image briefs for Website Composer → Image Service.
 */

function createImageBrief(partial) {
  const p = partial || {};
  return {
    imageBriefId: p.imageBriefId || 'brief_' + Math.random().toString(36).slice(2, 10),
    sectionId: p.sectionId || p.sectionKey || null,
    appId: p.appId || p.sectionId || p.sectionKey || null,
    purpose: p.purpose || 'general',
    subject: p.subject || '',
    setting: p.setting || '',
    industry: p.industry || '',
    visualStyle: p.visualStyle || '',
    photographyStyle: p.photographyStyle || p.visualStyle || '',
    lighting: p.lighting || '',
    colourDirection: p.colourDirection || '',
    orientation: p.orientation || 'landscape',
    targetAspectRatio: p.targetAspectRatio || (p.orientation === 'portrait' ? '3:4' : '16:9'),
    minimumWidth: p.minimumWidth || (p.purpose === 'hero' ? 1600 : 800),
    minimumHeight: p.minimumHeight || (p.purpose === 'hero' ? 900 : 600),
    humanPresence: p.humanPresence || '',
    textOverlaySafeArea: p.textOverlaySafeArea || 'none',
    locationPreference: p.locationPreference || '',
    composition: p.composition || '',
    avoidTerms: Array.isArray(p.avoidTerms) ? p.avoidTerms.slice() : [],
    altTextIntent: p.altTextIntent || p.subject || '',
    siteId: p.siteId || null
  };
}

function validateImageBrief(brief) {
  const errors = [];
  if (!brief || typeof brief !== 'object') {
    return { ok: false, errors: [{ code: 'brief_missing', message: 'Image brief required' }] };
  }
  if (!String(brief.subject || '').trim() && !String(brief.purpose || '').trim()) {
    errors.push({ code: 'brief_incomplete', message: 'subject or purpose required' });
  }
  if (brief.orientation && !['landscape', 'portrait', 'square'].includes(brief.orientation)) {
    errors.push({ code: 'orientation_invalid', message: 'Invalid orientation' });
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Build focused Pexels queries from a structured brief.
 */
function buildSearchQueries(brief) {
  const b = brief || {};
  const bits = [b.subject, b.setting, b.photographyStyle || b.visualStyle, b.humanPresence, b.industry]
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  const primary = bits.join(' ').replace(/\s+/g, ' ').trim();
  const queries = [];
  if (primary) queries.push(primary);
  if (b.subject && b.setting) queries.push(b.subject + ' ' + b.setting);
  if (b.subject && b.industry) queries.push(b.subject + ' ' + b.industry);
  if (b.purpose === 'hero' && b.subject) queries.push(b.subject + ' editorial photography');
  // Deduplicate
  return [...new Set(queries.map((q) => q.toLowerCase()))].slice(0, 4);
}

module.exports = {
  createImageBrief,
  validateImageBrief,
  buildSearchQueries
};
