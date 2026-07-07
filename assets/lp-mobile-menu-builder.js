/**
 * Mobile command centre menu — config loader, role filter, drawer renderer, super-admin builder.
 */
(function (global) {
  'use strict';

  var API = '/api/admin-command-menu';
  var config = null;
  var defaults = null;
  var loadPromise = null;

  var ROLES = ['super', 'partner', 'client'];
  var LAYOUTS = [
    { id: 'stack', label: 'Stack (vertical)' },
    { id: 'grid-2', label: '2-column grid' },
    { id: 'tabs', label: 'Tabs (builder nav)' }
  ];
  var BUTTON_STYLES = [
    { id: 'default', label: 'Default' },
    { id: 'outline', label: 'Outline' },
    { id: 'publish-duo', label: 'Publish pair' },
    { id: 'nav', label: 'Nav tabs' },
    { id: 'compact', label: 'Compact' }
  ];
  var SEPARATORS = [
    { id: 'none', label: 'None' },
    { id: 'line', label: 'Divider line' },
    { id: 'space', label: 'Extra space' }
  ];

  var ACTION_CATALOG = {
    'btn-publish': { label: 'Publish Live Site', group: 'Publish' },
    'btn-viewlive': { label: 'View Live Site', group: 'Publish' },
    'btn-settings': { label: 'Settings', group: 'Site Tools' },
    'btn-appearance-aa': { label: 'Appearance', group: 'Site Tools' },
    'btn-billing': { label: 'Billing', group: 'Site Tools' },
    'btn-domains': { label: 'Domains', group: 'Site Tools' },
    'lpc-partner-admin': { label: 'Partner Admin', group: 'Admin' },
    'lpc-marketplace-admin': { label: 'Marketplace Admin', group: 'Admin' },
    'lpc-partner-console': { label: 'Partner Console', group: 'Partner' },
    'btn-newsite': { label: 'New Site', group: 'Site Tools' },
    'btn-fav': { label: 'Favourite', group: 'Site Tools' },
    'lpc-scope': { label: 'Scope', group: 'Site Tools' },
    'lpc-backups': { label: 'Backups', group: 'Site Tools' },
    'lpc-preview': { label: 'Live Preview', group: 'Preview' },
    'btn-switch': { label: 'Switch Account', group: 'Account' },
    'lp-mode-toggle': { label: 'Classic / Standard mode', group: 'Account' },
    'lpc-drawer-signout': { label: 'Sign Out', group: 'Account' }
  };

  var SLOT_CATALOG = {
    'lpc-context': { label: 'Site switcher', group: 'Slots' },
    adminnav: { label: 'Builder tabs (adminnav)', group: 'Slots' },
    'lpc-primary': { label: 'Publishing & preview', group: 'Slots' },
    'lpc-drawer-top': { label: 'Publish row', group: 'Slots' },
    'lpc-tools': { label: 'Tools container', group: 'Slots' },
    'lpc-drawer-footer': { label: 'Account footer', group: 'Slots' }
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function getUserRoles() {
    if (typeof global.getUserMenuRoles === 'function') {
      try { return global.getUserMenuRoles(); } catch (e) { /* ignore */ }
    }
    return ['super', 'partner', 'client'];
  }

  function rolesMatch(required, userRoles) {
    if (!required || !required.length) return true;
    var u = userRoles || getUserRoles();
    if (!Array.isArray(u)) u = [u];
    for (var i = 0; i < required.length; i++) {
      if (u.indexOf(required[i]) >= 0) return true;
    }
    return false;
  }

  function cwToken() {
    try {
      if (typeof global.cwToken === 'function') return global.cwToken();
      if (global.sb && global.sb.auth) {
        return global.sb.auth.getSession().then(function (r) {
          return (r && r.data && r.data.session && r.data.session.access_token) || null;
        });
      }
    } catch (e) { /* ignore */ }
    return Promise.resolve(null);
  }

  async function getToken() {
    try {
      var tk = await cwToken();
      return tk || null;
    } catch (e) { /* ignore */ }
    return null;
  }

  async function apiFetch(path, opts) {
    var tk = await getToken();
    var r = await fetch(path, Object.assign({
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (tk || '')
      }
    }, opts || {}));
    var text = await r.text();
    var j;
    try { j = JSON.parse(text); } catch (e) { j = { error: text || ('HTTP ' + r.status) }; }
    if (!r.ok && !(j && j.error)) j.error = 'HTTP ' + r.status;
    j._status = r.status;
    j._ok = r.ok;
    return j;
  }

  function normalizeConfig(cfg) {
    if (!cfg || !Array.isArray(cfg.sections)) return cfg;
    var defs = defaults || FALLBACK_DEFAULT;
    (defs.sections || []).forEach(function (defSec) {
      var sec = cfg.sections.find(function (s) { return s && s.id === defSec.id; });
      if (!sec) {
        cfg.sections.push(deepClone(defSec));
        return;
      }
      if (defSec.id === 'publish') {
        sec.slot = 'lpc-drawer-top';
        if (!sec.items || !sec.items.length) {
          sec.items = deepClone(defSec.items || [{ id: 'btn-publish' }, { id: 'btn-viewlive' }]);
        }
      }
      if (defSec.id === 'tools' && !sec.slot) sec.slot = 'lpc-tools';
      if (defSec.id === 'account' && !sec.slot) sec.slot = 'lpc-drawer-footer';
    });
    return cfg;
  }

  async function load(force) {
    if (!force && config) return config;
    if (!force && loadPromise) return loadPromise;
    loadPromise = (async function () {
      try {
        var tk = await getToken();
        var r = await fetch(API, { headers: tk ? { Authorization: 'Bearer ' + tk } : {} });
        var text = await r.text();
        var j;
        try { j = JSON.parse(text); } catch (e) { j = null; }
        if (j && j.ok) {
          config = normalizeConfig(j.content);
          defaults = j.defaults || deepClone(FALLBACK_DEFAULT);
        }
      } catch (e) { /* use baked-in default */ }
      if (!config) {
        config = deepClone(FALLBACK_DEFAULT);
        defaults = deepClone(FALLBACK_DEFAULT);
      }
      return config;
    })();
    return loadPromise;
  }

  var FALLBACK_DEFAULT = {
    version: 1,
    sections: [
      { id: 'publish', title: 'Publish', layout: 'stack', buttonStyle: 'publish-duo', separator: 'none', roles: ['super', 'partner', 'client'], slot: 'lpc-drawer-top', items: [{ id: 'btn-publish' }, { id: 'btn-viewlive' }] },
      { id: 'site', title: 'Site', layout: 'stack', buttonStyle: 'default', separator: 'line', roles: ['super', 'partner'], condition: 'site-switcher', slot: 'lpc-context' },
      { id: 'builder', title: 'Builder Menu', layout: 'tabs', buttonStyle: 'nav', separator: 'line', roles: ['super', 'partner', 'client'], slot: 'adminnav' },
      { id: 'tools', title: 'Site Tools', layout: 'stack', buttonStyle: 'outline', separator: 'line', roles: ['super', 'partner', 'client'], slot: 'lpc-tools', items: [
        { id: 'btn-settings', roles: ['super', 'partner', 'client'] },
        { id: 'btn-appearance-aa', roles: ['super', 'partner', 'client'] },
        { id: 'btn-billing', roles: ['super', 'partner', 'client'] },
        { id: 'btn-domains', roles: ['super', 'partner', 'client'] },
        { id: 'lpc-partner-admin', roles: ['super'] },
        { id: 'lpc-marketplace-admin', roles: ['super'] },
        { id: 'lpc-partner-console', roles: ['partner'] }
      ] },
      { id: 'account', title: 'Account', layout: 'stack', buttonStyle: 'outline', separator: 'line', roles: ['super', 'partner', 'client'], slot: 'lpc-drawer-footer', items: [
        { id: 'btn-switch', roles: ['super'] },
        { id: 'lpc-drawer-signout', roles: ['super', 'partner', 'client'] }
      ] }
    ]
  };

  function getConfig() {
    return config || deepClone(FALLBACK_DEFAULT);
  }

  function sectionVisible(sec, opts) {
    if (!rolesMatch(sec.roles)) return false;
    if (sec.condition === 'site-switcher') {
      if (opts && opts.phone) {
        if (typeof global.lpDrawerShowSiteSwitcher === 'function') {
          try { return !!global.lpDrawerShowSiteSwitcher(); } catch (e) { return false; }
        }
        return false;
      }
    }
    return true;
  }

  function visibleItems(sec, userRoles) {
    var items = sec.items || [];
    return items.filter(function (it) {
      return rolesMatch(it.roles || sec.roles, userRoles);
    });
  }

  function elVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.style && el.style.display === 'none') return false;
    var cs = global.getComputedStyle ? global.getComputedStyle(el) : null;
    return !cs || cs.display !== 'none';
  }

  function slotHasContent(slotId) {
    var el = slotId === 'adminnav'
      ? document.querySelector('.adminnav')
      : document.getElementById(slotId);
    if (!el) return false;
    if (slotId === 'adminnav') {
      return Array.prototype.some.call(el.querySelectorAll('.anav-btn'), function (b) {
        return !(b.style && b.style.display === 'none');
      });
    }
    if (slotId === 'lpc-drawer-footer' || slotId === 'lpc-drawer-top' || slotId === 'lpc-tools') {
      return el.children.length > 0;
    }
    return Array.prototype.some.call(el.children, function (c) { return elVisible(c); });
  }

  function applyButtonStyle(wrap, style, sec) {
    wrap.classList.add('lp-mm-sec');
    wrap.classList.add('lp-mm-layout-' + (sec.layout || 'stack'));
    wrap.classList.add('lp-mm-style-' + (style || 'default'));
    if (sec.separator && sec.separator !== 'none') {
      wrap.classList.add('lp-mm-sep-' + sec.separator);
    }
  }

  function moveItemToRow(itemId, row) {
    if (!row) return;
    var el = document.getElementById(itemId);
    if (el && el.parentNode !== row) row.appendChild(el);
  }

  function moveItemsIntoSlot(sec, slotEl, userRoles) {
    if (!slotEl) return false;
    if (sec.items && sec.items.length) {
      visibleItems(sec, userRoles).forEach(function (it) { moveItemToRow(it.id, slotEl); });
    }
    return slotEl.children.length > 0;
  }

  function getSlotElement(slotId) {
    if (!slotId) return null;
    return slotId === 'adminnav'
      ? document.querySelector('.adminnav')
      : document.getElementById(slotId);
  }

  function slotElementHasContent(sec) {
    var slotEl = getSlotElement(sec.slot);
    if (!slotEl) return false;
    if (sec.slot === 'adminnav') return slotHasContent('adminnav');
    if (sec.slot === 'lpc-drawer-footer' || sec.slot === 'lpc-drawer-top' || sec.slot === 'lpc-tools') {
      return slotEl.children.length > 0;
    }
    return Array.prototype.some.call(slotEl.children, function (c) { return elVisible(c); });
  }

  /** Populate live command-bar controls into drawer slots before config render. */
  function prepareDrawerSlots(opts) {
    opts = opts || {};
    try {
      if (typeof global.lpRefreshCmdDrawer === 'function') global.lpRefreshCmdDrawer();
    } catch (e) { /* ignore */ }
    if (global.LPAdminShell && typeof global.LPAdminShell.prepareDrawerButtons === 'function') {
      try { global.LPAdminShell.prepareDrawerButtons(); } catch (e) { /* ignore */ }
    }
    var cfg = getConfig();
    var userRoles = getUserRoles();
    (cfg.sections || []).forEach(function (sec) {
      if (!sectionVisible(sec, opts)) return;
      if (sec.slot === 'adminnav') return;
      if (!sec.items || !sec.items.length) return;
      var slotId = sec.id === 'publish' ? 'lpc-drawer-top' : sec.slot;
      var slotEl = getSlotElement(slotId);
      if (!slotEl) return;
      moveItemsIntoSlot(sec, slotEl, userRoles);
    });
  }

  function buildSectionRow(sec, userRoles) {
    var row = document.createElement('div');
    row.className = 'lp-mm-sec-body';
    row.setAttribute('data-mm-sec', sec.id);
    applyButtonStyle(row, sec.buttonStyle, sec);

    if (sec.slot) {
      var slotEl = getSlotElement(sec.slot);
      if (slotEl) {
        if (sec.slot === 'lpc-drawer-footer' || sec.slot === 'lpc-drawer-top' || sec.slot === 'lpc-tools') {
          moveItemsIntoSlot(sec, slotEl, userRoles);
          if (slotEl.children.length > 0 && slotEl.parentNode !== row) {
            row.appendChild(slotEl);
          }
        } else if (slotEl.parentNode !== row) {
          row.appendChild(slotEl);
        }
      }
    } else if (sec.items && sec.items.length) {
      moveItemsIntoSlot(sec, row, userRoles);
    }
    return row;
  }

  function sectionHasContent(sec, row) {
    if (sec.slot && row) {
      var inRow = sec.slot === 'adminnav'
        ? row.querySelector('.adminnav')
        : row.querySelector('#' + sec.slot);
      if (inRow) {
        if (sec.slot === 'adminnav') return slotHasContent('adminnav');
        if (sec.slot === 'lpc-drawer-footer' || sec.slot === 'lpc-drawer-top' || sec.slot === 'lpc-tools') {
          return inRow.children.length > 0;
        }
        return Array.prototype.some.call(inRow.children, function (c) { return elVisible(c); });
      }
    }
    if (sec.slot) return slotElementHasContent(sec);
    if (!row) return false;
    return Array.prototype.some.call(row.children, function (c) { return elVisible(c); });
  }

  function renderPhoneDrawer(inner, opts) {
    opts = opts || {};
    var cfg = getConfig();
    var userRoles = getUserRoles();
    if (!inner || !cfg || !cfg.sections) return false;

    while (inner.firstChild) inner.removeChild(inner.firstChild);

    var added = 0;
    cfg.sections.forEach(function (sec) {
      if (!sectionVisible(sec, opts)) return;

      var row = buildSectionRow(sec, userRoles);
      if (!sectionHasContent(sec, row)) return;

      if (sec.title) {
        var lbl = document.createElement('div');
        lbl.className = 'lp-drawer-section-label lp-mm-label lp-mm-label-' + sec.id;
        lbl.textContent = sec.title;
        inner.appendChild(lbl);
      }
      inner.appendChild(row);
      added++;
    });

    document.body.classList.toggle('lp-mm-configured', added > 0);
    return added > 0;
  }

  function renderTabletDrawer(inner, opts) {
    opts = opts || {};
    var cfg = getConfig();
    var userRoles = getUserRoles();
    if (!inner || !cfg || !cfg.sections) return false;

    while (inner.firstChild) inner.removeChild(inner.firstChild);

    var added = 0;
    cfg.sections.forEach(function (sec) {
      if (!sectionVisible(sec, opts)) return;
      if (sec.id === 'site' && sec.condition === 'site-switcher') {
        /* tablet always shows site section */
      }

      var targetSlot = null;
      if (sec.id === 'publish') targetSlot = document.getElementById('lpc-drawer-top');
      else if (sec.id === 'site') targetSlot = document.getElementById('lpc-context');
      else if (sec.id === 'builder') targetSlot = document.querySelector('.adminnav');
      else if (sec.id === 'tools') targetSlot = document.getElementById('lpc-tools');
      else if (sec.id === 'account') targetSlot = document.getElementById('lpc-drawer-footer');
      else if (sec.slot) targetSlot = sec.slot === 'adminnav' ? document.querySelector('.adminnav') : document.getElementById(sec.slot);

      if (!targetSlot) return;

      var wrap = document.createElement('div');
      wrap.className = 'lp-mm-tablet-block';
      applyButtonStyle(wrap, sec.buttonStyle, sec);

      if (sec.title) {
        var lbl = document.createElement('div');
        lbl.className = 'lp-drawer-section-label lp-mm-label lp-mm-label-' + sec.id;
        lbl.textContent = sec.title;
        wrap.appendChild(lbl);
      }

      if (sec.slot === 'lpc-drawer-footer' || sec.slot === 'lpc-drawer-top' || sec.slot === 'lpc-tools') {
        moveItemsIntoSlot(sec, targetSlot, userRoles);
        if (targetSlot.children.length > 0 && targetSlot.parentNode !== wrap) {
          wrap.appendChild(targetSlot);
        }
      } else if (targetSlot.parentNode !== wrap) {
        wrap.appendChild(targetSlot);
      }

      if (!sectionHasContent(sec, wrap)) return;
      inner.appendChild(wrap);
      added++;
    });

    var prim = document.getElementById('lpc-primary');
    if (prim && !opts.phone) {
      var hasPrim = Array.prototype.some.call(prim.children, function (c) { return elVisible(c); });
      if (hasPrim) {
        var primWrap = document.createElement('div');
        primWrap.className = 'lp-mm-tablet-block';
        var pl = document.createElement('div');
        pl.className = 'lp-drawer-section-label';
        pl.textContent = 'Publishing & preview';
        primWrap.appendChild(pl);
        primWrap.appendChild(prim);
        inner.appendChild(primWrap);
        added++;
      }
    }

    document.body.classList.toggle('lp-mm-configured', added > 0);
    return added > 0;
  }

  function applyDrawer(inner, opts) {
    if (!inner) return false;
    if ((global.innerWidth || 9999) >= 1024) return false;
    opts = opts || {};
    prepareDrawerSlots(opts);
    if (opts.phone) return renderPhoneDrawer(inner, opts);
    return renderTabletDrawer(inner, opts);
  }

  function invalidate() {
    config = null;
    loadPromise = null;
  }

  async function save(newConfig) {
    var j = await apiFetch(API, {
      method: 'POST',
      body: JSON.stringify({ content: newConfig })
    });
    if (j && j.ok) {
      config = normalizeConfig(deepClone(newConfig));
      if (global.LPAdminShell && global.LPAdminShell.moveChrome) {
        global.LPAdminShell.moveChrome();
      }
    }
    return j;
  }

  function roleCheckboxes(selected, prefix) {
    return ROLES.map(function (r) {
      var on = !selected || !selected.length || selected.indexOf(r) >= 0;
      var label = r === 'super' ? 'Super admin' : (r === 'partner' ? 'Partner' : 'Client');
      return '<label class="mmb-role"><input type="checkbox" data-' + prefix + '-role="' + r + '"' + (on ? ' checked' : '') + '> ' + label + '</label>';
    }).join('');
  }

  function getLiveNavButtons() {
    var nav = document.querySelector('.adminnav');
    if (!nav) return [];
    return Array.prototype.filter.call(nav.querySelectorAll('.anav-btn'), function (btn) {
      return elVisible(btn);
    }).map(function (btn) {
      return { id: btn.id || '', label: (btn.textContent || '').trim() || btn.id };
    });
  }

  function slotPreviewLines(sec, roles) {
    if (sec.slot === 'adminnav') {
      return getLiveNavButtons().map(function (b) {
        return { label: b.label, outline: true };
      });
    }
    if (sec.slot === 'lpc-context') {
      if (sec.condition === 'site-switcher') {
        return [{ label: 'Site switcher', outline: true }];
      }
      return [{ label: 'Site context', outline: true }];
    }
    if (sec.slot && !sec.items) {
      var slotMeta = SLOT_CATALOG[sec.slot];
      return [{ label: slotMeta ? slotMeta.label : sec.slot, outline: true }];
    }
    return (sec.items || []).filter(function (it) {
      return rolesMatch(it.roles || sec.roles, roles);
    }).map(function (it) {
      return {
        label: itemLabel(it.id),
        outline: sec.buttonStyle === 'outline' || sec.buttonStyle === 'nav',
        primary: it.id === 'btn-publish'
      };
    });
  }

  function previewHtml(draft, roles) {
    roles = Array.isArray(roles) ? roles : [roles || getUserRoles()[0] || 'super'];
    var html = '';
    (draft.sections || []).forEach(function (sec) {
      if (!rolesMatch(sec.roles, roles)) return;
      if (sec.condition === 'site-switcher' && typeof global.lpDrawerShowSiteSwitcher === 'function') {
        try {
          if (!global.lpDrawerShowSiteSwitcher()) return;
        } catch (e) { return; }
      }
      var lines = slotPreviewLines(sec, roles);
      if (!lines.length) return;
      html += '<div class="mmb-psec">';
      if (sec.title) html += '<div class="mmb-psec-title">' + esc(sec.title) + '</div>';
      var grid = sec.layout === 'grid-2';
      if (grid) html += '<div class="mmb-pgrid">';
      lines.forEach(function (line) {
        var cls = 'mmb-pbtn';
        if (line.outline) cls += ' outline';
        if (line.primary) cls += ' primary';
        html += '<div class="' + cls + '">' + esc(line.label) + '</div>';
      });
      if (grid) html += '</div>';
      html += '</div>';
    });
    if (!html) {
      return '<p class="mmb-preview-empty">Nothing visible for this role preview.</p>';
    }
    return html;
  }

  function previewRoleLabel(role) {
    if (role === 'super') return 'Super admin';
    if (role === 'partner') return 'Partner';
    return 'Client';
  }

  function injectBuilderCss() {
    if (document.getElementById('lp-mm-builder-css')) return;
    var s = document.createElement('style');
    s.id = 'lp-mm-builder-css';
    s.textContent = ''
      + '#mm-builder{position:fixed;inset:0;z-index:9999;background:rgba(8,10,14,.78);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);overflow:auto;padding:24px 12px;color:var(--text,var(--ink,#e8edf5));}'
      + '#mm-builder .mmb-card{max-width:980px;margin:0 auto;background:var(--surface,var(--panel,#161b24));color:var(--text,var(--ink,#e8edf5));border:1px solid var(--line,var(--border,#2a3340));border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.45);padding:24px;}'
      + '#mm-builder h1{color:var(--text,var(--ink,#e8edf5));}'
      + '#mm-builder .lede{color:var(--text-soft,var(--ink-soft,#9aa8b8));}'
      + '#mm-builder .mmb-sec{border:1px solid var(--line,var(--border,#2a3340));border-radius:14px;padding:14px 16px;margin-bottom:12px;background:transparent;}'
      + '#mm-builder .mmb-sec-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;}'
      + '#mm-builder .mmb-sec-head input[type=text]{flex:1;min-width:140px;font:inherit;padding:8px 10px;border:1px solid var(--line-strong,var(--border-strong,#d8d2c5));border-radius:8px;background:var(--input-bg,var(--panel,#fff));color:var(--text,var(--ink,#1b2430));}'
      + '#mm-builder .mmb-sec-actions{display:flex;gap:6px;margin-left:auto;}'
      + '#mm-builder .mmb-mini{font:inherit;font-size:12px;padding:5px 9px;border-radius:7px;border:1px solid var(--line,var(--border,#e3e3e0));background:var(--panel,var(--surface,#fff));color:var(--text,var(--ink,#1b2430));cursor:pointer;}'
      + '#mm-builder .mmb-mini:hover{background:var(--accent-soft,rgba(46,204,143,.14));border-color:var(--accent,#1f7a63);}'
      + '#mm-builder .mmb-mini.danger{color:var(--danger,#b42318);border-color:color-mix(in srgb,var(--danger,#b42318) 35%,transparent);background:var(--danger-soft,#fdf3f1);}'
      + '#mm-builder .mmb-row{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:8px;}'
      + '#mm-builder .mmb-f{flex:1;min-width:140px;}'
      + '#mm-builder .mmb-f label{display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--text-soft,var(--ink-soft,#6c6c68));}'
      + '#mm-builder .mmb-f select,#mm-builder .mmb-f input[type=text]{width:100%;font:inherit;padding:7px 9px;border:1px solid var(--line-strong,var(--border-strong,#d8d2c5));border-radius:8px;background:var(--input-bg,var(--panel,#fff));color:var(--text,var(--ink,#1b2430));}'
      + '#mm-builder .mmb-roles{display:flex;flex-wrap:wrap;gap:10px;font-size:13px;color:var(--text,var(--ink,#1b2430));}'
      + '#mm-builder .mmb-role{display:flex;align-items:center;gap:5px;}'
      + '#mm-builder .mmb-slot-note{font-size:12.5px;color:var(--text-soft,var(--ink-soft,#9aa8b8));margin:8px 0;padding:10px 12px;border-radius:10px;background:transparent;border:1px solid color-mix(in srgb,var(--accent,#1f7a63) 25%,transparent);}'
      + '#mm-builder .mmb-live-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}'
      + '#mm-builder .mmb-live-tab{font-size:12px;padding:6px 10px;border-radius:999px;border:1px solid var(--line,var(--border,#e3e3e0));background:var(--panel,var(--surface,#fff));color:var(--text-soft,var(--ink-soft,#5c6675));}'
      + '#mm-builder .mmb-items{margin-top:8px;}'
      + '#mm-builder .mmb-item{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line,var(--border,#f0efea));font-size:13px;color:var(--text,var(--ink,#1b2430));}'
      + '#mm-builder .mmb-item:last-child{border-bottom:none;}'
      + '#mm-builder .mmb-item-name{flex:1;font-weight:500;}'
      + '#mm-builder .mmb-add-row{margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;}'
      + '#mm-builder .mmb-preview-wrap{margin-top:18px;display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,360px);gap:18px;align-items:start;}'
      + '@media(max-width:860px){#mm-builder .mmb-preview-wrap{grid-template-columns:1fr;}}'
      + '#mm-builder .mmb-preview{border:1px dashed var(--line,var(--border,#2a3340));border-radius:14px;padding:14px;background:transparent;max-width:360px;}'
      + '#mm-builder .mmb-preview h3{margin:0 0 10px;font-size:14px;color:var(--text,var(--ink,#1b2430));}'
      + '#mm-builder .mmb-preview-role{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}'
      + '#mm-builder .mmb-preview-role button{font:inherit;font-size:12px;padding:6px 10px;border-radius:999px;border:1px solid var(--line,var(--border,#e3e3e0));background:var(--panel,var(--surface,#fff));color:var(--text-soft,var(--ink-soft,#5c6675));cursor:pointer;}'
      + '#mm-builder .mmb-preview-role button.on{background:var(--accent-soft,rgba(46,204,143,.14));border-color:var(--accent,#1f7a63);color:var(--accent-hover,var(--accent,#1f7a63));font-weight:700;}'
      + '#mm-builder .mmb-psec{margin-bottom:10px;}'
      + '#mm-builder .mmb-psec-title{font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-soft,var(--ink-soft,#8a8a82));margin-bottom:5px;}'
      + '#mm-builder .mmb-pbtn{display:block;width:100%;padding:8px;margin-bottom:5px;border-radius:8px;font-size:13px;text-align:center;border:1px solid var(--line,var(--border,#e3e3e0));background:var(--panel,var(--surface,#fff));color:var(--text,var(--ink,#1b2430));}'
      + '#mm-builder .mmb-pbtn.primary{background:var(--button-bg,var(--accent,#1f7a63));color:var(--accent-text,#fff);border-color:transparent;}'
      + '#mm-builder .mmb-pbtn.outline{background:transparent;color:var(--text,var(--ink,#1b2430));border-color:color-mix(in srgb,var(--accent,#1f7a63) 45%,transparent);}'
      + '#mm-builder .mmb-pgrid{display:grid;grid-template-columns:1fr 1fr;gap:5px;}'
      + '#mm-builder .mmb-preview-empty{font-size:13px;color:var(--text-soft,var(--ink-soft,#8a8a82));margin:0;}'
      + '#mm-builder .mmb-msg{font-size:13px;margin-left:8px;color:var(--text-soft,var(--ink-soft,#5c6675));}';
    document.head.appendChild(s);
  }

  function itemLabel(id) {
    var c = ACTION_CATALOG[id];
    return c ? c.label : id;
  }

  function renderBuilderSection(sec, idx, draft) {
    var itemsHtml = (sec.items || []).map(function (it, i) {
      return '<div class="mmb-item" data-sec="' + idx + '" data-item="' + i + '">'
        + '<span class="mmb-item-name">' + esc(itemLabel(it.id)) + '</span>'
        + '<span class="mmb-roles">' + roleCheckboxes(it.roles || sec.roles, 'item') + '</span>'
        + '<button type="button" class="mmb-mini mmb-item-up" data-sec="' + idx + '" data-item="' + i + '">\u2191</button>'
        + '<button type="button" class="mmb-mini mmb-item-down" data-sec="' + idx + '" data-item="' + i + '">\u2193</button>'
        + '<button type="button" class="mmb-mini danger mmb-item-rm" data-sec="' + idx + '" data-item="' + i + '">Remove</button>'
        + '</div>';
    }).join('');

    var layoutOpts = LAYOUTS.map(function (l) {
      return '<option value="' + l.id + '"' + (sec.layout === l.id ? ' selected' : '') + '>' + l.label + '</option>';
    }).join('');
    var styleOpts = BUTTON_STYLES.map(function (l) {
      return '<option value="' + l.id + '"' + (sec.buttonStyle === l.id ? ' selected' : '') + '>' + l.label + '</option>';
    }).join('');
    var sepOpts = SEPARATORS.map(function (l) {
      return '<option value="' + l.id + '"' + (sec.separator === l.id ? ' selected' : '') + '>' + l.label + '</option>';
    }).join('');

    var slotOpts = '<option value="">— items list —</option>'
      + Object.keys(SLOT_CATALOG).map(function (k) {
        return '<option value="' + k + '"' + (sec.slot === k ? ' selected' : '') + '>' + esc(SLOT_CATALOG[k].label) + '</option>';
      }).join('');

    var itemOpts = Object.keys(ACTION_CATALOG).map(function (k) {
      return '<option value="' + k + '">' + esc(ACTION_CATALOG[k].label) + '</option>';
    }).join('');

    var slotNote = '';
    if (sec.slot === 'adminnav') {
      var tabs = getLiveNavButtons();
      slotNote = '<div class="mmb-slot-note">Builder tabs come from the live editor nav for this site template. '
        + (tabs.length ? 'Currently visible tabs:' : 'No builder tabs are visible for this site yet.')
        + '</div>'
        + (tabs.length ? '<div class="mmb-live-tabs">' + tabs.map(function (t) {
          return '<span class="mmb-live-tab">' + esc(t.label) + '</span>';
        }).join('') + '</div>' : '');
    } else if (sec.slot === 'lpc-context') {
      slotNote = '<div class="mmb-slot-note">Shows the site switcher / editing context when the user has multiple sites or partner access.</div>';
    } else if (sec.slot && !sec.items) {
      var sm = SLOT_CATALOG[sec.slot];
      slotNote = '<div class="mmb-slot-note">Uses the live <strong>' + esc(sm ? sm.label : sec.slot) + '</strong> slot from the command bar.</div>';
    }

    return '<div class="mmb-sec" data-sec-idx="' + idx + '">'
      + '<div class="mmb-sec-head">'
      + '<input type="text" data-sec-title value="' + esc(sec.title || '') + '" placeholder="Section title">'
      + '<div class="mmb-sec-actions">'
      + '<button type="button" class="mmb-mini mmb-sec-up" data-idx="' + idx + '">\u2191</button>'
      + '<button type="button" class="mmb-mini mmb-sec-down" data-idx="' + idx + '">\u2193</button>'
      + '<button type="button" class="mmb-mini danger mmb-sec-rm" data-idx="' + idx + '">Delete</button>'
      + '</div></div>'
      + '<div class="mmb-row">'
      + '<div class="mmb-f"><label>Layout</label><select data-sec-layout>' + layoutOpts + '</select></div>'
      + '<div class="mmb-f"><label>Button style</label><select data-sec-style>' + styleOpts + '</select></div>'
      + '<div class="mmb-f"><label>Separator</label><select data-sec-sep>' + sepOpts + '</select></div>'
      + '<div class="mmb-f"><label>Content slot</label><select data-sec-slot>' + slotOpts + '</select></div>'
      + '</div>'
      + '<div class="mmb-f"><label>Who can see this section</label><div class="mmb-roles">' + roleCheckboxes(sec.roles, 'sec') + '</div></div>'
      + slotNote
      + (sec.items ? ('<div class="mmb-items">' + itemsHtml + '</div>'
        + '<div class="mmb-add-row"><select data-sec-add-item="' + idx + '"><option value="">Add menu item…</option>' + itemOpts + '</select></div>') : '')
      + '</div>';
  }

  function readDraftFromDom(root, draft) {
    root.querySelectorAll('.mmb-sec').forEach(function (secEl) {
      var idx = parseInt(secEl.getAttribute('data-sec-idx'), 10);
      var sec = draft.sections[idx];
      if (!sec) return;
      var t = secEl.querySelector('[data-sec-title]');
      if (t) sec.title = t.value;
      var lay = secEl.querySelector('[data-sec-layout]');
      if (lay) sec.layout = lay.value;
      var sty = secEl.querySelector('[data-sec-style]');
      if (sty) sec.buttonStyle = sty.value;
      var sep = secEl.querySelector('[data-sec-sep]');
      if (sep) sec.separator = sep.value;
      var slot = secEl.querySelector('[data-sec-slot]');
      if (slot) {
        sec.slot = slot.value || undefined;
        if (!sec.slot) delete sec.slot;
      }
      sec.roles = [];
      secEl.querySelectorAll('[data-sec-role]').forEach(function (cb) {
        if (cb.checked) sec.roles.push(cb.getAttribute('data-sec-role'));
      });
      if (!sec.roles.length) sec.roles = ['super', 'partner', 'client'];

      if (sec.items) {
        secEl.querySelectorAll('.mmb-item').forEach(function (itemEl, i) {
          if (!sec.items[i]) return;
          sec.items[i].roles = [];
          itemEl.querySelectorAll('[data-item-role]').forEach(function (cb) {
            if (cb.checked) sec.items[i].roles.push(cb.getAttribute('data-item-role'));
          });
        });
      }
    });
    return draft;
  }

  function rerenderBuilder(body, draft, previewRole) {
    previewRole = previewRole || getUserRoles()[0] || 'super';
    body.innerHTML = draft.sections.map(function (s, i) {
      return renderBuilderSection(s, i, draft);
    }).join('')
      + '<button type="button" class="btn ghost" id="mmb-add-sec">+ Add section</button>';
    var prev = document.getElementById('mmb-preview-body');
    if (prev) prev.innerHTML = previewHtml(draft, previewRole);
    var roleBtns = document.querySelectorAll('#mmb-preview-roles .mmb-preview-role-btn');
    roleBtns.forEach(function (btn) {
      btn.classList.toggle('on', btn.getAttribute('data-preview-role') === previewRole);
    });
  }

  function wireBuilderEvents(body, draft, previewRole) {
    previewRole = previewRole || getUserRoles()[0] || 'super';

    function sync() {
      readDraftFromDom(body, draft);
      var prev = document.getElementById('mmb-preview-body');
      if (prev) prev.innerHTML = previewHtml(draft, previewRole);
    }

    if (body.__mmbWired) return;
    body.__mmbWired = true;

    body.addEventListener('change', function (e) {
      if (e.target.matches('[data-sec-add-item]')) {
        var idx = parseInt(e.target.getAttribute('data-sec-add-item'), 10);
        var id = e.target.value;
        if (id && draft.sections[idx]) {
          if (!draft.sections[idx].items) draft.sections[idx].items = [];
          draft.sections[idx].items.push({ id: id, roles: draft.sections[idx].roles.slice() });
          rerenderBuilder(body, draft, previewRole);
        }
        e.target.value = '';
        return;
      }
      sync();
    });
    body.addEventListener('input', sync);

    body.addEventListener('click', function (e) {
      var up = e.target.closest('.mmb-sec-up');
      if (up) {
        var i = parseInt(up.getAttribute('data-idx'), 10);
        if (i > 0) {
          var tmp = draft.sections[i - 1];
          draft.sections[i - 1] = draft.sections[i];
          draft.sections[i] = tmp;
          rerenderBuilder(body, draft, previewRole);
        }
        return;
      }
      var dn = e.target.closest('.mmb-sec-down');
      if (dn) {
        var j = parseInt(dn.getAttribute('data-idx'), 10);
        if (j < draft.sections.length - 1) {
          var t2 = draft.sections[j + 1];
          draft.sections[j + 1] = draft.sections[j];
          draft.sections[j] = t2;
          rerenderBuilder(body, draft, previewRole);
        }
        return;
      }
      var rm = e.target.closest('.mmb-sec-rm');
      if (rm) {
        var k = parseInt(rm.getAttribute('data-idx'), 10);
        draft.sections.splice(k, 1);
        rerenderBuilder(body, draft, previewRole);
        return;
      }
      var iu = e.target.closest('.mmb-item-up');
      if (iu) {
        var si = parseInt(iu.getAttribute('data-sec'), 10);
        var ii = parseInt(iu.getAttribute('data-item'), 10);
        var arr = draft.sections[si] && draft.sections[si].items;
        if (arr && ii > 0) {
          var t3 = arr[ii - 1]; arr[ii - 1] = arr[ii]; arr[ii] = t3;
          rerenderBuilder(body, draft, previewRole);
        }
        return;
      }
      var idn = e.target.closest('.mmb-item-down');
      if (idn) {
        var si2 = parseInt(idn.getAttribute('data-sec'), 10);
        var ii2 = parseInt(idn.getAttribute('data-item'), 10);
        var arr2 = draft.sections[si2] && draft.sections[si2].items;
        if (arr2 && ii2 < arr2.length - 1) {
          var t4 = arr2[ii2 + 1]; arr2[ii2 + 1] = arr2[ii2]; arr2[ii2] = t4;
          rerenderBuilder(body, draft, previewRole);
        }
        return;
      }
      var irm = e.target.closest('.mmb-item-rm');
      if (irm) {
        var si3 = parseInt(irm.getAttribute('data-sec'), 10);
        var ii3 = parseInt(irm.getAttribute('data-item'), 10);
        if (draft.sections[si3] && draft.sections[si3].items) {
          draft.sections[si3].items.splice(ii3, 1);
          rerenderBuilder(body, draft, previewRole);
        }
        return;
      }
      if (e.target.closest('#mmb-add-sec')) {
        draft.sections.push({
          id: 'sec-' + Date.now(),
          title: 'New section',
          layout: 'stack',
          buttonStyle: 'outline',
          separator: 'line',
          roles: ['super', 'partner', 'client'],
          slot: 'lpc-tools',
          items: []
        });
        rerenderBuilder(body, draft, previewRole);
      }
    });

    var previewRoles = document.getElementById('mmb-preview-roles');
    if (previewRoles && !previewRoles.__mmbWired) {
      previewRoles.__mmbWired = true;
      previewRoles.addEventListener('click', function (e) {
        var btn = e.target.closest('.mmb-preview-role-btn');
        if (!btn) return;
        previewRole = btn.getAttribute('data-preview-role') || previewRole;
        sync();
        previewRoles.querySelectorAll('.mmb-preview-role-btn').forEach(function (b) {
          b.classList.toggle('on', b === btn);
        });
      });
    }
  }

  function closeBuilder() {
    var p = document.getElementById('mm-builder');
    if (p) p.remove();
  }

  async function openBuilder() {
    closeBuilder();
    injectBuilderCss();
    await load(true);
    var draft = deepClone(getConfig());
    var previewRole = getUserRoles()[0] || 'super';

    var p = document.createElement('div');
    p.id = 'mm-builder';
    p.innerHTML = '<div class="mmb-card">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px;">'
      + '<div><h1 style="margin:0;font:700 24px/1.1 var(--font-display,Georgia),serif;">Mobile command menu</h1>'
      + '<p class="lede" style="margin:6px 0 0;">Configure the phone mega menu for the command centre — sections, layouts, separators, button styles, and role access.</p></div>'
      + '<div><button type="button" class="btn ghost" id="mmb-close">Close</button></div></div>'
      + '<div class="mmb-preview-wrap"><div id="mmb-body"></div>'
      + '<div class="mmb-preview" id="mmb-preview"><h3>Phone preview</h3>'
      + '<div class="mmb-preview-role" id="mmb-preview-roles">'
      + ROLES.map(function (r) {
        return '<button type="button" class="mmb-preview-role-btn' + (r === previewRole ? ' on' : '') + '" data-preview-role="' + r + '">' + previewRoleLabel(r) + '</button>';
      }).join('')
      + '</div><div id="mmb-preview-body">' + previewHtml(draft, previewRole) + '</div></div></div>'
      + '<div style="margin-top:16px;display:flex;align-items:center;flex-wrap:wrap;gap:10px;">'
      + '<button type="button" class="btn" id="mmb-save">Save menu</button>'
      + '<button type="button" class="btn ghost" id="mmb-reset">Reset to defaults</button>'
      + '<span class="mmb-msg" id="mmb-msg"></span></div></div>';
    document.body.appendChild(p);

    var body = document.getElementById('mmb-body');
    rerenderBuilder(body, draft, previewRole);
    wireBuilderEvents(body, draft, previewRole);

    document.getElementById('mmb-close').addEventListener('click', closeBuilder);
    p.addEventListener('click', function (e) { if (e.target === p) closeBuilder(); });

    document.getElementById('mmb-reset').addEventListener('click', function () {
      if (!global.confirm('Reset the mobile menu to factory defaults?')) return;
      draft = deepClone(defaults || FALLBACK_DEFAULT);
      rerenderBuilder(body, draft, previewRole);
    });

    document.getElementById('mmb-save').addEventListener('click', async function () {
      var btn = this;
      var msg = document.getElementById('mmb-msg');
      readDraftFromDom(body, draft);
      btn.disabled = true;
      msg.textContent = 'Saving…';
      msg.style.color = '';
      try {
        var j = await save(draft);
        btn.disabled = false;
        if (j && j.ok) {
          msg.textContent = 'Saved — hamburger menu updated.';
          msg.style.color = '#0a7d33';
        } else if (j && j._status === 401) {
          msg.textContent = 'Please sign in again, then retry.';
          msg.style.color = '#b42318';
        } else if (j && j._status === 403) {
          msg.textContent = 'Super admin access required to save.';
          msg.style.color = '#b42318';
        } else {
          msg.textContent = (j && j.error) || 'Save failed';
          msg.style.color = '#b42318';
        }
      } catch (e) {
        btn.disabled = false;
        msg.textContent = 'Save failed — check your connection.';
        msg.style.color = '#b42318';
      }
    });
  }

  global.LPMobileMenu = {
    load: load,
    getConfig: getConfig,
    getUserRoles: getUserRoles,
    applyDrawer: applyDrawer,
    prepareDrawerSlots: prepareDrawerSlots,
    openBuilder: openBuilder,
    invalidate: invalidate,
    save: save,
    ACTION_CATALOG: ACTION_CATALOG,
    SLOT_CATALOG: SLOT_CATALOG,
    ROLES: ROLES
  };

  global.openMobileMenuBuilder = openBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
