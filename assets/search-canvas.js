/**
 * SearchCanvas client behaviour — tabs (desktop) + accordion (mobile).
 * Content is already in the HTML; this only toggles visibility / ARIA.
 */
(function () {
  'use strict';

  function track(name, payload) {
    try {
      if (typeof window.lpTrack === 'function') window.lpTrack(name, payload || {});
      else if (window.dataLayer && typeof window.dataLayer.push === 'function') {
        window.dataLayer.push(Object.assign({ event: name }, payload || {}));
      }
    } catch (_e) {}
  }

  function activateTab(root, tabId, opts) {
    if (!root || !tabId) return;
    var tabs = root.querySelectorAll('[data-sc-tab]');
    var panels = root.querySelectorAll('[data-sc-panel]');
    var figures = root.querySelectorAll('[data-sc-figure]');
    tabs.forEach(function (btn) {
      var on = btn.getAttribute('data-sc-tab') === tabId;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.setAttribute('tabindex', on ? '0' : '-1');
    });
    panels.forEach(function (panel) {
      var on = panel.getAttribute('data-sc-panel') === tabId;
      panel.classList.toggle('is-active', on);
      if (on) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    });
    figures.forEach(function (fig) {
      var on = fig.getAttribute('data-sc-figure') === tabId;
      fig.classList.toggle('is-active', on);
      if (on) fig.removeAttribute('hidden');
      else fig.setAttribute('hidden', '');
    });
    if (!opts || !opts.silent) {
      track('searchcanvas_tab_change', {
        appInstanceId: root.getAttribute('data-sc-uid') || '',
        tabId: tabId,
        source: (opts && opts.source) || 'click'
      });
    }
  }

  function wireDesktop(root) {
    var list = root.querySelector('.sc-tabs');
    if (!list) return;
    list.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-sc-tab]') : null;
      if (!btn || !list.contains(btn)) return;
      activateTab(root, btn.getAttribute('data-sc-tab'), { source: 'click' });
    });
    list.addEventListener('keydown', function (e) {
      var buttons = Array.prototype.slice.call(list.querySelectorAll('[data-sc-tab]'));
      if (!buttons.length) return;
      var current = document.activeElement;
      var ix = buttons.indexOf(current);
      if (ix < 0) return;
      var next = -1;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (ix + 1) % buttons.length;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (ix - 1 + buttons.length) % buttons.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = buttons.length - 1;
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activateTab(root, current.getAttribute('data-sc-tab'), { source: 'keyboard' });
        return;
      }
      if (next >= 0) {
        e.preventDefault();
        buttons[next].focus();
        activateTab(root, buttons[next].getAttribute('data-sc-tab'), { source: 'keyboard' });
      }
    });
  }

  function wireMobile(root) {
    var mode = root.getAttribute('data-sc-mobile') || 'single-accordion';
    var host = root.querySelector('[data-sc-mobile-root]');
    if (!host) return;
    host.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-sc-acc-btn]') : null;
      if (!btn || !host.contains(btn)) return;
      var id = btn.getAttribute('data-sc-acc-btn');
      var item = btn.closest('.sc-acc-item');
      var panel = item && item.querySelector('.sc-acc-panel');
      var open = btn.getAttribute('aria-expanded') === 'true';
      if (mode === 'single-accordion') {
        host.querySelectorAll('.sc-acc-item').forEach(function (el) {
          var b = el.querySelector('[data-sc-acc-btn]');
          var p = el.querySelector('.sc-acc-panel');
          var isSelf = el === item;
          el.classList.toggle('is-open', isSelf ? !open : false);
          if (b) b.setAttribute('aria-expanded', isSelf && !open ? 'true' : 'false');
          if (p) {
            if (isSelf && !open) p.removeAttribute('hidden');
            else p.setAttribute('hidden', '');
          }
        });
      } else {
        item.classList.toggle('is-open', !open);
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        if (panel) {
          if (open) panel.setAttribute('hidden', '');
          else panel.removeAttribute('hidden');
        }
      }
      track('searchcanvas_tab_change', {
        appInstanceId: root.getAttribute('data-sc-uid') || '',
        tabId: id,
        source: 'accordion'
      });
    });
  }

  function wireClicks(root) {
    root.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[data-sc-link], a[data-sc-btn], a[data-sc-cta]') : null;
      if (!a || !root.contains(a)) return;
      var href = String(a.getAttribute('href') || '');
      var action = a.getAttribute('data-sc-cta-action') || '';
      if (!action) {
        if (/^tel:/i.test(href)) action = 'call';
        else if (/#quote/i.test(href)) action = 'quote';
        else action = a.getAttribute('data-sc-cta') ? 'custom' : 'link';
      }
      var kind = a.getAttribute('data-sc-cta')
        ? 'searchcanvas_cta_click'
        : 'searchcanvas_internal_link_click';
      track(kind, {
        appInstanceId: root.getAttribute('data-sc-uid') || '',
        tabId: a.getAttribute('data-sc-link') || a.getAttribute('data-sc-btn') || '',
        source: a.getAttribute('data-sc-cta') || 'link',
        action: action,
        href: href
      });
    });
  }

  function initRoot(root) {
    if (!root || root.__scBound) return;
    root.__scBound = true;
    root.classList.add('is-on');
    root.setAttribute('data-sc-on', '1');
    wireDesktop(root);
    wireMobile(root);
    wireClicks(root);
    var def = root.getAttribute('data-sc-default');
    if (def) activateTab(root, def, { silent: true });
    track('searchcanvas_view', {
      appInstanceId: root.getAttribute('data-sc-uid') || '',
      source: 'page'
    });
  }

  function initAll(scope) {
    var root = scope || document;
    root.querySelectorAll('section[data-sec="searchCanvas"]').forEach(initRoot);
  }

  window.lpInitSearchCanvas = initAll;
  window.lpSearchCanvasActivate = activateTab;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll(document);
    });
  } else {
    initAll(document);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function destHref(dest) {
    if (!dest) return '';
    if (typeof dest === 'string') return dest;
    var type = dest.type || 'url';
    var value = String(dest.value || '').trim();
    if (!value) return '';
    if (type === 'phone' || type === 'tel') return value.indexOf('tel:') === 0 ? value : 'tel:' + value.replace(/\s+/g, '');
    if (type === 'email' || type === 'mailto') return value.indexOf('mailto:') === 0 ? value : 'mailto:' + value;
    return value;
  }

  function deriveAccent(hex) {
    var h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return null;
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    function mix(t) {
      return '#' + [r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t].map(function (n) {
        var s = Math.max(0, Math.min(255, Math.round(n))).toString(16);
        return s.length === 1 ? '0' + s : s;
      }).join('');
    }
    var lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return {
      accent: '#' + h,
      accentSoft: mix(0.88),
      accentHover: '#' + [r * 0.88, g * 0.88, b * 0.88].map(function (n) {
        var s = Math.max(0, Math.min(255, Math.round(n))).toString(16);
        return s.length === 1 ? '0' + s : s;
      }).join(''),
      accentContrast: lum > 0.55 ? '#0b1220' : '#ffffff',
      accentBorder: mix(0.45)
    };
  }

  function iconSvg(key) {
    if (!key || !window.LP_ICONS || !window.LP_ICONS[key]) return '';
    return '<svg class="sc-ic lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + window.LP_ICONS[key] + '</svg>';
  }

  function bulletTickHtml(tab, style) {
    var key = (tab && tab.bulletIconKey) || (style && style.bulletIconKey) || 'check';
    var svg = iconSvg(key) || iconSvg('check');
    return '<span class="sc-tick" aria-hidden="true">' + svg + '</span>';
  }

  function paragraphsHtml(text) {
    var raw = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!raw) return '';
    return raw.split(/\n\s*\n/).map(function (p) {
      return '<p class="sc-p">' + esc(p).replace(/\n/g, '<br>\n') + '</p>';
    }).join('\n');
  }

  function supportHeadingHtml(text) {
    var raw = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!raw) return '';
    return '<h4 class="sc-tab-support">' + esc(raw).replace(/\n/g, '<br>\n') + '</h4>';
  }

  function emptyStateHtml(header) {
    return (
      '<div class="wrap sc-wrap">' +
      '<header class="sc-header">' +
      (header.eyebrow ? '<p class="eyebrow sc-eyebrow">' + esc(header.eyebrow) + '</p>' : '') +
      (header.heading ? '<h2 class="sc-heading">' + esc(header.heading) + '</h2>' : '') +
      (header.intro ? '<p class="sc-intro">' + esc(header.intro) + '</p>' : '') +
      '</header>' +
      '<div class="sc-empty" role="status"><p class="sc-empty-msg">Generate with AI to create service tabs for this business.</p></div>' +
      '</div>'
    );
  }

  /**
   * Paint SearchCanvas from site config into the section node (live preview + client boot).
   * Never invents Planning/Delivery placeholders. Empty tabs → header + generate prompt.
   * Does not mutate the live config object.
   */
  window.lpPaintSearchCanvas = function (cfgOrSection, rootOpt) {
    var src = cfgOrSection && cfgOrSection.tabs ? cfgOrSection : (cfgOrSection && cfgOrSection.sections && cfgOrSection.sections.searchCanvas) || cfgOrSection || {};
    var cfg = src;
    var root = rootOpt || document.querySelector('[data-sec="searchCanvas"]');
    if (!root) return;
    var on = cfg.on === true;
    root.classList.toggle('is-on', on);
    root.setAttribute('data-sc-on', on ? '1' : '0');
    if (!on) {
      root.style.display = 'none';
      return;
    }

    var header = (cfg.header && typeof cfg.header === 'object') ? cfg.header : {
      eyebrow: 'Our expertise',
      heading: 'Solutions designed around your business',
      intro: 'Explore the services our team provides — generate with AI to build service tabs.',
      colours: {}
    };
    var style = cfg.style || {};
    var layout = cfg.layout || {};
    var cta = cfg.cta || {};
    var tabs = (Array.isArray(cfg.tabs) ? cfg.tabs : []).filter(function (t) { return t && t.on !== false; }).slice(0, 12);

    var uid = root.getAttribute('data-sc-uid') || 'sc';
    root.setAttribute('data-sc-uid', uid);
    root.setAttribute('data-sc-mobile', layout.mobileMode === 'multi-accordion' ? 'multi-accordion' : 'single-accordion');
    root.className = 'section sc-section is-on sc-radius-' + (style.radius || 'medium') +
      ' sc-shadow-' + (style.shadow || 'soft') +
      ' sc-width-' + (layout.contentWidth || 'wide') +
      ' sc-preset-' + (layout.preset || 'vertical-tabs-image-right') +
      (layout.imageMode === 'none' ? ' sc-no-image' : layout.imageMode === 'shared' ? ' sc-shared-image' : ' sc-per-tab-image') +
      (tabs.length ? '' : ' sc-empty-tabs');

    var accent = deriveAccent(style.masterColour);
    function setVar(name, val) {
      if (val) root.style.setProperty(name, val);
      else root.style.removeProperty(name);
    }
    if (accent) {
      setVar('--sc-accent', accent.accent);
      setVar('--sc-accent-soft', accent.accentSoft);
      setVar('--sc-accent-hover', accent.accentHover);
      setVar('--sc-accent-contrast', accent.accentContrast);
      setVar('--sc-accent-border', accent.accentBorder);
    }
    [['sectionBackground', '--sc-section-bg'], ['panelBackground', '--sc-panel-bg'], ['tabBackground', '--sc-tab-bg'], ['activeTabBackground', '--sc-tab-active-bg'], ['borderColour', '--sc-border'], ['headingColour', '--sc-heading'], ['bodyColour', '--sc-body'], ['mutedColour', '--sc-muted']].forEach(function (p) {
      setVar(p[1], style[p[0]]);
    });
    var hc = header.colours || {};
    setVar('--sc-eyebrow-color', hc.eyebrow);
    setVar('--sc-heading-color', hc.heading);
    setVar('--sc-intro-color', hc.intro);
    root.style.display = 'block';

    if (!tabs.length) {
      root.innerHTML = emptyStateHtml(header);
      root.__scBound = false;
      return;
    }

    var defaultId = cfg.defaultTabId || (tabs[0] && tabs[0].id) || 'tab-0';
    if (!tabs.some(function (t) { return t.id === defaultId; })) defaultId = tabs[0].id || 'tab-0';
    tabs.forEach(function (t, i) { if (!t.id) t.id = 'tab-' + i; });
    root.setAttribute('data-sc-default', defaultId);

    var imageMode = layout.imageMode || 'per-tab';
    var shared = imageMode === 'shared' ? tabs.find(function (t) { return t.image && t.image.url; }) : null;

    function tabImage(tab) {
      if (imageMode === 'none') return null;
      if (imageMode === 'shared') return shared && shared.image;
      return tab.image && tab.image.url ? tab.image : null;
    }

    function panelHtml(tab, active) {
      var href = destHref(tab.link && tab.link.destination);
      var bullets = (tab.bullets || []).map(function (b) {
        return '<li>' + bulletTickHtml(tab, style) + '<span>' + esc(b) + '</span></li>';
      }).join('');
      return '<article class="sc-panel' + (active ? ' is-active' : '') + '" role="tabpanel" id="' + uid + '-panel-' + esc(tab.id) + '" aria-labelledby="' + uid + '-tab-' + esc(tab.id) + '"' + (active ? '' : ' hidden') + ' data-sc-panel="' + esc(tab.id) + '">' +
        '<h3 class="sc-tab-heading">' + esc(tab.heading || tab.label) + '</h3>' +
        (tab.intro ? '<p class="sc-tab-intro">' + esc(tab.intro) + '</p>' : '') +
        supportHeadingHtml(tab.content) +
        (bullets ? '<ul class="sc-bullets">' + bullets + '</ul>' : '') +
        (tab.link && tab.link.label ? (href ? '<a class="sc-text-link" href="' + esc(href) + '" data-sc-link="' + esc(tab.id) + '">' + esc(tab.link.label) + ' <span aria-hidden="true">→</span></a>' : '<span class="sc-text-link sc-link-disconnected">' + esc(tab.link.label) + '</span>') : '') +
        '</article>';
    }

    function figureHtml(tab, active) {
      var img = tabImage(tab);
      if (!img || !img.url) {
        return '<figure class="sc-figure sc-figure-empty' + (active ? ' is-active' : '') + '" data-sc-figure="' + esc(tab.id) + '"' + (active ? '' : ' hidden') + '><div class="sc-figure-ph" aria-hidden="true"></div></figure>';
      }
      return '<figure class="sc-figure' + (active ? ' is-active' : '') + '" data-sc-figure="' + esc(tab.id) + '"' + (active ? '' : ' hidden') + '>' +
        '<img class="sc-img" src="' + esc(img.url) + '" alt="' + esc(img.alt || tab.heading || tab.label) + '" loading="' + (active ? 'eager' : 'lazy') + '" style="object-fit:' + (function () {
          var f = String((img && img.fit) || '').toLowerCase();
          if (f === 'stretch') f = 'fill';
          return f === 'contain' || f === 'fill' || f === 'none' || f === 'scale-down' ? f : 'cover';
        })() + ';object-position:' + esc(img.objectPosition || 'center') + '"></figure>';
    }

    var tabButtons = tabs.map(function (tab) {
      var active = tab.id === defaultId;
      return '<button type="button" class="sc-tab' + (active ? ' is-active' : '') + '" role="tab" id="' + uid + '-tab-' + esc(tab.id) + '" aria-selected="' + (active ? 'true' : 'false') + '" aria-controls="' + uid + '-panel-' + esc(tab.id) + '" tabindex="' + (active ? '0' : '-1') + '" data-sc-tab="' + esc(tab.id) + '">' +
        '<span class="sc-tab-ic">' + iconSvg(tab.iconKey) + '</span><span class="sc-tab-label">' + esc(tab.label) + '</span><span class="sc-tab-chev" aria-hidden="true"></span></button>';
    }).join('');

    var accordion = tabs.map(function (tab) {
      var open = tab.id === defaultId;
      var img = tabImage(tab);
      return '<div class="sc-acc-item' + (open ? ' is-open' : '') + '" data-sc-acc="' + esc(tab.id) + '">' +
        '<h3 class="sc-acc-h"><button type="button" class="sc-acc-btn" id="' + uid + '-acc-' + esc(tab.id) + '" aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="' + uid + '-acc-panel-' + esc(tab.id) + '" data-sc-acc-btn="' + esc(tab.id) + '">' +
        '<span class="sc-tab-ic">' + iconSvg(tab.iconKey) + '</span><span class="sc-tab-label">' + esc(tab.label || tab.heading) + '</span><span class="sc-tab-chev" aria-hidden="true"></span></button></h3>' +
        '<div class="sc-acc-panel" id="' + uid + '-acc-panel-' + esc(tab.id) + '" role="region"' + (open ? '' : ' hidden') + '>' +
        (img && img.url ? '<figure class="sc-figure sc-acc-figure"><img class="sc-img" src="' + esc(img.url) + '" alt="' + esc(img.alt || tab.heading || '') + '" loading="lazy"></figure>' : '') +
        '<div class="sc-acc-copy"><h3 class="sc-tab-heading">' + esc(tab.heading || tab.label) + '</h3>' +
        (tab.intro ? '<p class="sc-tab-intro">' + esc(tab.intro) + '</p>' : '') +
        supportHeadingHtml(tab.content) +
        ((tab.bullets || []).length ? '<ul class="sc-bullets">' + tab.bullets.map(function (b) { return '<li>' + bulletTickHtml(tab, style) + '<span>' + esc(b) + '</span></li>'; }).join('') + '</ul>' : '') +
        '</div></div></div>';
    }).join('');

    var ctaHtml = '';
    if (cta.enabled && (cta.heading || cta.text || cta.primaryLabel)) {
      var dest = cta.primaryDestination;
      if (!dest || !destHref(dest)) {
        dest = { type: 'section', value: '#quote' };
      }
      var pHref = destHref(dest);
      var ctaAction = cta.action || (/^tel:/i.test(pHref) ? 'call' : /#quote/i.test(pHref) ? 'quote' : 'custom');
      var ctaLabel = cta.primaryLabel || (ctaAction === 'call' ? 'Call Now' : 'Get a Free Quote');
      ctaHtml = '<aside class="sc-cta sc-cta-' + esc(cta.style || 'strip') + '">' +
        '<div class="sc-cta-copy">' +
        (cta.heading ? '<p class="sc-cta-heading">' + esc(cta.heading) + '</p>' : '') +
        (cta.text ? '<p class="sc-cta-text">' + esc(cta.text) + '</p>' : '') +
        '</div><div class="sc-cta-actions">' +
        (ctaLabel ? '<a class="sc-btn" href="' + esc(pHref || '#quote') + '" data-sc-cta="primary" data-sc-cta-action="' + esc(ctaAction) + '">' + esc(ctaLabel) + '</a>' : '') +
        '</div></aside>';
    }

    root.innerHTML =
      '<div class="wrap sc-wrap">' +
      '<header class="sc-header">' +
      (header.eyebrow ? '<p class="eyebrow sc-eyebrow">' + esc(header.eyebrow) + '</p>' : '') +
      (header.heading ? '<h2 class="sc-heading">' + esc(header.heading) + '</h2>' : '') +
      (header.intro ? '<p class="sc-intro">' + esc(header.intro) + '</p>' : '') +
      '</header>' +
      '<div class="search-canvas sc-desktop" data-sc-desktop>' +
      '<nav class="sc-tabs" role="tablist" aria-label="SearchCanvas topics">' + tabButtons + '</nav>' +
      '<div class="sc-main"><div class="sc-panels">' + tabs.map(function (t) { return panelHtml(t, t.id === defaultId); }).join('') + '</div>' +
      '<div class="sc-media">' + tabs.map(function (t) { return figureHtml(t, t.id === defaultId); }).join('') + '</div></div></div>' +
      '<div class="sc-mobile" data-sc-mobile-root>' + accordion + '</div>' +
      ctaHtml +
      '</div>';

    root.__scBound = false;
    initRoot(root);
  };
})();
