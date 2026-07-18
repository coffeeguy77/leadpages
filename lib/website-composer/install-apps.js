'use strict';

const { assertSupportedApp, getCatalogueApp } = require('./marketplace/catalogue');
const { scoreAppForContext, getAppMetadata } = require('./marketplace/app-metadata');
const { adaptApp, hasAdapter } = require('./adapters/registry');
const { PROVENANCE } = require('./constants');

const HERO_APPS = new Set(['hero', 'heroSlider', 'heroBeforeAfter', 'splitHero']);

/**
 * Select Marketplace apps for a concept slot with meaningful diversity.
 */
function selectAppsForConcept({ foundation, recipe, profile, brief, slot }) {
  const baseOrder = (recipe.sectionOrder || foundation.defaultSectionOrder || []).slice();
  const incompatible = new Set((foundation.incompatibilities && foundation.incompatibilities.sectionKeys) || []);
  const supported = new Set(foundation.supportedSectionKeys || []);

  // Slot-based structural diversity (respect foundation suitability via later scoring)
  let heroChoice = (recipe.variants && recipe.variants.hero) || 'hero';
  if (slot === 1) {
    if (supported.has('heroSlider') && !incompatible.has('heroSlider')) {
      heroChoice = 'heroSlider';
    } else if (supported.has('heroBeforeAfter') && !incompatible.has('heroBeforeAfter')) {
      heroChoice = 'heroBeforeAfter';
    }
  } else if (slot === 2 && supported.has('splitHero') && !incompatible.has('splitHero')) {
    heroChoice = 'splitHero';
  }

  let order = baseOrder.filter((k) => k !== 'hero' && k !== 'heroSlider' && k !== 'splitHero' && k !== 'heroBeforeAfter');
  order = [heroChoice, ...order];

  // Slot diversity: trust strategy / gallery emphasis
  if (slot === 1 && supported.has('trustBar') && !order.includes('trustBar')) {
    order.splice(1, 0, 'trustBar');
  }
  // When heroSlider is unsuitable (e.g. trades), still vary concept 2 structurally
  if (slot === 1 && foundation.category === 'trades') {
    if (supported.has('certifications') && !order.includes('certifications')) {
      const after = order.indexOf('trustBar');
      order.splice(after >= 0 ? after + 1 : 2, 0, 'certifications');
    }
    if (supported.has('beforeAfter') && !order.includes('beforeAfter') && !incompatible.has('beforeAfter')) {
      const afterServices = order.indexOf('services');
      order.splice(afterServices >= 0 ? afterServices + 1 : 3, 0, 'beforeAfter');
    }
  }
  if (slot === 2 && supported.has('reviewHighlights') && !order.includes('reviewHighlights')) {
    const idx = order.indexOf('reviews');
    if (idx >= 0) order.splice(idx, 0, 'reviewHighlights');
  }
  if (recipe.id === 'recipe-coffee-event') {
    // Signature coffee-event narrative — hero diversifies by concept slot
    const coffeeHero =
      slot === 1 && supported.has('heroSlider')
        ? 'heroSlider'
        : slot === 2 && supported.has('splitHero')
          ? 'splitHero'
          : 'hero';
    order = uniqueOrder(
      [
        coffeeHero,
        'services',
        'packageCompare',
        'featuredProjects',
        slot === 0 ? 'brandStory' : 'why',
        'serviceProcess',
        'clientLogos',
        slot === 2 ? 'reviewHighlights' : null,
        'reviews',
        'faq',
        'bookingCta',
        'quote',
        'footer'
      ].filter((k) => k && (supported.has(k) || k === 'footer'))
    );
  }
  if (recipe.id === 'recipe-luxury-jewellery') {
    const luxHero =
      slot === 1 && supported.has('heroSlider')
        ? 'heroSlider'
        : slot === 2 && supported.has('splitHero')
          ? 'splitHero'
          : 'hero';
    // Signature = showcase narrative; Contrast = offer/trust funnel; Clarity = reviews-first
    if (slot === 0) {
      order = uniqueOrder(
        [
          luxHero,
          'productCollection',
          'featuredProjects',
          'brandStory',
          'why',
          'reviews',
          'bookingCta',
          'faq',
          'quote',
          'footer'
        ].filter((k) => k && (supported.has(k) || k === 'footer'))
      );
    } else if (slot === 1) {
      order = uniqueOrder(
        [
          luxHero,
          'productCollection',
          'featuredProjects',
          'brandStory',
          'trustBar',
          'why',
          'reviews',
          'bookingCta',
          'quote',
          'footer'
        ].filter((k) => k && (supported.has(k) || k === 'footer'))
      );
    } else {
      order = uniqueOrder(
        [
          luxHero,
          'productCollection',
          'featuredProjects',
          'brandStory',
          'why',
          'reviewHighlights',
          'reviews',
          'bookingCta',
          'quote',
          'footer'
        ].filter((k) => k && (supported.has(k) || k === 'footer'))
      );
    }
  }

  // Filter unsupported / incompatible
  const selected = [];
  const skipped = [];
  const reasons = [];
  let heroPicked = null;

  for (const key of order) {
    if (key === 'footer') {
      selected.push(key);
      continue;
    }
    if (incompatible.has(key)) {
      skipped.push({ appId: key, reason: 'foundation_incompatible' });
      continue;
    }
    if (!supported.has(key) && key !== 'footer') {
      skipped.push({ appId: key, reason: 'not_in_foundation' });
      continue;
    }
    if (HERO_APPS.has(key) && heroPicked) {
      skipped.push({ appId: key, reason: 'hero_exclusive' });
      continue;
    }
    const gate = key === 'footer' ? { ok: true } : assertSupportedApp(key);
    if (!gate.ok) {
      // Allow emerg for trades even if catalogue says supported - check
      const cat = getCatalogueApp(key);
      if (!cat || cat.websiteStudioSupport !== 'supported') {
        skipped.push({ appId: key, reason: 'unsupported', status: cat && cat.websiteStudioSupport });
        continue;
      }
    }
    if (!hasAdapter(key) && key !== 'footer') {
      skipped.push({ appId: key, reason: 'adapter_missing' });
      continue;
    }
    const scored = scoreAppForContext(key, {
      industry: brief.industry || profile.industry,
      foundationCategory: foundation.category,
      conversionGoal: brief.conversionGoal || recipe.conversionStyle
    });
    if (scored.score < 0) {
      skipped.push({ appId: key, reason: scored.reasons.join(',') });
      continue;
    }
    if (HERO_APPS.has(key)) heroPicked = key;
    selected.push(key);
    reasons.push({ appId: key, score: scored.score, reasons: scored.reasons });
  }

  // Ensure required keys (hero satisfied by any hero variant)
  const hasHeroVariant = selected.some((k) => HERO_APPS.has(k));
  for (const req of foundation.requiredSectionKeys || []) {
    if (req === 'hero' && hasHeroVariant) continue;
    if (!selected.includes(req) && (hasAdapter(req) || req === 'footer')) {
      if (incompatible.has(req)) continue;
      // Keep hero at the front of the narrative when backfilling
      if (req === 'hero' || HERO_APPS.has(req)) selected.unshift(req);
      else selected.push(req);
    }
  }
  if (!selected.includes('footer')) selected.push('footer');
  if (!heroPicked) {
    heroPicked = selected.find((k) => HERO_APPS.has(k)) || 'hero';
  }

  return {
    sectionOrder: uniqueOrder(selected),
    heroAppId: heroPicked || 'hero',
    skipped,
    selectionReasons: reasons,
    layoutHints: {
      slot,
      density: slot === 2 ? 'airy' : slot === 1 ? 'bold' : 'balanced'
    }
  };
}

