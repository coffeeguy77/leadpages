/**
 * Website Studio Phase 7 — wizard UX, generation theatre, concept presentation.
 * API contracts unchanged. Composer / Marketplace / renderer untouched.
 */
(function () {
  'use strict';

  var sb = window.supabase.createClient(window.__LP.url, window.__LP.anon);
  var $ = function (id) {
    return document.getElementById(id);
  };

  var WIZARD = ['Business', 'Services', 'Brand', 'Goals', 'Generate'];
  var STUDIO = ['Concepts', 'Preview', 'Refine', 'Approve'];

  var STYLE_CHIPS = ['Luxury', 'Editorial', 'Minimal', 'Premium', 'Industrial', 'Warm', 'Bold', 'Playful'];
  var SERVICE_CHIPS = [
    'Wedding Rings',
    'Private Consultations',
    'Luxury Jewellery',
    'Argyle Pink Diamonds',
    'Coffee Cart',
    'Corporate Events',
    'Bespoke Design',
    'Repairs & Aftercare'
  ];
  var GOALS = [
    { id: 'appointment', label: 'Appointment', desc: 'Book private or in-person sessions', cta: 'Book an appointment' },
    { id: 'quote', label: 'Quote', desc: 'Collect project enquiries with clear next steps', cta: 'Request a quote' },
    { id: 'booking', label: 'Booking', desc: 'Reserve dates, tables, or event packages', cta: 'Check availability' },
    { id: 'phone', label: 'Phone', desc: 'Drive calls with a strong contact CTA', cta: 'Call now' },
    { id: 'email', label: 'Email', desc: 'Warm enquiries into your inbox', cta: 'Get in touch' },
    { id: 'visit', label: 'Store Visit', desc: 'Invite people to visit your location', cta: 'Plan your visit' },
    { id: 'newsletter', label: 'Newsletter', desc: 'Grow an audience for launches and offers', cta: 'Join the list' }
  ];

  var APP_LABELS = {
    hero: 'Signature Hero',
    heroSlider: 'Image Slider Hero',
    splitHero: 'Split Hero',
    productCollection: 'Product Showcase',
    featuredProjects: 'Featured Work',
    brandStory: 'Brand Story',
    bookingCta: 'Appointment Booking',
    reviews: 'Client Reviews',
    reviewHighlights: 'Review Highlights',
    faq: 'FAQ',
    quote: 'Contact Form',
    why: 'Why Choose Us',
    trustBar: 'Trust Badges',
    services: 'Services',
    packageCompare: 'Package Compare',
    clientLogos: 'Client Logos',
    serviceProcess: 'How It Works',
    specialOffer: 'Special Offer',
    crew: 'Meet the Team',
    area: 'Service Areas',
    footer: 'Footer'
  };

  var state = {
    draftId: null,
    versions: [],
    selectedVersionId: null,
    previewMode: 'desktop',
    wizardStep: 1,
    phase: 'wizard',
    studioStep: 0,
    primaryGoal: 'appointment',
    secondaryGoal: 'email',
    styleChips: [],
    serviceChips: [],
    generating: false
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  async function token() {
    var r = await sb.auth.getSession();
    return (r && r.data && r.data.session && r.data.session.access_token) || null;
  }

  function apiErrorMessage(j, res, rawText) {
    j = j || {};
    var msg = j.message || j.error || '';
    if (!msg) {
      var snippet = String(rawText || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
      msg = 'HTTP ' + res.status + (snippet && snippet.charAt(0) !== '{' ? ' (non-JSON server error)' : '');
    }
    if (j.details && j.details.length) {
      var first = j.details[0];
      var detail = (first && (first.message || first.code)) || '';
      if (detail) msg += ' — ' + detail;
    }
    if (j.diagnosticId) msg += ' [' + j.diagnosticId + ']';
    return msg;
  }

  async function api(path, opts) {
    opts = opts || {};
    var t = await token();
    var res = await fetch(path, {
      method: opts.method || 'POST',
      headers: Object.assign({ 'content-type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
      body: opts.body != null ? JSON.stringify(opts.body) : opts.method === 'GET' ? undefined : '{}'
    });
    var raw = await res.text();
    var j = {};
    try {
      j = raw ? JSON.parse(raw) : {};
    } catch (_e) {
      j = {};
    }
    if (!res.ok) throw new Error(apiErrorMessage(j, res, raw));
    return j;
  }

  function syncStyleField() {
    var chips = state.styleChips.slice();
    var mood = ($('preferredMood') && $('preferredMood').value) || '';
    if (mood && chips.indexOf(mood) < 0) chips.push(mood);
    var colours = [];
    ['primaryColour', 'secondaryColour', 'accentColour'].forEach(function (id) {
      var el = $(id);
      if (el && el.value) colours.push(el.value);
    });
    var base = chips.join(', ');
    if (colours.length) base += (base ? ' · ' : '') + 'colours ' + colours.join(' ');
    if ($('desiredStyle')) $('desiredStyle').value = base;
  }

  function syncServicesField() {
    var typed = (($('mainServices') && $('mainServices').value) || '')
      .split(/[\n,]+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    var merged = typed.slice();
    state.serviceChips.forEach(function (c) {
      if (merged.indexOf(c) < 0) merged.push(c);
    });
    if ($('mainServices')) $('mainServices').value = merged.join(', ');
  }

  function syncGoals() {
    var primary = GOALS.find(function (g) {
      return g.id === state.primaryGoal;
    });
    var secondary = GOALS.find(function (g) {
      return g.id === state.secondaryGoal;
    });
    if ($('conversionGoal')) $('conversionGoal').value = (primary && primary.cta) || state.primaryGoal || '';
    if ($('secondaryConversionGoal'))
      $('secondaryConversionGoal').value = (secondary && secondary.cta) || state.secondaryGoal || '';
    if ($('phoneCta') && primary && primary.id === 'phone' && !$('phoneCta').value) {
      $('phoneCta').value = 'Call us';
    }
  }

  function collectBrief() {
    syncStyleField();
    syncServicesField();
    syncGoals();
    var logoNote = ($('logoName') && $('logoName').value) || '';
    var existing = ($('existingWebsite') && $('existingWebsite').value) || '';
    var notes = ($('notes') && $('notes').value) || '';
    var extras = [];
    if (logoNote) extras.push('Logo on file: ' + logoNote);
    if (existing) extras.push('Existing website: ' + existing);
    var preferred = ($('preferredColours') && $('preferredColours').value) || '';
    if (preferred) extras.push('Preferred colours: ' + preferred);
    var combinedNotes = [notes].concat(extras).filter(Boolean).join('\n');
    return {
      businessName: $('businessName').value,
      industry: $('industry').value,
      businessType: $('businessType') && $('businessType').value,
      yearsOperating: $('yearsOperating') && $('yearsOperating').value,
      serviceAreas: $('serviceAreas') && $('serviceAreas').value,
      conversionGoal: $('conversionGoal') && $('conversionGoal').value,
      secondaryConversionGoal: $('secondaryConversionGoal') && $('secondaryConversionGoal').value,
      phoneCta: $('phoneCta') && $('phoneCta').value,
      mainServices: $('mainServices') && $('mainServices').value,
      differentiators: $('differentiators') && $('differentiators').value,
      specialisation: $('specialisation').value,
      location: $('location').value,
      audience: $('audience').value,
      desiredStyle: $('desiredStyle').value,
      notes: combinedNotes
    };
  }

  function paintProgress() {
    var labels = state.phase === 'wizard' ? WIZARD : WIZARD.concat(STUDIO);
    var active =
      state.phase === 'wizard' ? state.wizardStep : WIZARD.length + Math.max(1, state.studioStep);
    $('ws-progress').innerHTML = labels
      .map(function (label, i) {
        var n = i + 1;
        var cls = 'ws-step' + (n === active ? ' on' : '') + (n < active ? ' done' : '');
        return (
          '<span class="' +
          cls +
          '" aria-current="' +
          (n === active ? 'step' : 'false') +
          '"><span class="ws-step__n">' +
          n +
          '</span>' +
          esc(label) +
          '</span>'
        );
      })
      .join('');
  }

  function showWizard(step) {
    state.phase = 'wizard';
    state.wizardStep = step;
    paintProgress();
    [1, 2, 3, 4, 5].forEach(function (n) {
      var el = $('ws-step-' + n);
      if (el) el.classList.toggle('ws-hidden', n !== step);
    });
    ['panel-concepts', 'panel-preview', 'panel-refine', 'panel-images', 'panel-approve', 'panel-apply'].forEach(
      function (id) {
        if ($(id)) $(id).classList.add('ws-hidden');
      }
    );
    updateActionBar();
    paintSummary();
  }

  function showStudio(step) {
    state.phase = 'studio';
    state.studioStep = step;
    paintProgress();
    [1, 2, 3, 4, 5].forEach(function (n) {
      var el = $('ws-step-' + n);
      if (el) el.classList.add('ws-hidden');
    });
    $('panel-concepts').classList.toggle('ws-hidden', step < 1);
    $('panel-preview').classList.toggle('ws-hidden', step < 2);
    $('panel-refine').classList.toggle('ws-hidden', step < 3);
    $('panel-images').classList.toggle('ws-hidden', step < 3);
    $('panel-approve').classList.toggle('ws-hidden', step < 4);
    $('panel-apply').classList.toggle('ws-hidden', step < 4);
    if (step >= 3) paintImageSlots();
    updateActionBar();
  }

  function updateActionBar() {
    var prev = $('btn-prev');
    var next = $('btn-next');
    var save = $('btn-save-draft');
    var genAgain = $('btn-gen-again');
    var select = $('btn-select');
    var cont = $('btn-continue');

    if (state.phase === 'wizard') {
      prev.disabled = state.wizardStep <= 1;
      next.classList.toggle('ws-hidden', state.wizardStep >= 5);
      cont.classList.add('ws-hidden');
      genAgain.classList.add('ws-hidden');
      select.classList.add('ws-hidden');
      save.classList.remove('ws-hidden');
      next.textContent = 'Next';
    } else {
      prev.disabled = false;
      next.classList.add('ws-hidden');
      save.classList.remove('ws-hidden');
      genAgain.classList.remove('ws-hidden');
      select.classList.toggle('ws-hidden', state.studioStep < 2);
      select.disabled = !state.selectedVersionId;
      cont.classList.toggle('ws-hidden', state.studioStep >= 4);
      cont.textContent = state.studioStep === 1 ? 'Preview' : state.studioStep === 2 ? 'Continue' : 'Approve';
    }
  }

  async function autosaveDraft() {
    var brief = collectBrief();
    if (!brief.businessName || !brief.industry) return null;
    try {
      if (!state.draftId) {
        var created = await api('/api/theme-studio/drafts', {
          body: {
            mode: ($('mode') && $('mode').value) || 'new',
            sourceSiteId: ($('source-site') && $('source-site').value) || null,
            foundationId: ($('foundation') && $('foundation').value) || null,
            brief: brief
          }
        });
        state.draftId = created.draft.id;
        setMsg('ws-autosave-msg', 'Draft saved', 'ok');
        return created.draft;
      }
      var patched = await api('/api/theme-studio/drafts?id=' + encodeURIComponent(state.draftId), {
        method: 'PATCH',
        body: {
          brief: brief,
          foundationId: ($('foundation') && $('foundation').value) || null
        }
      });
      setMsg('ws-autosave-msg', 'Draft updated', 'ok');
      return patched.draft;
    } catch (e) {
      setMsg('ws-autosave-msg', e.message || String(e), 'bad');
      return null;
    }
  }

  function setMsg(id, text, kind) {
    var el = $(id);
    if (!el) return;
    el.className = 'ws-msg' + (kind ? ' ' + kind : '');
    el.textContent = text || '';
  }

  function paintChips(containerId, items, selected, onToggle) {
    var root = $(containerId);
    if (!root) return;
    root.innerHTML = items
      .map(function (label) {
        var on = selected.indexOf(label) >= 0 ? ' on' : '';
        return (
          '<button type="button" class="ws-chip' +
          on +
          '" data-chip="' +
          esc(label) +
          '" aria-pressed="' +
          (on ? 'true' : 'false') +
          '">' +
          esc(label) +
          '</button>'
        );
      })
      .join('');
    root.querySelectorAll('.ws-chip').forEach(function (btn) {
      btn.onclick = function () {
        onToggle(btn.getAttribute('data-chip'));
        paintChips(containerId, items, selected, onToggle);
      };
    });
  }

  function paintGoals() {
    var root = $('ws-goal-primary');
    var root2 = $('ws-goal-secondary');
    function render(target, selectedId, setter) {
      if (!target) return;
      target.innerHTML = GOALS.map(function (g) {
        var on = g.id === selectedId ? ' on' : '';
        return (
          '<button type="button" class="ws-goal' +
          on +
          '" data-goal="' +
          g.id +
          '" aria-pressed="' +
          (on ? 'true' : 'false') +
          '"><span class="ws-goal__title">' +
          esc(g.label) +
          '</span><span class="ws-goal__desc">' +
          esc(g.desc) +
          '</span></button>'
        );
      }).join('');
      target.querySelectorAll('.ws-goal').forEach(function (btn) {
        btn.onclick = function () {
          setter(btn.getAttribute('data-goal'));
          paintGoals();
          syncGoals();
        };
      });
    }
    render(root, state.primaryGoal, function (id) {
      state.primaryGoal = id;
    });
    render(root2, state.secondaryGoal, function (id) {
      state.secondaryGoal = id;
    });
  }

  function paintSummary() {
    if (!$('ws-summary-list')) return;
    var b = collectBrief();
    var apps = '8–12 Marketplace apps';
    var pages = '1 landing page';
    var images = '4–8 curated images';
    var rows = [
      ['Business', b.businessName || '—'],
      ['Industry', b.industry || '—'],
      ['Services', (b.specialisation || b.mainServices || '—').slice(0, 80)],
      ['Brand', (b.desiredStyle || '—').slice(0, 80)],
      ['Goal', b.conversionGoal || '—'],
      ['Estimated apps', apps],
      ['Estimated pages', pages],
      ['Estimated images', images]
    ];
    $('ws-summary-list').innerHTML = rows
      .map(function (r) {
        return '<div class="ws-summary-row"><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
      })
      .join('');
  }

  function humanAppLabel(id) {
    return APP_LABELS[id] || String(id).replace(/([A-Z])/g, ' $1').replace(/^./, function (c) {
      return c.toUpperCase();
    });
  }

  function conceptPersonality(v, index) {
    var layout = String(v.layoutId || '');
    if (layout.indexOf('reviews') >= 0 || index === 2) {
      return {
        name: (v.conceptName || 'Clarity').split('·')[0].trim(),
        summary: 'A calm, trust-led presentation that leads with proof and quiet confidence.',
        suited: 'Clients who decide carefully and value social proof',
        conversion: 'Reviews → enquiry',
        personality: 'Boutique Experience'
      };
    }
    if (layout.indexOf('offer') >= 0 || layout.indexOf('quote') >= 0 || index === 1) {
      return {
        name: (v.conceptName || 'Contrast').split('·')[0].trim(),
        summary: 'Structured for conversion — clear offer hierarchy with decisive calls to action.',
        suited: 'Growth-focused brands ready to capture leads',
        conversion: 'Offer → booking',
        personality: 'Premium Conversion'
      };
    }
    return {
      name: (v.conceptName || 'Signature').split('·')[0].trim(),
      summary: 'Large imagery and editorial pacing — a magazine-like first impression.',
      suited: 'Premium brands with visual product or craftsmanship stories',
      conversion: 'Inspiration → appointment',
      personality: 'Luxury Editorial'
    };
  }

  function paintConcepts(versions) {
    state.versions = versions || [];
    var grid = $('concept-grid');
    if (!grid) return;
    grid.innerHTML =
      state.versions
        .map(function (v, index) {
          var theme = v.theme || {};
          var apps =
            (v.draftConfig &&
              v.draftConfig.__websiteComposer &&
              v.draftConfig.__websiteComposer.installedApps) ||
            [];
          var labels = apps
            .map(function (a) {
              return humanAppLabel(a.appId || a);
            })
            .filter(function (x, i, arr) {
              return arr.indexOf(x) === i;
            })
            .slice(0, 6);
          var persona = conceptPersonality(v, index);
          return (
            '<article class="ws-concept' +
            (v.id === state.selectedVersionId ? ' selected' : '') +
            '" data-id="' +
            esc(v.id) +
            '" tabindex="0" role="button" aria-pressed="' +
            (v.id === state.selectedVersionId ? 'true' : 'false') +
            '">' +
            '<h3>' +
            esc(persona.name) +
            '</h3>' +
            '<p class="ws-concept__summary">' +
            esc(persona.summary) +
            '</p>' +
            '<div class="ws-swatches">' +
            ['pipe', 'hivis', 'steel', 'safety', 'lightBg']
              .map(function (k) {
                return (
                  '<span class="ws-swatch" title="' +
                  k +
                  '" style="background:' +
                  esc(theme[k] || '#ccc') +
                  '"></span>'
                );
              })
              .join('') +
            '</div>' +
            '<div class="ws-concept__meta">' +
            '<div><span>Best suited for</span>' +
            esc(persona.suited) +
            '</div>' +
            '<div><span>Conversion focus</span>' +
            esc(persona.conversion) +
            '</div>' +
            '<div><span>Design personality</span>' +
            esc(persona.personality) +
            '</div>' +
            '</div>' +
            '<ul class="ws-feature-list">' +
            labels
              .map(function (l) {
                return '<li>' + esc(l) + '</li>';
              })
              .join('') +
            '</ul>' +
            '</article>'
          );
        })
        .join('') || '<p class="ws-sub">No concepts yet.</p>';

    if ($('compare-diag')) {
      try {
        $('compare-diag').textContent = JSON.stringify(
          state.versions.map(function (v) {
            return {
              id: v.id,
              layoutId: v.layoutId,
              quality: v.quality && { score: v.quality.score, status: v.quality.status },
              shell:
                v.draftConfig &&
                v.draftConfig.__websiteComposer &&
                v.draftConfig.__websiteComposer.rendererShellId
            };
          }),
          null,
          2
        );
      } catch (_e) {}
    }

    grid.querySelectorAll('.ws-concept').forEach(function (el) {
      function select() {
        state.selectedVersionId = el.getAttribute('data-id');
        grid.querySelectorAll('.ws-concept').forEach(function (c) {
          c.classList.toggle('selected', c === el);
          c.setAttribute('aria-pressed', c === el ? 'true' : 'false');
        });
        updateActionBar();
        loadPreview();
        showStudio(Math.max(state.studioStep, 2));
      }
      el.onclick = select;
      el.onkeydown = function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          select();
        }
      };
    });
  }

  function currentDraftConfig() {
    var v = state.versions.find(function (x) {
      return x.id === state.selectedVersionId;
    });
    return (v && (v.draftConfig || v.draft_config_json)) || null;
  }

  function paintImageSlots() {
    var cfg = currentDraftConfig();
    var wrap = $('image-slots');
    if (!wrap) return;
    var selections = (cfg && cfg.__websiteComposer && cfg.__websiteComposer.imageSelections) || [];
    if (!selections.length) {
      wrap.innerHTML = '<p>No stored image selections on this draft yet. Generate a concept first.</p>';
      return;
    }
    wrap.innerHTML = selections
      .map(function (s, idx) {
        var url = s.selectedVariantUrl || s.sourceImageUrl || '';
        return (
          '<div style="display:flex;gap:12px;align-items:flex-start;border-top:1px solid rgba(0,0,0,.08);padding-top:10px">' +
          (url
            ? '<img src="' + esc(url) + '" alt="" style="width:120px;height:72px;object-fit:cover;border-radius:4px">'
            : '<div style="width:120px;height:72px;background:#eee"></div>') +
          '<div><strong>' +
          esc(s.sectionId || s.appId || 'slot ' + idx) +
          '</strong>' +
          '<div class="ws-sub">' +
          esc(s.provider || '') +
          ' · ' +
          esc(s.providerAssetId || '') +
          '</div>' +
          '<div class="ws-sub">' +
          esc(s.photographerName || 'Attribution pending') +
          '</div>' +
          '<div class="ws-sub">' +
          esc(s.altText || '') +
          '</div>' +
          '<button class="ws-btn ghost btn-pick-image" type="button" data-idx="' +
          idx +
          '">Use for search</button>' +
          '</div></div>'
        );
      })
      .join('');
    wrap.querySelectorAll('.btn-pick-image').forEach(function (btn) {
      btn.onclick = function () {
        var s = selections[Number(btn.getAttribute('data-idx'))];
        state.activeImageSelection = s;
        $('image-query').value = s.searchQuery || s.altText || s.subject || '';
        setMsg('image-msg', 'Active slot: ' + (s.sectionId || s.appId || ''), '');
      };
    });
  }

  async function loadPreview() {
    if (!state.draftId || !state.selectedVersionId) return;
    setMsg('preview-msg', 'Opening preview…', '');
    try {
      var j = await api('/api/theme-studio/preview', {
        body: {
          draftId: state.draftId,
          versionId: state.selectedVersionId,
          mode: state.previewMode
        }
      });
      var shell = $('ws-preview-shell');
      if (shell) {
        shell.className =
          'ws-preview-shell' +
          (state.previewMode === 'mobile' ? ' mobile' : state.previewMode === 'tablet' ? ' tablet' : '');
      }
      $('preview').src = j.url;
      setMsg('preview-msg', 'Preview ready · draft only · forms & tracking disabled', 'ok');
      showStudio(Math.max(state.studioStep, 2));
      document.querySelectorAll('#ws-device-toggle button').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-mode') === state.previewMode);
      });
    } catch (e) {
      setMsg('preview-msg', e.message || String(e), 'bad');
    }
  }

  var GEN_STAGES = [
    { text: 'Understanding your business…', icon: 'brain', anim: 'pulse' },
    { text: 'Selecting the best foundation…', icon: 'layout', anim: 'draw' },
    { text: 'Choosing Marketplace apps…', icon: 'sparkles', anim: 'pulse' },
    { text: 'Designing page layouts…', icon: 'website', anim: 'draw' },
    { text: 'Writing content…', icon: 'typography', anim: 'fade' },
    { text: 'Finding imagery…', icon: 'image', anim: 'float' },
    { text: 'Creating concepts…', icon: 'wand', anim: 'wand' },
    { text: 'Almost ready…', icon: 'rocket', anim: 'float' }
  ];

  function showGenOverlay(show) {
    var el = $('ws-gen-overlay');
    if (!el) return;
    el.classList.toggle('ws-hidden', !show);
    el.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  function paintGenStage(i) {
    var stage = GEN_STAGES[i % GEN_STAGES.length];
    var iconHost = $('ws-gen-icon');
    if (iconHost && window.LPAiIcons) {
      iconHost.innerHTML = window.LPAiIcons.svg(stage.icon, {
        size: 84,
        anim: stage.anim,
        playing: true,
        className: 'lp-ai-icon--xl'
      });
    }
    if ($('ws-gen-stage')) $('ws-gen-stage').textContent = stage.text;
    var dots = $('ws-gen-dots');
    if (dots) {
      dots.innerHTML = GEN_STAGES.map(function (_s, idx) {
        return '<span class="' + (idx === i ? 'on' : '') + '"></span>';
      }).join('');
    }
  }

  async function generateConcepts() {
    if (state.generating) return;
    state.generating = true;
    var btn = $('btn-generate-hero');
    if (btn) btn.disabled = true;

    var theatre = { idx: 0 };
    showGenOverlay(true);
    paintGenStage(0);
    var tick = setInterval(function () {
      theatre.idx = Math.min(theatre.idx + 1, GEN_STAGES.length - 1);
      paintGenStage(theatre.idx);
    }, 1400);

    var started = Date.now();
    var minMs = 12000;
    try {
      await autosaveDraft();
      if (!state.draftId) throw new Error('Save your brief before generating concepts.');
      var j = await api('/api/theme-studio/generate-concepts', {
        body: {
          draftId: state.draftId,
          foundationId: ($('foundation') && $('foundation').value) || null,
          brief: collectBrief()
        }
      });
      var elapsed = Date.now() - started;
      if (elapsed < minMs) await new Promise(function (r) {
        setTimeout(r, minMs - elapsed);
      });
      clearInterval(tick);
      paintGenStage(GEN_STAGES.length - 1);
      await new Promise(function (r) {
        setTimeout(r, 500);
      });
      showGenOverlay(false);
      paintConcepts(j.versions);
      setMsg('gen-msg', 'Three concepts ready', 'ok');
      showStudio(1);
    } catch (e) {
      clearInterval(tick);
      showGenOverlay(false);
      setMsg('gen-msg', e.message || String(e), 'bad');
      showWizard(5);
    } finally {
      state.generating = false;
      if (btn) btn.disabled = false;
    }
  }

  function applicationPayload() {
    return {
      draftId: state.draftId,
      versionId: state.selectedVersionId,
      mode: $('apply-mode').value,
      confirmPlan: true,
      acknowledgeWarnings: !!($('apply-ack-warnings') && $('apply-ack-warnings').checked),
      mockImages: true,
      contactConfirmation: {
        businessEmail: ($('apply-business-email') && $('apply-business-email').value) || '',
        leadRecipientEmail: ($('apply-lead-email') && $('apply-lead-email').value) || '',
        phone: ($('apply-phone') && $('apply-phone').value) || '',
        businessName:
          ($('apply-site-name') && $('apply-site-name').value) ||
          ($('businessName') && $('businessName').value) ||
          '',
        confirmed: !!($('apply-contact-confirm') && $('apply-contact-confirm').checked)
      },
      siteIdentity: {
        siteName:
          ($('apply-site-name') && $('apply-site-name').value) ||
          ($('businessName') && $('businessName').value) ||
          '',
        slug: ($('apply-slug') && $('apply-slug').value) || '',
        targetSiteId: ($('apply-target-site') && $('apply-target-site').value) || '',
        templateName: ($('template-name') && $('template-name').value) || '',
        templateVisibility: 'private'
      },
      targetSiteId: ($('apply-target-site') && $('apply-target-site').value) || '',
      templateName: ($('template-name') && $('template-name').value) || '',
      idempotencyKey:
        'ws-apply-' +
        state.draftId +
        '-' +
        state.selectedVersionId +
        '-' +
        ($('apply-mode') && $('apply-mode').value)
    };
  }

  async function canUseThemeStudio() {
    var sess = await sb.auth.getSession();
    var user = sess && sess.data && sess.data.session && sess.data.session.user;
    if (!user) return false;
    var profRes = await sb.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
    if (profRes.data && profRes.data.is_super_admin) return true;
    var partnerRes = await sb.from('partners').select('id,status').eq('user_id', user.id).maybeSingle();
    return !!(partnerRes.data && partnerRes.data.status === 'active');
  }

  async function loadFoundations() {
    var j = await api('/api/theme-studio/foundations', { method: 'GET', body: null });
    var sel = $('foundation');
    if (!sel) return;
    (j.foundations || []).forEach(function (f) {
      var opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name + ' (' + f.category + ')';
      sel.appendChild(opt);
    });
  }

  async function loadSites() {
    var res = await sb.from('sites').select('id,slug,business_name').order('business_name').limit(500);
    var data = res.data || [];
    var opts =
      '<option value="">— none —</option>' +
      data
        .map(function (s) {
          return '<option value="' + esc(s.id) + '">' + esc(s.business_name || s.slug) + '</option>';
        })
        .join('');
    if ($('source-site')) $('source-site').innerHTML = opts;
    if ($('apply-target-site')) {
      $('apply-target-site').innerHTML =
        '<option value="">— select site —</option>' +
        data
          .map(function (s) {
            return '<option value="' + esc(s.id) + '">' + esc(s.business_name || s.slug) + '</option>';
          })
          .join('');
    }
  }

  function bindUi() {
    paintChips('ws-style-chips', STYLE_CHIPS, state.styleChips, function (label) {
      var i = state.styleChips.indexOf(label);
      if (i >= 0) state.styleChips.splice(i, 1);
      else state.styleChips.push(label);
      syncStyleField();
    });
    paintChips('ws-service-chips', SERVICE_CHIPS, state.serviceChips, function (label) {
      var i = state.serviceChips.indexOf(label);
      if (i >= 0) state.serviceChips.splice(i, 1);
      else state.serviceChips.push(label);
      syncServicesField();
    });
    paintGoals();

    if ($('logoFile')) {
      $('logoFile').onchange = function () {
        var f = $('logoFile').files && $('logoFile').files[0];
        if ($('logoName')) $('logoName').value = f ? f.name : '';
      };
    }

    $('btn-prev').onclick = async function () {
      if (state.phase === 'wizard') {
        if (state.wizardStep > 1) showWizard(state.wizardStep - 1);
      } else if (state.studioStep > 1) {
        showStudio(state.studioStep - 1);
      } else {
        showWizard(5);
      }
    };

    $('btn-next').onclick = async function () {
      if (state.wizardStep === 1 && !($('businessName').value && $('industry').value)) {
        setMsg('ws-autosave-msg', 'Add a business name and industry to continue.', 'bad');
        return;
      }
      await autosaveDraft();
      if (state.wizardStep < 5) showWizard(state.wizardStep + 1);
    };

    $('btn-save-draft').onclick = async function () {
      await autosaveDraft();
    };

    $('btn-continue').onclick = function () {
      if (state.studioStep === 1) {
        if (!state.selectedVersionId) {
          setMsg('gen-msg', 'Select a concept to continue.', 'bad');
          return;
        }
        showStudio(2);
        loadPreview();
      } else if (state.studioStep === 2) {
        showStudio(3);
      } else {
        showStudio(4);
      }
    };

    $('btn-gen-again').onclick = function () {
      showWizard(5);
    };

    if ($('btn-generate-hero')) $('btn-generate-hero').onclick = generateConcepts;
    if ($('btn-generate')) $('btn-generate').onclick = generateConcepts;
    if ($('btn-regen-all')) $('btn-regen-all').onclick = generateConcepts;

    document.querySelectorAll('#ws-device-toggle button').forEach(function (b) {
      b.onclick = function () {
        state.previewMode = b.getAttribute('data-mode') || 'desktop';
        loadPreview();
      };
    });

    $('login-btn').onclick = async function () {
      $('gate-msg').classList.add('ws-hidden');
      var result = await sb.auth.signInWithPassword({
        email: $('email').value,
        password: $('password').value
      });
      if (result.error) {
        $('gate-msg').textContent = result.error.message;
        $('gate-msg').classList.remove('ws-hidden');
        return;
      }
      boot();
    };

    $('signout').onclick = async function () {
      await sb.auth.signOut();
      location.reload();
    };

    // Keep legacy create button if present
    if ($('btn-create')) {
      $('btn-create').onclick = async function () {
        await autosaveDraft();
        showWizard(Math.min(5, state.wizardStep + 1));
      };
    }

    $('btn-select').onclick = async function () {
      try {
        await api('/api/theme-studio/select-concept', {
          body: { draftId: state.draftId, versionId: state.selectedVersionId }
        });
        setMsg('preview-msg', 'Concept selected.', 'ok');
        showStudio(3);
      } catch (e) {
        setMsg('preview-msg', e.message || String(e), 'bad');
      }
    };

    if ($('btn-refine')) {
      $('btn-refine').onclick = async function () {
        setMsg('refine-msg', 'Refining…', '');
        try {
          var j = await api('/api/theme-studio/refine', {
            body: {
              draftId: state.draftId,
              versionId: state.selectedVersionId,
              feedback: $('feedback').value
            }
          });
          state.selectedVersionId = j.version.id;
          state.versions = state.versions.concat([j.version]);
          paintConcepts(state.versions);
          setMsg('refine-msg', 'New version ' + j.version.versionNumber + ' stored.', 'ok');
          loadPreview();
          showStudio(4);
        } catch (e) {
          setMsg('refine-msg', e.message || String(e), 'bad');
        }
      };
    }

    if ($('btn-quality')) {
      $('btn-quality').onclick = async function () {
        try {
          var j = await api('/api/theme-studio/quality', {
            body: { draftId: state.draftId, versionId: state.selectedVersionId }
          });
          $('quality-out').textContent = JSON.stringify(j.report, null, 2);
        } catch (e) {
          $('quality-out').textContent = e.message || String(e);
        }
      };
    }

    wireImageAndApplyHandlers();
  }

  function wireImageAndApplyHandlers() {
    if ($('btn-image-search')) {
      $('btn-image-search').onclick = async function () {
        setMsg('image-msg', 'Searching via Image Service…', '');
        try {
          var active = state.activeImageSelection || {};
          var j = await api('/api/image-service/search', {
            body: {
              query: $('image-query').value || active.searchQuery || '',
              brief: {
                purpose: active.sectionId === 'hero' ? 'hero' : 'gallery',
                subject: $('image-query').value || active.altText || '',
                sectionId: active.sectionId || null,
                appId: active.appId || null,
                orientation: active.orientation || 'landscape',
                altTextIntent: active.altText || ''
              }
            }
          });
          state.activeImageSelection = j.selection || state.activeImageSelection;
          $('image-alts').textContent = JSON.stringify(
            {
              selection: {
                provider: j.selection && j.selection.provider,
                providerAssetId: j.selection && j.selection.providerAssetId,
                photographerName: j.selection && j.selection.photographerName,
                sourcePageUrl: j.selection && j.selection.sourcePageUrl,
                altText: j.selection && j.selection.altText
              },
              alternates: (j.alternates || []).slice(0, 6),
              diagnostics: j.diagnostics
            },
            null,
            2
          );
          setMsg(
            'image-msg',
            j.placeholder ? 'No suitable stock result — placeholder returned.' : 'Search complete.',
            'ok'
          );
        } catch (e) {
          setMsg('image-msg', e.message || String(e), 'bad');
        }
      };
    }

    if ($('btn-image-approve')) {
      $('btn-image-approve').onclick = async function () {
        if (!state.activeImageSelection) {
          setMsg('image-msg', 'Select an image slot first.', 'bad');
          return;
        }
        try {
          var cfg = currentDraftConfig() || { __websiteComposer: { imageSelections: [] } };
          var selections = (cfg.__websiteComposer && cfg.__websiteComposer.imageSelections) || [];
          var next = selections.map(function (s) {
            if (
              s.providerAssetId === state.activeImageSelection.providerAssetId &&
              s.sectionId === state.activeImageSelection.sectionId
            ) {
              return Object.assign({}, s, state.activeImageSelection, { approvalStatus: 'approved' });
            }
            return s;
          });
          if (!next.length) next = [Object.assign({}, state.activeImageSelection, { approvalStatus: 'approved' })];
          var j = await api('/api/theme-studio/persist-images', {
            body: {
              draftId: state.draftId,
              versionId: state.selectedVersionId,
              imageSelections: next,
              summary: 'Approved image selection'
            }
          });
          state.selectedVersionId = j.version.id;
          paintImageSlots();
          setMsg('image-msg', 'Image approval saved as version ' + j.version.version_number + '.', 'ok');
        } catch (e) {
          setMsg('image-msg', e.message || String(e), 'bad');
        }
      };
    }

    if ($('btn-image-import')) {
      $('btn-image-import').onclick = async function () {
        if (!state.activeImageSelection) {
          setMsg('image-msg', 'Select an image slot first.', 'bad');
          return;
        }
        try {
          var j = await api('/api/image-service/import-cloudinary', {
            body: { selection: state.activeImageSelection, draftId: state.draftId || 'draft' }
          });
          $('image-alts').textContent = JSON.stringify(j.importPlan, null, 2);
          setMsg('image-msg', 'Import plan ready. Live publish remains gated.', 'ok');
        } catch (e) {
          setMsg('image-msg', e.message || String(e), 'bad');
        }
      };
    }

    if ($('btn-approve-draft')) {
      $('btn-approve-draft').onclick = async function () {
        try {
          var j = await api('/api/theme-studio/approve-draft', {
            body: {
              draftId: state.draftId,
              versionId: state.selectedVersionId,
              approvalState: $('approval-state').value
            }
          });
          state.selectedVersionId = j.version.id;
          setMsg('approve-msg', j.notice + ' · state ' + j.approvalState, 'ok');
        } catch (e) {
          setMsg('approve-msg', e.message || String(e), 'bad');
        }
      };
    }

    if ($('btn-restore-version')) {
      $('btn-restore-version').onclick = async function () {
        try {
          var j = await api('/api/theme-studio/restore-version', {
            body: { draftId: state.draftId, versionId: state.selectedVersionId }
          });
          state.selectedVersionId = j.version.id;
          setMsg('approve-msg', j.notice, 'ok');
        } catch (e) {
          setMsg('approve-msg', e.message || String(e), 'bad');
        }
      };
    }

    if ($('btn-application-plan')) {
      $('btn-application-plan').onclick = async function () {
        try {
          var body = applicationPayload();
          delete body.confirmPlan;
          var j = await api('/api/theme-studio/application-plan', { body: body });
          $('apply-plan').textContent =
            (j.plan && j.plan.humanSummary ? j.plan.humanSummary.join('\n') : '') +
            '\n\n' +
            JSON.stringify(
              {
                mode: j.plan && j.plan.applicationMode,
                apps: j.plan && j.plan.marketplaceAppsInstalling,
                warnings: j.validation && j.validation.warnings,
                blocking: j.validation && j.validation.critical,
                canCommit: j.canCommit
              },
              null,
              2
            );
          setMsg(
            'apply-msg',
            j.canCommit ? 'Plan ready — nothing was published.' : 'Plan blocked — resolve critical issues.',
            j.canCommit ? 'ok' : 'bad'
          );
        } catch (e) {
          setMsg('apply-msg', e.message || String(e), 'bad');
        }
      };
    }

    if ($('btn-apply-concept')) {
      $('btn-apply-concept').onclick = async function () {
        try {
          var j = await api('/api/theme-studio/apply-concept', { body: applicationPayload() });
          var line = j.notice || 'Done';
          if (j.site) line += ' · draft site ' + (j.site.slug || j.site.id);
          setMsg('apply-msg', line, 'ok');
          $('apply-plan').textContent = JSON.stringify(
            { mode: j.mode, site: j.site, nextActions: j.nextActions },
            null,
            2
          );
        } catch (e) {
          setMsg('apply-msg', e.message || String(e), 'bad');
        }
      };
    }

    if ($('btn-apply')) {
      $('btn-apply').onclick = async function () {
        try {
          var scope = $('scope').value;
          if (scope === 'my_template') {
            $('btn-template').click();
            return;
          }
          var j = await api('/api/theme-studio/apply', {
            body: {
              draftId: state.draftId,
              versionId: state.selectedVersionId,
              scope: scope,
              confirm: true
            }
          });
          setMsg('apply-msg', j.notice + (j.targetSite ? ' · site ' + j.targetSite.slug : ''), 'ok');
        } catch (e) {
          setMsg('apply-msg', e.message || String(e), 'bad');
        }
      };
    }

    if ($('btn-template')) {
      $('btn-template').onclick = async function () {
        try {
          var j = await api('/api/theme-studio/save-template', {
            body: {
              draftId: state.draftId,
              versionId: state.selectedVersionId,
              name: $('template-name').value || $('businessName').value + ' template'
            }
          });
          setMsg('apply-msg', j.notice, 'ok');
        } catch (e) {
          setMsg('apply-msg', e.message || String(e), 'bad');
        }
      };
    }
  }

  function upgradeLogos() {
    if (window.LPLogo && window.LPLogo.upgradeAll) {
      window.LPLogo.upgradeAll({ pulse: true });
    }
  }

  async function boot() {
    var ok = await canUseThemeStudio();
    if (!ok) {
      $('gate-msg').textContent = 'Website Studio is limited to superusers and partners.';
      $('gate-msg').classList.remove('ws-hidden');
      await sb.auth.signOut();
      return;
    }
    $('gate').classList.add('ws-hidden');
    $('app').classList.remove('ws-hidden');
    if ($('ws-actionbar')) $('ws-actionbar').classList.remove('ws-hidden');
    upgradeLogos();
    await loadFoundations();
    await loadSites();
    showWizard(1);
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindUi();
    upgradeLogos();
    sb.auth.getSession().then(function (r) {
      if (r && r.data && r.data.session) boot();
    });
  });
})();
