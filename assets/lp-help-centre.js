/**
 * LeadPages Help Centre — contextual overlay for Manage + standalone /help.
 * API: LPHelp.open(id), .close(), .showMe(id), .needHelpButton(id)
 * Keyboard: / or Ctrl/Cmd+K opens search. Esc closes.
 */
(function (global) {
  'use strict';

  var CATALOGUE_URL = '/assets/help/catalogue.json';
  var ZONES = ['Navigation', 'Hero', 'Upper', 'Mid', 'Lower', 'Footer'];
  var CHECKS = [
    { id: 'editor', label: 'Find a section in Page editor', topic: 'page-editor' },
    { id: 'market', label: 'Turn an app on in Marketplace', topic: 'marketplace' },
    { id: 'preview', label: 'Check Live Preview on a phone width', topic: 'journey-publish' },
    { id: 'publish', label: 'Publish so visitors see the change', topic: 'publish' },
    { id: 'backup', label: 'Know where Backups is', topic: 'backups' }
  ];
  var GUIDE_SHOW = {
    'getting-started': { view: 'dashboard' },
    'page-editor': { view: 'details' },
    marketplace: { view: 'apps' },
    publish: { selector: '#btn-publish' },
    backups: { selector: '#lpc-backups' },
    images: { selector: '#lpc-image-library' },
    appearance: { view: 'appearance' },
    dashboard: { view: 'dashboard' },
    'landing-pages': { view: 'landing' },
    billing: { selector: '#btn-billing' },
    seo: { view: 'seo' },
    advertising: { view: 'advertising' },
    orders: { view: 'orders' },
    bookings: { view: 'bookings' },
    'quote-builder': { view: 'onlinequotes' },
    newsletter: { view: 'mailer' },
    'support-ticket': { view: 'messages' },
    onlineQuote: { view: 'onlinequotes' },
    orderStorefront: { view: 'orders' },
    bookingStorefront: { view: 'bookings' }
  };

  var state = {
    ready: false,
    loading: null,
    data: null,
    topicId: null,
    query: '',
    navOpen: false,
    zone: 'Hero',
    hits: [],
    hitIndex: 0,
    returnTopic: null,
    pendingShow: false,
    spotEl: null
  };
  var root = null;
  var spot = null;
  var coach = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function inlineMd(t) {
    t = esc(t);
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    return t;
  }

  function stepPlain(step) {
    if (step == null) return '';
    if (typeof step === 'string') return step;
    return step.text || step.title || step.label || '';
  }

  function lsGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (_e) {
      return fallback;
    }
  }

  function lsSet(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_e) {}
  }

  function kindLabel(t) {
    if (!t) return 'Guide';
    if (t.kind === 'app') return 'App';
    if (t.kind === 'journey') return 'Walkthrough';
    if (t.kind === 'fix') return 'Fix';
    return 'Guide';
  }

  function minutesOf(t) {
    if (!t) return 2;
    if (t.minutes) return t.minutes;
    return Math.max(2, (t.steps || []).length || 2);
  }

  function resolveId(raw) {
    if (!raw || !state.data) return null;
    var id = String(raw).trim();
    if (!id) return null;
    var aliases = state.data.aliases || {};
    if (aliases[id]) id = aliases[id];
    var topics = state.data.topics || [];
    for (var i = 0; i < topics.length; i++) {
      if (topics[i].id === id) return id;
      if (topics[i].sectionKey === id) return topics[i].id;
    }
    var lower = id.toLowerCase();
    for (var j = 0; j < topics.length; j++) {
      if (String(topics[j].id).toLowerCase() === lower) return topics[j].id;
      if (String(topics[j].sectionKey || '').toLowerCase() === lower) return topics[j].id;
    }
    return id;
  }

  function getTopic(id) {
    id = resolveId(id);
    var topics = (state.data && state.data.topics) || [];
    for (var i = 0; i < topics.length; i++) if (topics[i].id === id) return topics[i];
    return null;
  }

  function topicsByKind(kind) {
    return ((state.data && state.data.topics) || []).filter(function (t) {
      return t.kind === kind;
    });
  }

  function appsInZone(zone) {
    var z = String(zone || '').toLowerCase();
    return topicsByKind('app').filter(function (t) {
      return String(t.zone || '').toLowerCase() === z;
    });
  }

  function ensureFonts() {
    if (document.getElementById('lph-fonts')) return;
    var l = document.createElement('link');
    l.id = 'lph-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(l);
  }

  function ensureCss() {
    if (document.getElementById('lph-css')) return;
    var l = document.createElement('link');
    l.id = 'lph-css';
    l.rel = 'stylesheet';
    l.href = '/assets/lp-help-centre.css?v=2';
    document.head.appendChild(l);
  }

  function loadCatalogue() {
    if (state.data) return Promise.resolve(state.data);
    if (state.loading) return state.loading;
    state.loading = fetch(CATALOGUE_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('Could not load help catalogue');
        return r.json();
      })
      .then(function (j) {
        state.data = j;
        state.ready = true;
        state.loading = null;
        return j;
      })
      .catch(function (e) {
        state.loading = null;
        throw e;
      });
    return state.loading;
  }

  function diagramSvg(kind) {
    if (kind !== 'nav-map') return '';
    return (
      '<svg viewBox="0 0 420 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect width="420" height="220" rx="14" fill="#0f1714"/>' +
      '<text x="20" y="28" fill="#8fb5a6" font-size="11" font-family="DM Sans,sans-serif" letter-spacing="1">COMMAND CENTRE</text>' +
      [
        ['Dashboard', 20],
        ['Page editor', 92],
        ['Apps', 164],
        ['Publish', 236],
        ['Support', 308]
      ]
        .map(function (b, i) {
          return (
            '<rect x="' +
            b[1] +
            '" y="48" width="64" height="36" rx="8" fill="' +
            (i === 1 ? '#1f7a63' : '#1c2a24') +
            '" stroke="#2f463c"/>' +
            '<text x="' +
            (b[1] + 32) +
            '" y="70" text-anchor="middle" fill="#e8f4ef" font-size="9" font-family="DM Sans,sans-serif">' +
            b[0] +
            '</text>'
          );
        })
        .join('') +
      '<path d="M52 96v28h140v28" stroke="#3d6b58" stroke-width="2" fill="none"/>' +
      '<rect x="160" y="152" width="180" height="44" rx="10" fill="#155c4a"/>' +
      '<text x="250" y="178" text-anchor="middle" fill="#fff" font-size="12" font-family="Archivo,sans-serif" font-weight="700">Live Preview → Publish</text>' +
      '</svg>'
    );
  }

  function pageMock(activeZone) {
    var html =
      '<div class="lph-mock" role="list">' +
      ZONES.map(function (z) {
        var n = appsInZone(z).length;
        var on = activeZone && String(activeZone).toLowerCase() === z.toLowerCase();
        return (
          '<button type="button" data-lph-zone="' +
          esc(z) +
          '" class="' +
          (on ? 'on' : '') +
          '"><span>' +
          esc(z) +
          (on ? ' · you are here' : '') +
          '</span><small>' +
          n +
          '</small></button>'
        );
      }).join('') +
      '</div>';
    html += zoneAppsHtml(activeZone);
    return html;
  }

  function zoneAppsHtml(zone) {
    var apps = appsInZone(zone);
    if (!apps.length) return '<p class="lph-zone-empty">No apps filed under ' + esc(zone || 'this zone') + '.</p>';
    return (
      '<div class="lph-zone-apps">' +
      apps
        .map(function (t) {
          return '<button type="button" data-lph-topic="' + esc(t.id) + '">' + esc(t.title) + '</button>';
        })
        .join('') +
      '</div>'
    );
  }

  function haystack(t) {
    var steps = (t.steps || []).map(stepPlain).join(' ');
    var choices = (t.choices || [])
      .map(function (c) {
        return (c.when || '') + ' ' + (c.do || '');
      })
      .join(' ');
    return [t.title, t.summary, t.body, t.answer, t.category, t.sectionKey, t.zone, (t.keywords || []).join(' '), steps, choices, (t.features || []).join(' ')]
      .join(' ')
      .toLowerCase();
  }

  function scoreOne(t, tok) {
    var title = String(t.title || '').toLowerCase();
    var s = 0;
    if (title === tok) s += 200;
    else if (title.indexOf(tok) === 0) s += 120;
    else if (title.indexOf(tok) >= 0) s += 80;
    if (String(t.id || '').toLowerCase().indexOf(tok) >= 0) s += 36;
    if (String(t.sectionKey || '').toLowerCase().indexOf(tok) >= 0) s += 36;
    if ((t.keywords || []).join(' ').toLowerCase().indexOf(tok) >= 0) s += 48;
    if (String(t.summary || t.answer || '').toLowerCase().indexOf(tok) >= 0) s += 24;
    if (String(t.category || '').toLowerCase().indexOf(tok) >= 0) s += 12;
    if ((t.steps || []).map(stepPlain).join(' ').toLowerCase().indexOf(tok) >= 0) s += 14;
    if (String(t.body || '').toLowerCase().indexOf(tok) >= 0) s += 8;
    if (t.kind === 'journey') s += 6;
    if (t.kind === 'fix') s += 4;
    return s;
  }

  function searchHits(q) {
    q = String(q || '').trim().toLowerCase();
    if (!q || !state.data) return [];
    var tokens = q.split(/\s+/).filter(Boolean);
    var hits = [];
    (state.data.topics || []).forEach(function (t) {
      var hay = haystack(t);
      for (var i = 0; i < tokens.length; i++) if (hay.indexOf(tokens[i]) < 0) return;
      var s = 0;
      tokens.forEach(function (tok) {
        s += scoreOne(t, tok);
      });
      hits.push({ t: t, s: s });
    });
    hits.sort(function (a, b) {
      return b.s - a.s || String(a.t.title).localeCompare(String(b.t.title));
    });
    return hits.slice(0, 8);
  }

  function markText(text, q) {
    var safe = esc(text || '');
    String(q || '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .forEach(function (tok) {
        var et = esc(tok).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        safe = safe.replace(new RegExp('(' + et + ')', 'ig'), '<mark>$1</mark>');
      });
    return safe;
  }

  function groupTopics() {
    var topics = (state.data && state.data.topics) || [];
    var q = (state.query || '').trim().toLowerCase();
    var tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    var groups = {};
    var order = [];
    topics.forEach(function (t) {
      if (tokens.length) {
        var hay = haystack(t);
        for (var i = 0; i < tokens.length; i++) if (hay.indexOf(tokens[i]) < 0) return;
      }
      var c = t.category || 'General';
      if (!groups[c]) {
        groups[c] = [];
        order.push(c);
      }
      groups[c].push(t);
    });
    return { groups: groups, order: order };
  }

  function renderNav() {
    var nav = root.querySelector('.lph-nav');
    if (!nav) return;
    var g = groupTopics();
    var html = '';
    g.order.forEach(function (cat) {
      html += '<h3>' + esc(cat) + '</h3>';
      g.groups[cat].forEach(function (t) {
        html +=
          '<a href="#help/' +
          encodeURIComponent(t.id) +
          '" data-lph-topic="' +
          esc(t.id) +
          '" class="' +
          (state.topicId === t.id ? 'on' : '') +
          '"><span class="lph-nav-k">' +
          esc(kindLabel(t)) +
          '</span>' +
          esc(t.title) +
          '</a>';
      });
    });
    if (!html) html = '<p class="lph-empty" style="padding:12px">No matches. Try “publish”, “menu”, or “photo”.</p>';
    nav.innerHTML = html;
    nav.classList.toggle('is-open', !!state.navOpen);
  }

  function renderSuggest() {
    var box = root && root.querySelector('#lph-suggest');
    if (!box) return;
    state.hits = searchHits(state.query);
    if (!String(state.query || '').trim()) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    if (!state.hits.length) {
      box.hidden = false;
      box.innerHTML = '<p class="lph-suggest-empty">Nothing for that. Request paid help and we will do it.</p>';
      return;
    }
    if (state.hitIndex >= state.hits.length) state.hitIndex = 0;
    box.hidden = false;
    box.innerHTML = state.hits
      .map(function (h, i) {
        return (
          '<button type="button" class="lph-hit' +
          (i === state.hitIndex ? ' on' : '') +
          '" data-lph-topic="' +
          esc(h.t.id) +
          '"><span class="lph-hit-k">' +
          esc(kindLabel(h.t)) +
          '</span><strong>' +
          markText(h.t.title, state.query) +
          '</strong><em>' +
          esc(h.t.summary || '') +
          '</em></button>'
        );
      })
      .join('');
  }

  function cardBtn(t) {
    return (
      '<button type="button" class="lph-home-card" data-lph-topic="' +
      esc(t.id) +
      '"><span class="lph-hit-k">' +
      esc(kindLabel(t)) +
      ' · ' +
      minutesOf(t) +
      ' min</span><strong>' +
      esc(t.title) +
      '</strong><span>' +
      esc(t.summary || '') +
      '</span></button>'
    );
  }

  function renderChecklist() {
    var done = lsGet('lph-check', {});
    var n = CHECKS.filter(function (c) {
      return done[c.id];
    }).length;
    return (
      '<div class="lph-card"><h3>First session <span class="lph-count">' +
      n +
      '/' +
      CHECKS.length +
      '</span></h3><ul class="lph-checks">' +
      CHECKS.map(function (c) {
        return (
          '<li><label><input type="checkbox" data-lph-check="' +
          esc(c.id) +
          '"' +
          (done[c.id] ? ' checked' : '') +
          '> <span>' +
          esc(c.label) +
          '</span></label> <button type="button" class="lph-texty" data-lph-topic="' +
          esc(c.topic) +
          '">Guide</button></li>'
        );
      }).join('') +
      '</ul></div>'
    );
  }

  function renderRecent() {
    var ids = lsGet('lph-recent', []);
    var buttons = ids
      .map(function (id) {
        return getTopic(id);
      })
      .filter(Boolean)
      .map(function (t) {
        return '<button type="button" data-lph-topic="' + esc(t.id) + '">' + esc(t.title) + '</button>';
      })
      .join('');
    if (!buttons) buttons = '<p class="lph-quiet">Guides you open will sit here.</p>';
    return '<div class="lph-card"><h3>Recent</h3><div class="lph-related">' + buttons + '</div></div>';
  }

  function renderHome() {
    var main = root.querySelector('.lph-main');
    var topics = (state.data && state.data.topics) || [];
    var apps = topics.filter(function (t) {
      return t.kind === 'app';
    }).length;
    var journeys = topicsByKind('journey');
    var fixes = topicsByKind('fix');
    var featured = ['getting-started', 'page-editor', 'marketplace', 'publish', 'backups', 'images', 'support-ticket']
      .map(getTopic)
      .filter(Boolean);
    main.innerHTML =
      '<div class="lph-hero-card">' +
      '<div><h1>What do you want to do?</h1><p>' +
      esc((state.data && state.data.intro) || '') +
      '</p><p class="lph-kbd-row">Press <kbd>/</kbd> to search. <kbd>Esc</kbd> closes.</p></div>' +
      '<div class="lph-kpis">' +
      '<div class="lph-kpi"><div class="n">' +
      apps +
      '</div><div class="l">Apps</div></div>' +
      '<div class="lph-kpi"><div class="n">' +
      journeys.length +
      '</div><div class="l">Walkthroughs</div></div>' +
      '<div class="lph-kpi"><div class="n">' +
      fixes.length +
      '</div><div class="l">Fixes</div></div>' +
      '</div></div>' +
      '<h3 class="lph-h">I want to…</h3><div class="lph-home-grid">' +
      journeys.map(cardBtn).join('') +
      '</div>' +
      '<div class="lph-grid-2" style="margin-top:16px">' +
      '<div class="lph-card" data-lph-mock-host><h3>Page, by zone</h3><p class="lph-quiet">Tap a band. Every app that lives there is underneath.</p>' +
      pageMock(state.zone) +
      '</div><div class="lph-stack">' +
      renderChecklist() +
      renderRecent() +
      '</div></div>' +
      '<h3 class="lph-h">Something’s wrong</h3><div class="lph-home-grid">' +
      fixes.map(cardBtn).join('') +
      '</div>' +
      '<h3 class="lph-h">Also useful</h3><div class="lph-home-grid">' +
      featured.map(cardBtn).join('') +
      '</div>' +
      '<div class="lph-card" style="margin-top:16px"><h3>How a change reaches visitors</h3><div class="lph-diagram">' +
      diagramSvg('nav-map') +
      '</div></div>' +
      ticketBlock(null);
  }

  function ticketBlock(topic) {
    var topicLabel = topic ? topic.title : 'General help';
    return (
      '<div class="lph-ticket" id="lph-ticket">' +
      '<h3>Want this done for you?</h3>' +
      '<p>Send a paid-help request. We reply in Support and quote the hands-on work. Nothing is billed until you agree.</p>' +
      '<div class="lph-field"><label>Topic</label><input id="lph-t-topic" value="' +
      esc(topicLabel) +
      '" readonly></div>' +
      '<div class="lph-field"><label>Urgency</label><select id="lph-t-urgency"><option value="normal">Normal</option><option value="soon">This week</option><option value="urgent">Urgent</option></select></div>' +
      '<div class="lph-field"><label>What do you need?</label><textarea id="lph-t-body" placeholder="e.g. Rebuild my hero with 4 new photos and make the button call my mobile."></textarea></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="lph-btn amber" id="lph-t-send">Request paid help</button>' +
      '<button type="button" class="lph-btn" id="lph-t-support">Open Support chat</button>' +
      '</div>' +
      '<p class="lph-msg" id="lph-t-msg"></p></div>'
    );
  }

  function checkedSteps(id) {
    var map = lsGet('lph-steps', {});
    return map[id] || {};
  }

  function renderTopic(topic) {
    var main = root.querySelector('.lph-main');
    if (!topic) {
      main.innerHTML =
        '<div class="lph-empty"><h2>That guide is not in the catalogue</h2><p>Search for the job, or send a paid-help request and we will take it.</p></div>' +
        ticketBlock(null);
      return;
    }
    var doneMap = checkedSteps(topic.id);
    var steps = (topic.steps || [])
      .map(function (s, i) {
        return (
          '<li><label class="lph-step"><input type="checkbox" data-lph-step="' +
          i +
          '"' +
          (doneMap[i] ? ' checked' : '') +
          '><span>' +
          inlineMd(stepPlain(s)) +
          '</span></label></li>'
        );
      })
      .join('');
    var features = (topic.features || [])
      .map(function (f) {
        return '<li>' + inlineMd(f) + '</li>';
      })
      .join('');
    var tips = (topic.tips || [])
      .map(function (t) {
        return '<div class="lph-tip-line">' + inlineMd(t) + '</div>';
      })
      .join('');
    var related = (topic.related || [])
      .map(function (id) {
        var t = getTopic(id);
        if (!t) return '';
        return '<button type="button" data-lph-topic="' + esc(t.id) + '">' + esc(t.title) + '</button>';
      })
      .join('');
    var trail = (topic.trail || [])
      .map(function (step, i) {
        return (
          '<li class="lph-trail"><div><span class="lph-trail-n">' +
          (i + 1) +
          '</span><strong>' +
          esc(step.label || 'Open this') +
          '</strong></div><div class="lph-trail-actions">' +
          '<button type="button" class="lph-btn solid" data-lph-show="1" data-lph-view="' +
          esc(step.view || '') +
          '" data-lph-section="' +
          esc(step.section || '') +
          '" data-lph-sel="' +
          esc(step.selector || '') +
          '" data-lph-tile="' +
          esc(step.tile || '') +
          '" data-lph-label="' +
          esc(step.label || topic.title) +
          '">Show me</button>' +
          (step.topic
            ? '<button type="button" class="lph-btn" data-lph-topic="' + esc(step.topic) + '">Read</button>'
            : '') +
          '</div></li>'
        );
      })
      .join('');
    var choices = (topic.choices || [])
      .map(function (c) {
        return (
          '<button type="button" class="lph-choice" data-lph-topic="' +
          esc(c.topic || topic.id) +
          '"><strong>' +
          esc(c.when || '') +
          '</strong><span>' +
          esc(c.do || '') +
          '</span></button>'
        );
      })
      .join('');
    var answer = topic.answer || topic.summary || '';
    var diagram =
      topic.diagram === 'nav-map' || topic.kind === 'journey'
        ? '<div class="lph-diagram">' + diagramSvg('nav-map') + '</div>'
        : pageMock(topic.zone || state.zone);
    var trouble =
      topic.kind === 'app'
        ? '<div class="lph-card" style="margin-bottom:16px"><h3>If it isn’t working</h3><div class="lph-related">' +
          '<button type="button" data-lph-topic="fix-not-live">Live site didn’t change</button>' +
          '<button type="button" data-lph-topic="fix-missing-section">Section is missing</button>' +
          '<button type="button" data-lph-topic="fix-images">Photo looks wrong</button>' +
          '<button type="button" data-lph-topic="support-ticket">Just do it for me</button></div></div>'
        : '';

    main.innerHTML =
      '<article class="lph-article">' +
      '<div class="lph-meta">' +
      '<span class="lph-pill">' +
      esc(kindLabel(topic)) +
      '</span>' +
      '<span class="lph-pill zone">' +
      minutesOf(topic) +
      ' min</span>' +
      (topic.zone ? '<span class="lph-pill zone">' + esc(topic.zone) + ' zone</span>' : '') +
      (topic.category ? '<span class="lph-pill zone">' + esc(topic.category) + '</span>' : '') +
      '</div>' +
      '<h2>' +
      esc(topic.title) +
      '</h2>' +
      (answer ? '<p class="lph-answer">' + inlineMd(answer) + '</p>' : '') +
      '<div class="lph-actions">' +
      '<button type="button" class="lph-btn solid" data-lph-show="1" data-lph-label="' +
      esc(topic.title) +
      '">Show me in Manage</button>' +
      '<button type="button" class="lph-btn" data-lph-copy>Copy link</button>' +
      '<button type="button" class="lph-btn" data-lph-topic="support-ticket">Need a human</button>' +
      '</div>' +
      (trail ? '<ol class="lph-trails">' + trail + '</ol>' : '') +
      (choices ? '<div class="lph-card" style="margin-bottom:16px"><h3>Which one is it?</h3><div class="lph-choice-list">' + choices + '</div></div>' : '') +
      '<div class="lph-grid-2">' +
      '<div class="lph-card"><h3>' +
      (topic.kind === 'fix' ? 'Try this order' : 'Do this') +
      '</h3><ol class="lph-steps">' +
      (steps || '<li><label class="lph-step"><span>Open this area in Manage and follow the labels on screen.</span></label></li>') +
      '</ol><p class="lph-quiet">Tick a step when you’ve done it. It stays on this browser.</p></div>' +
      '<div class="lph-card" data-lph-mock-host><h3>' +
      (topic.kind === 'journey' ? 'Where you are working' : 'Where it sits') +
      '</h3>' +
      diagram +
      '</div></div>' +
      (topic.body
        ? '<div class="lph-card" style="margin-bottom:16px"><h3>Overview</h3><p class="lph-prose">' + inlineMd(topic.body) + '</p></div>'
        : '') +
      (features ? '<div class="lph-card" style="margin-bottom:16px"><h3>What you can control</h3><ul class="lph-features">' + features + '</ul></div>' : '') +
      (tips ? '<div class="lph-tips" style="margin-bottom:16px"><strong>Worth knowing</strong>' + tips + '</div>' : '') +
      trouble +
      (related ? '<div class="lph-card"><h3>Related</h3><div class="lph-related">' + related + '</div></div>' : '') +
      ticketBlock(topic) +
      '</article>';
  }

  function render() {
    if (!root) return;
    renderNav();
    if (!state.topicId || state.topicId === 'home') renderHome();
    else renderTopic(getTopic(state.topicId));
    renderSuggest();
  }

  function setHash(id) {
    try {
      if (document.body && document.body.classList.contains('lph-standalone')) {
        var u = new URL(location.href);
        if (id && id !== 'home') u.searchParams.set('help', id);
        else u.searchParams.delete('help');
        u.hash = '';
        history.replaceState(null, '', u);
        return;
      }
      var u2 = new URL(location.href);
      if (id && id !== 'home') u2.hash = 'help/' + encodeURIComponent(id);
      else u2.hash = 'help';
      history.replaceState(null, '', u2);
    } catch (_e) {}
  }

  function remember(id) {
    if (!id || id === 'home') return;
    var ids = lsGet('lph-recent', []).filter(function (x) {
      return x !== id;
    });
    ids.unshift(id);
    lsSet('lph-recent', ids.slice(0, 6));
  }

  function openTopic(id) {
    state.topicId = resolveId(id) || 'home';
    if (state.topicId && state.topicId !== 'home' && !getTopic(state.topicId)) state.topicId = 'home';
    state.query = '';
    state.hits = [];
    state.hitIndex = 0;
    var s = root && root.querySelector('#lph-search');
    if (s) s.value = '';
    remember(state.topicId);
    setHash(state.topicId);
    render();
    var main = root && root.querySelector('.lph-main');
    if (main) main.scrollTop = 0;
  }

  function showSpec(topic) {
    if (!topic) return { title: 'Help' };
    var base = { title: topic.title };
    if (GUIDE_SHOW[topic.id]) return Object.assign(base, GUIDE_SHOW[topic.id]);
    if (topic.sectionKey) return Object.assign(base, { view: 'details', section: topic.sectionKey, tile: topic.sectionKey });
    var trail = (topic.trail || [])[0];
    if (trail) return Object.assign(base, { view: trail.view, section: trail.section, selector: trail.selector, tile: trail.tile });
    return Object.assign(base, { view: 'details' });
  }

  function clearSpot() {
    state.spotEl = null;
    if (spot) spot.hidden = true;
    if (coach) coach.hidden = true;
    window.removeEventListener('scroll', onSpotMove, true);
    window.removeEventListener('resize', onSpotMove);
  }

  function ensureSpot() {
    if (spot) return spot;
    spot = document.createElement('div');
    spot.id = 'lph-spot';
    spot.hidden = true;
    document.body.appendChild(spot);
    return spot;
  }

  function ensureCoach(spec, found) {
    if (!coach) {
      coach = document.createElement('div');
      coach.id = 'lph-coach';
      coach.innerHTML =
        '<p></p><div><button type="button" class="lph-btn" id="lph-coach-back">Back to guide</button><button type="button" class="lph-btn solid" id="lph-coach-ok">Got it</button></div>';
      document.body.appendChild(coach);
      coach.addEventListener('click', function (e) {
        if (e.target && e.target.id === 'lph-coach-back') {
          var id = state.returnTopic || 'home';
          clearSpot();
          open(id);
        } else if (e.target && e.target.id === 'lph-coach-ok') {
          clearSpot();
        }
      });
    }
    coach.hidden = false;
    var p = coach.querySelector('p');
    if (p) {
      p.textContent = found
        ? spec.title + ' is highlighted on screen.'
        : 'Open Manage while signed in to highlight ' + spec.title + '.';
    }
  }

  function drawRing(el) {
    var ring = ensureSpot();
    var r = el.getBoundingClientRect();
    if (r.width < 2 && r.height < 2) {
      ring.hidden = true;
      return;
    }
    if (r.height > window.innerHeight * 0.72) {
      ring.hidden = true;
      return;
    }
    var pad = 8;
    ring.hidden = false;
    ring.style.left = Math.max(6, r.left - pad) + 'px';
    ring.style.top = Math.max(6, r.top - pad) + 'px';
    ring.style.width = r.width + pad * 2 + 'px';
    ring.style.height = r.height + pad * 2 + 'px';
  }

  function onSpotMove() {
    if (state.spotEl) drawRing(state.spotEl);
  }

  function cssAttr(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function findTarget(spec) {
    var el = null;
    if (spec.selector) {
      try {
        el = document.querySelector(spec.selector);
      } catch (_e) {}
    }
    if (!el && spec.section) {
      el = document.querySelector('[data-help="' + cssAttr(spec.section) + '"]');
      if (el && el.closest) el = el.closest('.card') || el;
    }
    if (!el && spec.tile) el = document.querySelector('.amp-tile[data-seckey="' + cssAttr(spec.tile) + '"]');
    if (!el && spec.view) el = document.getElementById('nav-' + spec.view) || document.getElementById('av-' + spec.view);
    return el;
  }

  function placeSpot(spec) {
    var el = findTarget(spec);
    ensureCoach(spec, !!el);
    if (!el) return;
    state.spotEl = el;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_e) {
      el.scrollIntoView();
    }
    window.addEventListener('scroll', onSpotMove, true);
    window.addEventListener('resize', onSpotMove);
    setTimeout(function () {
      drawRing(el);
    }, 320);
  }

  function showMe(topicOrId, override) {
    var topic = null;
    if (typeof topicOrId === 'string') topic = getTopic(topicOrId);
    else if (topicOrId && topicOrId.id) topic = topicOrId;
    else topic = getTopic(state.topicId);
    var spec = showSpec(topic);
    if (override) {
      if (override.selector) {
        spec = { title: override.title || spec.title, selector: override.selector };
      } else {
        ['view', 'section', 'tile', 'title'].forEach(function (k) {
          if (override[k]) spec[k] = override[k];
        });
        if (override.section) spec.view = override.view || 'details';
      }
    }
    if (document.body && document.body.classList.contains('lph-standalone')) {
      var id = (topic && topic.id) || state.topicId || 'home';
      location.href = '/manage?help=' + encodeURIComponent(id) + '&show=1';
      return;
    }
    state.returnTopic = (topic && topic.id) || state.topicId || 'home';
    close();
    setTimeout(function () {
      try {
        if (spec.selector === '#lpc-backups' && typeof global.lpBkOpen === 'function') global.lpBkOpen();
        else if (spec.selector === '#lpc-image-library' && typeof global.cwLibOpen === 'function') global.cwLibOpen();
        else if (spec.section && (!spec.view || spec.view === 'details') && typeof global.lpOpenEditorSection === 'function') {
          global.lpOpenEditorSection('details', spec.section);
        } else if (spec.view && typeof global.showView === 'function') global.showView(spec.view);
      } catch (_e) {}
      setTimeout(function () {
        placeSpot(spec);
      }, 450);
    }, 40);
  }

  function copyLink() {
    var id = state.topicId && state.topicId !== 'home' ? state.topicId : '';
    var url = location.origin + '/help' + (id ? '?help=' + encodeURIComponent(id) : '');
    var btn = root.querySelector('[data-lph-copy]');
    function done() {
      if (btn) {
        btn.textContent = 'Link copied';
        setTimeout(function () {
          if (btn) btn.textContent = 'Copy link';
        }, 1600);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(done);
    } else done();
  }

  async function authHeader() {
    try {
      if (global.supabase && global.__LP) {
        var sb = global.__lpHelpSb;
        if (!sb) {
          sb = global.supabase.createClient(global.__LP.url, global.__LP.anon);
          global.__lpHelpSb = sb;
        }
        var sess = (await sb.auth.getSession()).data.session;
        if (sess && sess.access_token) return { Authorization: 'Bearer ' + sess.access_token };
      }
      if (typeof global.cwToken === 'function') {
        var t = await global.cwToken();
        if (t) return { Authorization: 'Bearer ' + t };
      }
    } catch (_e) {}
    return {};
  }

  async function submitTicket() {
    var msg = root.querySelector('#lph-t-msg');
    var bodyEl = root.querySelector('#lph-t-body');
    var urg = root.querySelector('#lph-t-urgency');
    var topicEl = root.querySelector('#lph-t-topic');
    var text = (bodyEl && bodyEl.value) || '';
    if (!String(text).trim()) {
      if (msg) {
        msg.className = 'lph-msg bad';
        msg.textContent = 'Tell us what you need help with.';
      }
      return;
    }
    if (msg) {
      msg.className = 'lph-msg';
      msg.textContent = 'Sending…';
    }
    var payload = {
      topicId: state.topicId || 'support-ticket',
      topicTitle: (topicEl && topicEl.value) || '',
      urgency: (urg && urg.value) || 'normal',
      message: String(text).trim(),
      siteId: global.currentSiteId || null,
      siteName: global.currentBusinessName || global.currentSiteSlug || '',
      path: location.pathname + location.search
    };
    try {
      var headers = Object.assign({ 'content-type': 'application/json' }, await authHeader());
      var r = await fetch('/api/help/ticket', { method: 'POST', headers: headers, body: JSON.stringify(payload) });
      var j = await r.json().catch(function () {
        return {};
      });
      if (!r.ok || j.ok === false) throw new Error(j.error || j.message || 'Request failed');
      if (msg) {
        msg.className = 'lph-msg ok';
        msg.textContent = j.message || 'Request sent. Opening Support…';
      }
      openSupportChat(payload);
    } catch (e) {
      if (msg) {
        msg.className = 'lph-msg bad';
        msg.textContent = (e && e.message) || 'Could not send. Opening Support chat instead.';
      }
      openSupportChat(payload);
    }
  }

  function openSupportChat(payload) {
    var prefill =
      'Paid help request' +
      (payload.topicTitle ? ' — ' + payload.topicTitle : '') +
      '\nUrgency: ' +
      (payload.urgency || 'normal') +
      (payload.siteName ? '\nSite: ' + payload.siteName : '') +
      '\n\n' +
      (payload.message || '');
    try {
      close();
      clearSpot();
      if (typeof global.lpOpenSupportMessage === 'function') global.lpOpenSupportMessage('');
      if (typeof global.showView === 'function') global.showView('messages');
      var embed = global.manageMsgEmbed;
      if (embed && typeof embed.openProvider === 'function') {
        setTimeout(function () {
          try {
            embed.openProvider(prefill);
          } catch (_e) {}
        }, 400);
      }
    } catch (_e2) {}
  }

  function onRootClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-lph-close]')) {
      e.preventDefault();
      close();
      return;
    }
    if (t.closest('#lph-t-send')) {
      e.preventDefault();
      submitTicket();
      return;
    }
    if (t.closest('#lph-t-support')) {
      e.preventDefault();
      var bodyEl = root.querySelector('#lph-t-body');
      openSupportChat({
        topicTitle: state.topicId,
        urgency: 'normal',
        message: (bodyEl && bodyEl.value) || 'Hi — I need help with my site.',
        siteName: global.currentBusinessName || ''
      });
      return;
    }
    if (t.closest('[data-lph-copy]')) {
      e.preventDefault();
      copyLink();
      return;
    }
    if (t.closest('[data-lph-nav]')) {
      e.preventDefault();
      state.navOpen = !state.navOpen;
      renderNav();
      return;
    }
    var showBtn = t.closest('[data-lph-show]');
    if (showBtn) {
      e.preventDefault();
      showMe(getTopic(state.topicId), {
        view: showBtn.getAttribute('data-lph-view') || '',
        section: showBtn.getAttribute('data-lph-section') || '',
        selector: showBtn.getAttribute('data-lph-sel') || '',
        tile: showBtn.getAttribute('data-lph-tile') || '',
        title: showBtn.getAttribute('data-lph-label') || ''
      });
      return;
    }
    var zoneBtn = t.closest('[data-lph-zone]');
    if (zoneBtn) {
      e.preventDefault();
      state.zone = zoneBtn.getAttribute('data-lph-zone') || 'Hero';
      var host = root.querySelector('[data-lph-mock-host]');
      if (host) {
        var h3 = host.querySelector('h3');
        var quiet = host.querySelector('.lph-quiet');
        host.innerHTML = (h3 ? h3.outerHTML : '') + (quiet ? quiet.outerHTML : '') + pageMock(state.zone);
      }
      return;
    }
    var a = t.closest('[data-lph-topic]');
    if (a) {
      e.preventDefault();
      state.navOpen = false;
      openTopic(a.getAttribute('data-lph-topic'));
    }
  }

  function onRootChange(e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    var step = t.getAttribute('data-lph-step');
    if (step != null && state.topicId) {
      var map = lsGet('lph-steps', {});
      map[state.topicId] = map[state.topicId] || {};
      map[state.topicId][step] = !!t.checked;
      lsSet('lph-steps', map);
      return;
    }
    var chk = t.getAttribute('data-lph-check');
    if (chk) {
      var done = lsGet('lph-check', {});
      done[chk] = !!t.checked;
      lsSet('lph-check', done);
      var count = root.querySelector('.lph-count');
      if (count) {
        var n = CHECKS.filter(function (c) {
          return done[c.id];
        }).length;
        count.textContent = n + '/' + CHECKS.length;
      }
    }
  }

  function ensureRoot() {
    if (root) return root;
    ensureFonts();
    ensureCss();
    root = document.createElement('div');
    root.id = 'lph-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Help Centre');
    root.innerHTML =
      '<div class="lph-backdrop" data-lph-close></div>' +
      '<div class="lph-shell">' +
      '<div class="lph-top">' +
      '<div class="lph-brandmark"><i>?</i> Help</div>' +
      '<button type="button" class="lph-btn" data-lph-nav id="lph-nav-toggle">Topics</button>' +
      '<div class="lph-search-wrap">' +
      '<input class="lph-search" id="lph-search" placeholder="Search — publish, menu, photos, bookings…" autocomplete="off" aria-label="Search help">' +
      '<div class="lph-suggest" id="lph-suggest" hidden></div></div>' +
      '<div class="lph-top-actions">' +
      '<button type="button" class="lph-btn amber" data-lph-topic="support-ticket">Need a human</button>' +
      '<button type="button" class="lph-btn" data-lph-close>Close</button>' +
      '</div></div>' +
      '<nav class="lph-nav" aria-label="Help topics"></nav>' +
      '<div class="lph-main"></div>' +
      '</div>';
    document.body.appendChild(root);
    root.addEventListener('click', onRootClick);
    root.addEventListener('change', onRootChange);
    var search = root.querySelector('#lph-search');
    if (search) {
      search.addEventListener('input', function () {
        state.query = search.value;
        state.hitIndex = 0;
        renderNav();
        renderSuggest();
      });
    }
    var nt = root.querySelector('#lph-nav-toggle');
    if (nt) {
      function syncNavBtn() {
        nt.style.display = window.matchMedia('(max-width:900px)').matches ? '' : 'none';
      }
      syncNavBtn();
      window.addEventListener('resize', syncNavBtn);
    }
    return root;
  }

  function typingTarget(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function onKey(e) {
    var isOpen = root && root.classList.contains('is-open');
    if (e.key === 'Escape') {
      if (coach && !coach.hidden) {
        clearSpot();
        return;
      }
      if (isOpen) {
        if (String(state.query || '').trim()) {
          state.query = '';
          state.hits = [];
          var s = root.querySelector('#lph-search');
          if (s) s.value = '';
          renderNav();
          renderSuggest();
          return;
        }
        close();
      }
      return;
    }
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (typingTarget(e.target)) return;
      e.preventDefault();
      if (!isOpen) open('home');
      else {
        var slashBox = root.querySelector('#lph-search');
        if (slashBox) slashBox.focus();
      }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K') && !e.altKey) {
      if (isOpen && e.target && e.target.id === 'lph-search') return;
      e.preventDefault();
      if (!isOpen) open('home');
      else {
        var kBox = root.querySelector('#lph-search');
        if (kBox) kBox.focus();
      }
      return;
    }
    if (!isOpen || !state.hits || !state.hits.length) return;
    if (document.activeElement && document.activeElement.id !== 'lph-search') return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      var dir = e.key === 'ArrowDown' ? 1 : -1;
      state.hitIndex = (state.hitIndex + dir + state.hits.length) % state.hits.length;
      renderSuggest();
    } else if (e.key === 'Enter') {
      var hit = state.hits[state.hitIndex] || state.hits[0];
      if (!hit) return;
      e.preventDefault();
      openTopic(hit.t.id);
    }
  }

  function open(topicId, opts) {
    clearSpot();
    ensureRoot();
    state.pendingShow = !!(opts && opts.show);
    loadCatalogue()
      .then(function () {
        root.classList.add('is-open');
        document.documentElement.style.overflow = 'hidden';
        openTopic(topicId || 'home');
        if (state.pendingShow) {
          state.pendingShow = false;
          var topic = getTopic(state.topicId);
          setTimeout(function () {
            showMe(topic);
          }, 360);
        } else if (!topicId || topicId === 'home') {
          var s = root.querySelector('#lph-search');
          if (s) setTimeout(function () {
            s.focus();
          }, 40);
        }
      })
      .catch(function (e) {
        ensureRoot();
        root.classList.add('is-open');
        root.querySelector('.lph-main').innerHTML =
          '<div class="lph-empty">Could not load help: ' + esc(e.message || e) + '</div>' + ticketBlock(null);
      });
  }

  function close() {
    if (!root) return;
    root.classList.remove('is-open');
    state.navOpen = false;
    document.documentElement.style.overflow = '';
    try {
      if (document.body && document.body.classList.contains('lph-standalone')) return;
      if (/#help/.test(location.hash)) {
        var u = new URL(location.href);
        u.hash = '';
        history.replaceState(null, '', u);
      }
    } catch (_e) {}
  }

  function toggle(topicId) {
    if (root && root.classList.contains('is-open')) close();
    else open(topicId);
  }

  function bindNeedHelp(el, topicId) {
    if (!el) return;
    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      open(topicId || el.getAttribute('data-help') || 'home');
    });
  }

  function needHelpButton(topicId, label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'lph-need-help';
    b.setAttribute('data-help', topicId || 'home');
    b.innerHTML = '<span class="lph-q">?</span> ' + esc(label || 'Need help?');
    bindNeedHelp(b, topicId);
    return b;
  }

  function bootFromUrl() {
    try {
      var params = new URLSearchParams(location.search);
      var q = params.get('help');
      var show = params.get('show') === '1';
      if (q) {
        open(q, { show: show });
        return;
      }
      var m = String(location.hash || '').match(/^#help\/?([^/]*)$/);
      if (m) open(decodeURIComponent(m[1] || 'home'), { show: show });
    } catch (_e) {}
  }

  var api = {
    open: open,
    close: close,
    toggle: toggle,
    showMe: function (id) {
      loadCatalogue()
        .then(function () {
          showMe(id);
        })
        .catch(function () {
          showMe(id);
        });
    },
    bindNeedHelp: bindNeedHelp,
    needHelpButton: needHelpButton,
    resolveId: resolveId,
    getTopic: function (id) {
      return loadCatalogue().then(function () {
        return getTopic(id);
      });
    }
  };
  global.LPHelp = api;
  if (typeof window !== 'undefined') window.LPHelp = api;

  document.addEventListener('keydown', onKey);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootFromUrl);
  else setTimeout(bootFromUrl, 0);
})(typeof window !== 'undefined' ? window : globalThis);
