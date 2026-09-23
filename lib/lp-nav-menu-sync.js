'use strict';

/**
 * Sync landing pages ↔ sections.navMenu.items (target = "page:<slug>").
 * Menu manager remains the full editor; these helpers power the LP quick-add UI.
 *
 * Placement: top-level or under a parent (submenu). Pass opts.under:
 *   'top' | -1 | null  → top level
 *   number             → index of existing parent item
 *   { create: 'Label' }→ create/ensure a parent with that label, nest under it
 *   undefined          → keep current placement if present, else top
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

function isParentItem(it) {
  if (!it) return false;
  if (it.kind === 'link') return false;
  if (it.kind === 'parent') return true;
  return !!(Array.isArray(it.children) && it.children.length);
}

function listParentItems(items) {
  var out = [];
  (items || []).forEach(function (it, i) {
    if (isParentItem(it)) out.push({ index: i, label: it.label || ('Parent ' + (i + 1)), item: it });
  });
  return out;
}

function findPageMenuIndex(items, slug) {
  var ref = findPageMenuChildRef(items, slug);
  return ref ? ref.parent : -1;
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

function detachPageMenuItem(items, slug) {
  var ref = findPageMenuChildRef(items, slug);
  if (!ref) return null;
  var item = ref.item;
  if (ref.child >= 0) items[ref.parent].children.splice(ref.child, 1);
  else items.splice(ref.parent, 1);
  return item;
}

function ensureParentAt(items, under) {
  if (under == null || under === 'top' || under === -1 || under === '') return -1;
  if (typeof under === 'object' && under.create != null) {
    var label = String(under.create || '').trim() || 'Services';
    for (var i = 0; i < items.length; i++) {
      if (isParentItem(items[i]) && String(items[i].label || '') === label) {
        items[i].kind = 'parent';
        if (!Array.isArray(items[i].children)) items[i].children = [];
        return i;
      }
    }
    items.push({ label: label, kind: 'parent', icon: '', children: [] });
    return items.length - 1;
  }
  var idx = +under;
  if (isNaN(idx) || idx < 0 || idx >= items.length) return -1;
  var p = items[idx];
  p.kind = 'parent';
  if (!Array.isArray(p.children)) p.children = [];
  // Parent should not keep a page target of its own when used as a submenu heading
  return idx;
}

/**
 * @param {object} config
 * @param {{ slug: string, show: boolean, label?: string, icon?: string, oldSlug?: string, under?: any }} opts
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
    detachPageMenuItem(items, slug);
    return { config: config, index: -1, item: null, child: -1 };
  }

  var label = String(opts.label != null ? opts.label : '').trim();
  var icon = opts.icon != null ? String(opts.icon).trim() : '';
  var existing = findPageMenuChildRef(items, slug);
  var item = existing ? existing.item : null;

  var wantUnder = opts.under;
  var parentIdx = -1;
  if (wantUnder !== undefined) {
    parentIdx = ensureParentAt(items, wantUnder);
  } else if (existing) {
    parentIdx = existing.child >= 0 ? existing.parent : -1;
  } else {
    parentIdx = -1;
  }

  // Relocate if placement changed or item is new
  var needMove = !existing;
  if (existing) {
    var curParent = existing.child >= 0 ? existing.parent : -1;
    if (wantUnder !== undefined && curParent !== parentIdx) needMove = true;
  }

  if (needMove) {
    item = detachPageMenuItem(items, slug) || {
      label: label || slug,
      target: pageTarget(slug),
      url: '',
      icon: icon || '',
      opens: '_self',
      kind: 'link'
    };
    item.kind = 'link';
    item.target = pageTarget(slug);
    if (label) item.label = label;
    else if (!item.label) item.label = slug;
    if (opts.icon !== undefined) item.icon = icon;
    if (parentIdx >= 0 && items[parentIdx]) {
      items[parentIdx].kind = 'parent';
      if (!Array.isArray(items[parentIdx].children)) items[parentIdx].children = [];
      items[parentIdx].children.push(item);
      existing = { parent: parentIdx, child: items[parentIdx].children.length - 1, item: item };
    } else {
      items.push(item);
      existing = { parent: items.length - 1, child: -1, item: item };
    }
  } else {
    if (label) item.label = label;
    if (opts.icon !== undefined) item.icon = icon;
    if (!item.target) item.target = pageTarget(slug);
  }

  if (nm.on !== true) nm.on = true;

  return {
    config: config,
    index: existing.parent,
    child: existing.child,
    item: existing.item
  };
}

function removePageMenuItem(config, slug) {
  return syncPageMenuItem(config, { slug: slug, show: false });
}

/**
 * Move a page menu item among siblings (top-level list, or children of its parent).
 * @param {number} dir -1 left/up, +1 right/down
 */
function movePageMenuItem(config, slug, dir) {
  var nm = ensureNavMenu(config);
  var items = nm.items;
  var ref = findPageMenuChildRef(items, slug);
  if (!ref) return { config: config, index: -1, child: -1, moved: false };

  if (ref.child >= 0) {
    var kids = items[ref.parent].children || [];
    var ci = ref.child;
    var toC = ci + (dir < 0 ? -1 : 1);
    if (toC < 0 || toC >= kids.length) {
      return { config: config, index: ref.parent, child: ci, moved: false };
    }
    var ch = kids.splice(ci, 1)[0];
    kids.splice(toC, 0, ch);
    return { config: config, index: ref.parent, child: toC, moved: true };
  }

  var idx = ref.parent;
  var to = idx + (dir < 0 ? -1 : 1);
  if (to < 0 || to >= items.length) return { config: config, index: idx, child: -1, moved: false };
  var it = items.splice(idx, 1)[0];
  items.splice(to, 0, it);
  return { config: config, index: to, child: -1, moved: true };
}

function isPageInMenu(config, slug) {
  var nm = ensureNavMenu(config);
  return !!findPageMenuChildRef(nm.items, slug);
}

function getPageMenuItem(config, slug) {
  var nm = ensureNavMenu(config);
  var ref = findPageMenuChildRef(nm.items, slug);
  return ref ? ref.item : null;
}

function getPageMenuPlacement(config, slug) {
  var nm = ensureNavMenu(config);
  var ref = findPageMenuChildRef(nm.items, slug);
  if (!ref) return { inMenu: false, parentIndex: -1, childIndex: -1, item: null };
  return {
    inMenu: true,
    parentIndex: ref.child >= 0 ? ref.parent : -1,
    childIndex: ref.child,
    topIndex: ref.child < 0 ? ref.parent : -1,
    item: ref.item,
    parentLabel: ref.child >= 0 && nm.items[ref.parent] ? (nm.items[ref.parent].label || '') : ''
  };
}

module.exports = {
  ensureNavMenu: ensureNavMenu,
  pageTarget: pageTarget,
  isParentItem: isParentItem,
  listParentItems: listParentItems,
  findPageMenuIndex: findPageMenuIndex,
  findPageMenuChildRef: findPageMenuChildRef,
  syncPageMenuItem: syncPageMenuItem,
  removePageMenuItem: removePageMenuItem,
  movePageMenuItem: movePageMenuItem,
  isPageInMenu: isPageInMenu,
  getPageMenuItem: getPageMenuItem,
  getPageMenuPlacement: getPageMenuPlacement
};
