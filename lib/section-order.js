/**
 * Resolve the effective homepage section order.
 * Position (sectionOrder) is the law: saved keys keep their relative order;
 * any other known/on sections append after so incomplete configs never leave
 * sections at CSS flex order:0 (which stacks them above positioned ones).
 */
'use strict';

var DEFAULT_LAYOUT_SECTIONS = [
  'emerg', 'hero', 'services', 'serviceProcess', 'featureStrip', 'why', 'crew',
  'area', 'reviews', 'quote', 'faq', 'footer'
];

var OPTIONAL_SECTIONS = [
  'navMenu', 'trustBar', 'textBox', 'featureStrip', 'instaGallery', 'igProjectFeed',
  'beforeAfter', 'responseCards', 'projectStats', 'serviceAreas', 'reviewHighlights',
  'featuredProjects', 'specialOffer', 'heroBeforeAfter', 'heroSlider', 'splitHero',
  'activityCounter', 'proofStream', 'projectFeed', 'jobsFeed', 'beforeAfterFeed',
  'videoReels', 'activityTimeline', 'customerReactions', 'onlineQuote',
  'estimateBuilder', 'finance', 'serviceAreaMap', 'emergencyAvailability',
  'certifications', 'promotions', 'serviceProcess', 'crew'
];

var OFF_BY_DEFAULT = [
  'featureStrip', 'instaGallery', 'igProjectFeed', 'lpAccessibility', 'navMenu',
  'mobileBar', 'emergencyAvailability', 'onlineQuote', 'estimateBuilder', 'finance',
  'serviceAreaMap', 'beforeAfter', 'responseCards', 'projectStats', 'serviceAreas',
  'reviewHighlights', 'featuredProjects', 'specialOffer', 'heroBeforeAfter',
  'heroSlider', 'splitHero', 'activityCounter', 'proofStream', 'projectFeed',
  'jobsFeed', 'beforeAfterFeed', 'videoReels', 'activityTimeline', 'customerReactions',
  'textBox'
];

function sectionIsOn(cfg, id) {
  var secs = (cfg && cfg.sections) || {};
  var s = secs[id] || {};
  if (OFF_BY_DEFAULT.indexOf(id) >= 0) return s.on === true;
  return s.on !== false;
}

/**
 * Trust Bar always sits directly under the first hero-like section.
 * Position may reorder other apps freely; this pin is non-negotiable.
 */
function pinTrustBarUnderHero(order) {
  var list = Array.isArray(order) ? order.slice() : [];
  var tb = list.indexOf('trustBar');
  if (tb >= 0) list.splice(tb, 1);
  var heroes = ['hero', 'heroSlider', 'heroBeforeAfter', 'splitHero'];
  var hi = -1;
  for (var i = 0; i < list.length; i++) {
    if (heroes.indexOf(list[i]) >= 0) { hi = i; break; }
  }
  if (hi >= 0) list.splice(hi + 1, 0, 'trustBar');
  else list.unshift('trustBar');
  return list;
}

/**
 * @param {object} cfg site config
 * @param {string[]} [layoutSections] layout recipe sections
 * @returns {string[]}
 */
