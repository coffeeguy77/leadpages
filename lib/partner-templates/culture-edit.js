'use strict';

/**
 * Culture design text editing (Nov 2026).
 *
 * Culture is drawn from the partner's profile (hero, biography, services, testimonials, FAQs …)
 * rather than design-text slots. In the page editor its words are marked by content path
 * ("wc:hero.headline", "wc:services.2.description").
 *
 * Saving: words that come straight from a profile field are written back to that field
 * (FIELD_MAP), so the Content tab always matches the page. Everything else is stored as a
 * Culture override in websiteProfile.designCopy.webculture[path] and applied here.
 */

const editMode = require('./edit-mode');

// content path → websiteProfile path (Culture's headings and buttons come from its own copy
// set, "copy.*", which is stored as Culture overrides).
const FIELD_MAP = {
  'biography.shortIntro': 'biography.shortIntro',
  'biography.fullBio': 'biography.fullBio',
  'biography.professionalBackground': 'biography.professionalBackground',
  'biography.industriesWorked': 'biography.industriesWorked',
  'biography.whyPartner': 'biography.whyPartner',
  'biography.enjoyHelping': 'biography.enjoyHelping',
  'biography.workingStyle': 'biography.workingStyle',
  'biography.personalFact': 'biography.personalFact',
  'serviceArea.headline': 'location.serviceRegionHeadline',
  'contact.ctaLabel': 'contact.ctaLabel',
  'contact.contactHours': 'contact.contactHours',
  'contact.responseTime': 'contact.responseTime'
};

// Sections whose words are editable on the page.
const ROOTS = ['biography', 'serviceArea', 'services', 'testimonials', 'caseStudies', 'faqs', 'contact'];
// Keys that are data, not words (links, ids, pictures, settings) — never marked.
const SKIP_KEY = /(url|href|id|slug|email|phone|icon|image|logo|photo|color|colour|status|method|type|key|keys|thumbnail|highlight|highlightedPhrase|step|rating|date|value|primaryRegion|primarySuburb|state|country|featuredCount|location)$/i;

function pathSet(obj, path, value) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (o == null || typeof o !== 'object') return;
    o = o[parts[i]];
  }
  if (o != null && typeof o === 'object' && typeof o[parts[parts.length - 1]] === 'string') o[parts[parts.length - 1]] = value;
}

/** Apply stored Culture overrides (designCopy.webculture) onto the page content. */
function applyOverrides(c, overrides) {
  if (!overrides || typeof overrides !== 'object') return;
  Object.keys(overrides).forEach(function(p) {
    if (FIELD_MAP[p] || p.indexOf('copy.') === 0) return; // profile fields / Culture copy (applyCopy)
    const v = overrides[p];
    if (typeof v === 'string' && v.trim()) pathSet(c, p, v);
  });
}

function isWords(s) {
  return typeof s === 'string' && s.trim().length > 1 && !/^(https?:|\/|#|mailto:|tel:)/i.test(s.trim());
}

/** Culture's own copy set (headings, buttons, labels): stored overrides, then edit markers. */
function applyCopy(copy, overrides, edit) {
  if (overrides && typeof overrides === 'object') {
    Object.keys(overrides).forEach(function(p) {
      if (p.indexOf('copy.') !== 0) return;
      const v = overrides[p];
      if (typeof v === 'string' && v.trim()) pathSet({ copy: copy }, p, v);
    });
  }
  if (edit) {
    const holder = { copy: copy };
    walkMark(holder, 'copy', 'copy');
    return holder.copy;
  }
  return copy;
}

function walkMark(parent, key, path) {
  const node = parent[key];
  if (Array.isArray(node)) { node.forEach(function(v, i) { walkMark(node, i, path + '.' + i); }); return; }
  if (node && typeof node === 'object') {
    Object.keys(node).forEach(function(k) { if (!SKIP_KEY.test(k)) walkMark(node, k, path + '.' + k); });
    return;
  }
  if (isWords(node)) parent[key] = editMode.markText('wc:' + path, node);
}

/** Edit mode: wrap every word string under ROOTS in edit markers keyed "wc:<path>". */
function markContent(c) {
  function walk(node, path) {
    if (Array.isArray(node)) { node.forEach(function(v, i) { node[i] = walk(v, path + '.' + i); }); return node; }
    if (node && typeof node === 'object') {
      Object.keys(node).forEach(function(k) {
        if (SKIP_KEY.test(k)) return;
        node[k] = walk(node[k], path + '.' + k);
      });
      return node;
    }
    if (isWords(node)) return editMode.markText('wc:' + path, node);
    return node;
  }
  ROOTS.forEach(function(r) { if (c[r] != null) c[r] = walk(c[r], r); });
}

module.exports = { FIELD_MAP, applyOverrides, applyCopy, markContent };
