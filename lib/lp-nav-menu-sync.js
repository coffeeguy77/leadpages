'use strict';

/**
 * Sync landing pages ↔ sections.navMenu.items (target = "page:<slug>").
 * Menu manager remains the full editor; these helpers power the LP quick-add UI.
 */

function ensureNavMenu(config) {
  if (!config || typeof config !== 'object') config = {};
  if (!config.sections || typeof config.sections !== 'object') config.sections = {};
  if (!config.sections.navMenu || typeof config.sections.navMenu !== 'object') {
    config.sections.navMenu = {
      on: true,
      style: 'pills',
      align: 'left',
      placement: 'header',
      icons: 'both',
      items: []
    };
  }
  var nm = config.sections.navMenu;
  if (!Array.isArray(nm.items)) nm.items = [];
  if (!nm.placement) nm.placement = 'header';
  if (!nm.icons) nm.icons = 'both';
  if (!nm.style) nm.style = 'pills';
  if (!nm.align) nm.align = 'left';
  return nm;
}

function pageTarget(slug) {
  return 'page:' + String(slug || '').trim();
}

function findPageMenuIndex(items, slug) {
  var t = pageTarget(slug);
  if (!t || t === 'page:') return -1;
  for (var i = 0; i < items.length; i++) {
    if (items[i] && items[i].target === t) return i;
    var kids = items[i] && Array.isArray(items[i].children) ? items[i].children : null;
    if (kids) {
      for (var j = 0; j < kids.length; j++) {
        if (kids[j] && kids[j].target === t) return i; // parent index (LP toggle still works)
      }
    }
  }
  return -1;
}

function findPageMenuChildRef(items, slug) {
  var t = pageTarget(slug);
  if (!t || t === 'page:') return null;
  for (var i = 0; i < items.length; i++) {
    if (items[i] && items[i].target === t) return { parent: i, child: -1, item: items[i] };
    var kids = items[i] && Array.isArray(items[i].children) ? items[i].children : null;
    if (kids) {
      for (var j = 0; j < kids.length; j++) {
        if (kids[j] && kids[j].target === t) return { parent: i, child: j, item: kids[j] };
      }
    }
  }
  return null;
}

/**
 * @param {object} config
 * @param {{ slug: string, show: boolean, label?: string, icon?: string, oldSlug?: string }} opts
 */
function syncPageMenuItem(config, opts) {
  opts = opts || {};
  var slug = String(opts.slug || '').trim();
  var nm = ensureNavMenu(config);
  var items = nm.items;

  // Rename target if slug changed while item exists under old slug
  var oldSlug = String(opts.oldSlug || '').trim();
  if (oldSlug && slug && oldSlug !== slug) {
    var oref = findPageMenuChildRef(items, oldSlug);
    if (oref) oref.item.target = pageTarget(slug);
  }

  if (!opts.show || !slug) {
    var rem = findPageMenuChildRef(items, slug);
    if (rem) {
      if (rem.child >= 0) items[rem.parent].children.splice(rem.child, 1);
      else items.splice(rem.parent, 1);
    }
    return { config: config, index: -1, item: null };
  }

  var label = String(opts.label != null ? opts.label : '').trim();
  var icon = opts.icon != null ? String(opts.icon).trim() : '';
  var ref = findPageMenuChildRef(items, slug);
  var idx = -1;
  var item = null;
  if (!ref) {
    items.push({
      label: label || slug,
      target: pageTarget(slug),
      url: '',
      icon: icon || ''
    });
    idx = items.length - 1;
    item = items[idx];
  } else {
    item = ref.item;
    idx = ref.parent;
    if (label) item.label = label;
    if (opts.icon !== undefined) item.icon = icon;
    if (!item.target) item.target = pageTarget(slug);
  }

  // Turning on from the LP editor should make the menu visible without a second trip
  if (nm.on !== true) nm.on = true;

  return { config: config, index: idx, item: item };
}

function removePageMenuItem(config, slug) {
  return syncPageMenuItem(config, { slug: slug, show: false });
}

/**
 * Move a page menu item among the full menu list (same as Menu manager arrows).
 * @param {number} dir -1 left/up, +1 right/down
 */
function movePageMenuItem(config, slug, dir) {
  var nm = ensureNavMenu(config);
  var items = nm.items;
  var ref = findPageMenuChildRef(items, slug);
  if (!ref || ref.child >= 0) {
    // Nested items are reordered in Menu manager; LP arrows only move top-level entries
    if (!ref) return { config: config, index: -1, moved: false };
    return { config: config, index: ref.parent, moved: false };
  }
  var idx = ref.parent;
  var to = idx + (dir < 0 ? -1 : 1);
  if (to < 0 || to >= items.length) return { config: config, index: idx, moved: false };
  var it = items.splice(idx, 1)[0];
  items.splice(to, 0, it);
  return { config: config, index: to, moved: true };
}

function isPageInMenu(config, slug) {
  var nm = ensureNavMenu(config);
  return findPageMenuIndex(nm.items, slug) >= 0;
}

function getPageMenuItem(config, slug) {
  var nm = ensureNavMenu(config);
  var ref = findPageMenuChildRef(nm.items, slug);
  return ref ? ref.item : null;
}

module.exports = {
  ensureNavMenu: ensureNavMenu,
  pageTarget: pageTarget,
  findPageMenuIndex: findPageMenuIndex,
  findPageMenuChildRef: findPageMenuChildRef,
  syncPageMenuItem: syncPageMenuItem,
  removePageMenuItem: removePageMenuItem,
  movePageMenuItem: movePageMenuItem,
  isPageInMenu: isPageInMenu,
  getPageMenuItem: getPageMenuItem
};