function uniqueOrder(list) {
  const seen = new Set();
  const out = [];
  for (const k of list) {
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/**
 * Install/activate apps into draft sections via deterministic adapters.
 */
function installAppsIntoDraft({ sectionOrder, sectionContentMap, imagesBySection, provenanceMap }) {
  /** @type {object[]} */
  const installedApps = [];
  /** @type {Record<string, object>} */
  const sections = {};
  /** @type {object[]} */
  const errors = [];
  /** @type {object[]} */
  const adapterDiagnostics = [];
  let services = null;

  for (const key of sectionOrder) {
    const raw = sectionContentMap[key] || {};
    const structured = flattenSectionInput(raw);
    if (imagesBySection && imagesBySection[key]) {
      const img = imagesBySection[key];
      if (key === 'hero' || key === 'splitHero') {
        structured.image = img.selectedVariantUrl || img.sourceImageUrl || null;
        structured.imageUrl = structured.image;
        structured.alt = img.altText;
      }
      if (key === 'featuredProjects' && Array.isArray(structured.projects)) {
        // apply first image to first project without image
        for (const p of structured.projects) {
          if (!p.image && img.selectedVariantUrl) {
            p.image = img.selectedVariantUrl;
            break;
          }
        }
      }
      if (key === 'featuredProjects' && Array.isArray(structured.items) && !structured.projects) {
        structured.projects = structured.items.map((it, idx) => ({
          title: it.title,
          text: it.text,
          image: (imagesBySection[key + ':' + idx] && imagesBySection[key + ':' + idx].selectedVariantUrl) || it.image || img.selectedVariantUrl || null,
          imageBrief: it.imageBrief
        }));
      }
      if (key === 'crew') {
        structured.imageBrief = img.altText;
      }
      if (key === 'instaGallery') {
        structured.images = structured.images || [];
      }
    }
    structured.provenance = (provenanceMap && provenanceMap[key]) || PROVENANCE.AI_GENERATED;

    const adapted = adaptApp(key, structured);
    if (!adapted.ok) {
      errors.push(...(adapted.errors || []).map((e) => ({ ...e, appId: key })));
      continue;
    }
    sections[key] = adapted.config;
    if (adapted.services) services = adapted.services;
    installedApps.push({
      appId: key,
      sectionKey: key,
      status: 'activated',
      position_slot: adapted.install && adapted.install.position_slot,
      provenance: structured.provenance,
      adapter: adapted.diagnostics && adapted.diagnostics.adapter
    });
    adapterDiagnostics.push(adapted.diagnostics);
  }

  return {
    ok: errors.length === 0,
    sections,
    installedApps,
    services,
    errors,
    adapterDiagnostics
  };
}

function flattenSectionInput(raw) {
  const content = raw.content && typeof raw.content === 'object' ? raw.content : {};
  const out = { ...content, ...raw };
  delete out.content;
  if (!out.items && content.items) out.items = content.items;
  if (!out.projects && (raw.projects || raw.items || content.projects)) {
    out.projects = raw.projects || content.projects || raw.items;
  }
  if (!out.badges && content.badges) out.badges = content.badges;
  if (!out.steps && content.steps) out.steps = content.steps;
  if (!out.slides && content.slides) out.slides = content.slides;
  if (!out.title && (out.heading || content.heading)) out.title = out.heading || content.heading;
  if (!out.sub && (out.subheading || content.subheading)) out.sub = out.subheading || content.subheading;
  return out;
}

module.exports = {
  selectAppsForConcept,
  installAppsIntoDraft,
  HERO_APPS
};