function resolveSectionOrder(cfg, layoutSections) {
  var base = (layoutSections && layoutSections.length)
    ? layoutSections.slice()
    : DEFAULT_LAYOUT_SECTIONS.slice();

  function ensure(id, afterIds) {
    if (base.indexOf(id) >= 0) return;
    afterIds = afterIds || [];
    for (var i = 0; i < afterIds.length; i++) {
      var ai = base.indexOf(afterIds[i]);
      if (ai >= 0) { base.splice(ai + 1, 0, id); return; }
    }
    var qi = base.indexOf('quote');
    if (qi >= 0) { base.splice(qi, 0, id); return; }
    base.push(id);
  }

  if (base.indexOf('trustBar') < 0) {
    var hi = base.indexOf('hero');
    if (hi < 0) hi = base.indexOf('heroSlider');
    if (hi < 0) hi = base.indexOf('splitHero');
    if (hi >= 0) base.splice(hi + 1, 0, 'trustBar');
    else base.unshift('trustBar');
  }
  ensure('serviceProcess', ['services']);
  ensure('featureStrip', ['serviceProcess', 'services']);
  ensure('crew', ['why', 'serviceProcess', 'services']);

  var secs = (cfg && cfg.sections) || {};
  OPTIONAL_SECTIONS.forEach(function(id) {
    if (!(secs[id] && sectionIsOn(cfg, id))) return;
    if (base.indexOf(id) >= 0) return;
    if (id === 'textBox') {
      var thi = base.indexOf('hero');
      if (thi >= 0) { base.splice(thi + 1, 0, id); return; }
    }
    if (id === 'navMenu') { base.unshift(id); return; }
    if (id === 'onlineQuote') {
      var oqi = base.indexOf('quote');
      if (oqi >= 0) { base.splice(oqi, 0, id); return; }
    }
    base.push(id);
  });

  var saved = Array.isArray(cfg && cfg.sectionOrder)
    ? cfg.sectionOrder.filter(function(x) { return typeof x === 'string' && x && base.indexOf(x) >= 0; })
    : [];
  base.forEach(function(x) { if (saved.indexOf(x) < 0) saved.push(x); });
  var filtered = saved.filter(function(x) { return sectionIsOn(cfg, x); });
  // Always pin Trust Bar under Hero when Trust Bar is part of the page.
  if (filtered.indexOf('trustBar') >= 0 || sectionIsOn(cfg, 'trustBar')) {
    if (filtered.indexOf('trustBar') < 0) filtered.push('trustBar');
    filtered = pinTrustBarUnderHero(filtered);
  }
  return filtered;
}

/**
 * Browser helper: apply resolved order onto main#top > [data-sec].
 * Clears prior inline order, then assigns 1..n so nothing stays at 0.
 */
function applySectionOrderToDom(sectionOrder, root) {
  var mn = root || (typeof document !== 'undefined' ? document.querySelector('main#top') : null);
  if (!mn) return [];
  try {
    mn.style.display = 'flex';
    mn.style.flexDirection = 'column';
  } catch (e) { /* ignore */ }

  var kids = [];
  try {
    kids = Array.prototype.slice.call(mn.querySelectorAll(':scope > [data-sec]'));
  } catch (e2) {
    kids = Array.prototype.filter.call(mn.children || [], function(n) {
      return n && n.getAttribute && n.getAttribute('data-sec');
    });
  }
  kids.forEach(function(n) { n.style.order = ''; });

  var seen = {};
  var ordered = [];
  function pushNode(n) {
    if (!n) return;
    var id = n.getAttribute('data-sec');
    if (!id || seen[id]) return;
    seen[id] = 1;
    ordered.push(n);
  }
  function pushId(id) {
    if (!id || seen[id]) return;
    if (id === 'promotions') {
      pushNode(mn.querySelector('[data-sec="promotions-hero"]'));
      pushNode(mn.querySelector('[data-sec="promotions-inline"]'));
      seen[id] = 1;
      return;
    }
    pushNode(mn.querySelector('[data-sec="' + id + '"]'));
  }

  (Array.isArray(sectionOrder) ? sectionOrder : []).forEach(pushId);
  kids.forEach(pushNode);
  ordered.forEach(function(n, i) { n.style.order = String(i + 1); });
  return ordered.map(function(n) { return n.getAttribute('data-sec'); });
}

module.exports = {
  DEFAULT_LAYOUT_SECTIONS: DEFAULT_LAYOUT_SECTIONS,
  OPTIONAL_SECTIONS: OPTIONAL_SECTIONS,
  OFF_BY_DEFAULT: OFF_BY_DEFAULT,
  sectionIsOn: sectionIsOn,
  pinTrustBarUnderHero: pinTrustBarUnderHero,
  resolveSectionOrder: resolveSectionOrder,
  applySectionOrderToDom: applySectionOrderToDom
};
