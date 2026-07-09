/**
 * Quote builder tag clouds — common features, job intros, and partner custom tags
 * (promoted after the same manual prompt is entered 3 times).
 */
(function (global) {
  'use strict';

  var COMMON_FEATURE_TAGS = [
    'Mobile-friendly responsive design',
    'Contact form with email notifications',
    'Online booking / appointment scheduling',
    'Google Maps & location embed',
    'SEO setup — titles, meta & sitemap',
    'Service area pages',
    'Before & after photo gallery',
    'Customer reviews / testimonials',
    'FAQ section',
    'Click-to-call phone buttons',
    'Social media links',
    'Privacy policy & terms pages',
    'Blog / news section',
    'Live chat widget ready',
    'Google Analytics & conversion tracking',
    'Fast hosting with SSL certificate',
    'Accessibility-friendly layout',
    'Brand colours & logo applied',
    'Hero slider / image carousel',
    'Lead capture pop-up or banner',
    'Email newsletter signup',
    'Price list / services menu',
    'Team / staff profiles',
    'Opening hours display',
    'Multi-location support',
  ];

  var JOB_INTRO_TAGS = [
    'A fast, professional website built on LeadPages — open-source technology you own, without agency lock-in or surprise rebuild fees.',
    'Your new site runs on proven open-source foundations: fast, secure, and easy to update — not trapped inside a proprietary page builder.',
    'Skip the months-long agency timeline. We deliver a polished, mobile-ready site on LeadPages with hosting, SSL, and ongoing support included.',
    'Unlike drag-and-drop builders that charge forever for basics, this is a custom-built LeadPages site — yours to grow, with transparent pricing.',
    'No bloated WordPress plugins or Wix limitations. A lean, purpose-built website designed to convert visitors into leads from day one.',
    'Built by an approved LeadPages partner — real human support, not a ticket queue. Your business gets a premium site without enterprise-agency pricing.',
    'Open-source under the hood means you are never held hostage by one vendor. LeadPages gives you speed, SEO, and a site that scales with your business.',
    'Traditional agencies quote $8k–$15k and vanish after launch. This LeadPages package delivers the same polish with clear build + hosting costs.',
    'A lead-generation website — not just a digital brochure. Forms, tracking, and mobile UX tuned so enquiries land in your inbox.',
    'Your brand deserves better than a template farm. Custom layout, your colours, your copy — deployed on infrastructure built for Australian businesses.',
  ];

  function norm(s) {
    return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function storageKey(partnerId, kind) {
    return 'lp_quote_' + kind + '_' + String(partnerId || 'anon');
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_e) {
      return fallback;
    }
  }

  function writeJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_e) {}
  }

  function getCustomTags(partnerId, type) {
    return readJson(storageKey(partnerId, 'custom_' + type), []);
  }

  function getUsage(partnerId, type) {
    return readJson(storageKey(partnerId, 'usage_' + type), {});
  }

  function bumpUsage(partnerId, type, text) {
    var key = norm(text);
    if (!key || key.length < 3) return;
    var usage = getUsage(partnerId, type);
    usage[key] = (usage[key] || 0) + 1;
    writeJson(storageKey(partnerId, 'usage_' + type), usage);
    if (usage[key] >= 3) promoteCustom(partnerId, type, text);
  }

  function promoteCustom(partnerId, type, text) {
    var trimmed = String(text || '').trim().replace(/\s+/g, ' ');
    if (!trimmed) return;
    var list = getCustomTags(partnerId, type);
    var exists = list.some(function (t) { return norm(t) === norm(trimmed); });
    if (exists) return;
    list.unshift(trimmed);
    if (list.length > 24) list = list.slice(0, 24);
    writeJson(storageKey(partnerId, 'custom_' + type), list);
  }

  function allFeatureTags(partnerId) {
    var custom = getCustomTags(partnerId, 'features');
    var seen = {};
    var out = [];
    custom.concat(COMMON_FEATURE_TAGS).forEach(function (t) {
      var k = norm(t);
      if (!k || seen[k]) return;
      seen[k] = true;
      out.push(t);
    });
    return out;
  }

  function allJobTags(partnerId) {
    var custom = getCustomTags(partnerId, 'jobs');
    var seen = {};
    var out = [];
    custom.concat(JOB_INTRO_TAGS).forEach(function (t) {
      var k = norm(t);
      if (!k || seen[k]) return;
      seen[k] = true;
      out.push(t);
    });
    return out;
  }

  function trackManualFeatures(partnerId, features) {
    (features || []).forEach(function (f) { bumpUsage(partnerId, 'features', f); });
  }

  function trackManualJob(partnerId, desc) {
    var d = String(desc || '').trim();
    if (!d) return;
    var fromPresets = JOB_INTRO_TAGS.some(function (j) { return norm(j) === norm(d); });
    var fromCustom = getCustomTags(partnerId, 'jobs').some(function (j) { return norm(j) === norm(d); });
    if (!fromPresets && !fromCustom) bumpUsage(partnerId, 'jobs', d);
  }

  function closeAllPopovers(except) {
    document.querySelectorAll('.lp-quote-tag-pop').forEach(function (el) {
      if (el !== except) el.hidden = true;
    });
  }

  function renderTagCloud(container, tags, opts) {
    container.innerHTML = '';
    if (!tags.length) {
      container.innerHTML = '<p class="lp-quote-tag-empty">No tags yet — type your own and we\'ll remember favourites after 3 uses.</p>';
      return;
    }
    var selected = opts.selected || {};
    tags.forEach(function (tag) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lp-quote-tag-chip' + (selected[norm(tag)] ? ' is-on' : '');
      btn.textContent = tag;
      btn.title = tag;
      btn.onclick = function () {
        if (opts.multi) {
          var on = btn.classList.toggle('is-on');
          if (on) opts.onSelect(tag);
          else if (opts.onDeselect) opts.onDeselect(tag);
        } else {
          opts.onSelect(tag);
          if (opts.closeOnSelect && opts.popover) opts.popover.hidden = true;
        }
      };
      container.appendChild(btn);
    });
  }

  function featValues() {
    var c = document.getElementById('q-feats');
    if (!c) return [];
    var out = [];
    c.querySelectorAll('input').forEach(function (i) {
      var v = (i.value || '').trim();
      if (v) out.push(v);
    });
    return out;
  }

  function hasFeat(val) {
    var n = norm(val);
    return featValues().some(function (f) { return norm(f) === n; });
  }

  function addFeatIfMissing(val) {
    if (!val || hasFeat(val)) return;
    if (typeof global.addFeatRow === 'function') global.addFeatRow(val);
    else {
      var c = document.getElementById('q-feats');
      if (!c) return;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px';
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'lp-quote-inline-input';
      inp.style.flex = '1';
      inp.value = val;
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'btn';
      rm.textContent = '\u00d7';
      rm.style.cssText = 'padding:8px 12px';
      rm.onclick = function () { row.remove(); syncFeatureTagSelection(); };
      row.appendChild(inp);
      row.appendChild(rm);
      c.appendChild(row);
    }
    syncFeatureTagSelection();
  }

  function removeFeat(val) {
    var n = norm(val);
    var c = document.getElementById('q-feats');
    if (!c) return;
    c.querySelectorAll('input').forEach(function (i) {
      if (norm(i.value) === n) {
        var row = i.parentElement;
        if (row) row.remove();
      }
    });
    syncFeatureTagSelection();
  }

  var featCloudEl = null;
  var jobCloudEl = null;

  function selectedFeatMap() {
    var m = {};
    featValues().forEach(function (f) { m[norm(f)] = true; });
    return m;
  }

  function syncFeatureTagSelection() {
    if (!featCloudEl) return;
    var sel = selectedFeatMap();
    featCloudEl.querySelectorAll('.lp-quote-tag-chip').forEach(function (chip) {
      chip.classList.toggle('is-on', !!sel[norm(chip.textContent)]);
    });
  }

  function buildPopover(id, title, hint) {
    var pop = document.createElement('div');
    pop.id = id;
    pop.className = 'lp-quote-tag-pop';
    pop.hidden = true;
    pop.innerHTML =
      '<div class="lp-quote-tag-pop-hd"><span>' + title + '</span>'
      + '<button type="button" class="lp-quote-tag-pop-x" aria-label="Close">\u00d7</button></div>'
      + (hint ? '<p class="lp-quote-tag-pop-hint">' + hint + '</p>' : '')
      + '<div class="lp-quote-tag-cloud"></div>';
    pop.querySelector('.lp-quote-tag-pop-x').onclick = function () { pop.hidden = true; };
    return pop;
  }

  function wireQuoteTags(partnerId) {
    var descEl = document.getElementById('q-desc');
    var featsWrap = document.getElementById('q-feats');
    if (!descEl || !featsWrap) return;

    var descField = descEl.closest('.field');
    var featField = featsWrap.closest('.field');
    if (!descField || !featField) return;
    if (document.getElementById('q-job-tags-btn')) return;

    var jobBtn = document.createElement('button');
    jobBtn.type = 'button';
    jobBtn.className = 'btn lp-quote-tag-trigger';
    jobBtn.id = 'q-job-tags-btn';
    jobBtn.textContent = 'Job Tags';

    var featBtn = document.createElement('button');
    featBtn.type = 'button';
    featBtn.className = 'btn lp-quote-tag-trigger';
    featBtn.id = 'q-feature-tags-btn';
    featBtn.textContent = 'Feature Tags';

    var jobBar = document.createElement('div');
    jobBar.className = 'lp-quote-tag-bar';
    jobBar.appendChild(jobBtn);

    var featBar = document.createElement('div');
    featBar.className = 'lp-quote-tag-bar';
    featBar.appendChild(featBtn);

    descField.insertBefore(jobBar, descEl);
    featField.insertBefore(featBar, featsWrap);

    var jobPop = buildPopover('q-job-tags-pop', 'Job description intros', 'Tap to insert — highlights LeadPages, open source & value vs agencies.');
    var featPop = buildPopover('q-feature-tags-pop', 'Common website features', 'Multi-select — chosen items are added to your feature list.');
    jobCloudEl = jobPop.querySelector('.lp-quote-tag-cloud');
    featCloudEl = featPop.querySelector('.lp-quote-tag-cloud');

    descField.style.position = 'relative';
    featField.style.position = 'relative';
    descField.appendChild(jobPop);
    featField.appendChild(featPop);

    function refreshJobCloud() {
      renderTagCloud(jobCloudEl, allJobTags(partnerId), {
        multi: false,
        closeOnSelect: true,
        popover: jobPop,
        onSelect: function (tag) {
          var cur = (descEl.value || '').trim();
          descEl.value = cur ? cur + '\n\n' + tag : tag;
          descEl.focus();
        },
      });
    }

    function refreshFeatCloud() {
      renderTagCloud(featCloudEl, allFeatureTags(partnerId), {
        multi: true,
        selected: selectedFeatMap(),
        onSelect: function (tag) { addFeatIfMissing(tag); },
        onDeselect: function (tag) { removeFeat(tag); },
      });
    }

    refreshJobCloud();
    refreshFeatCloud();

    jobBtn.onclick = function (e) {
      e.stopPropagation();
      var open = jobPop.hidden;
      closeAllPopovers(open ? jobPop : null);
      if (open) {
        refreshJobCloud();
        jobPop.hidden = false;
      }
    };

    featBtn.onclick = function (e) {
      e.stopPropagation();
      var open = featPop.hidden;
      closeAllPopovers(open ? featPop : null);
      if (open) {
        refreshFeatCloud();
        featPop.hidden = false;
      }
    };

    document.addEventListener('click', function (e) {
      if (e.target.closest('.lp-quote-tag-pop') || e.target.closest('.lp-quote-tag-trigger')) return;
      closeAllPopovers();
    });

    descEl.addEventListener('blur', function () {
      trackManualJob(partnerId, descEl.value);
      refreshJobCloud();
    });

    featsWrap.addEventListener('focusout', function () {
      trackManualFeatures(partnerId, featValues());
      refreshFeatCloud();
    });

    global.__lpQuoteTagsTrackSubmit = function () {
      trackManualJob(partnerId, descEl.value);
      trackManualFeatures(partnerId, featValues());
      refreshJobCloud();
      refreshFeatCloud();
    };
  }

  global.LpQuoteTags = {
    init: wireQuoteTags,
    trackSubmit: function (partnerId, jobDesc, features) {
      trackManualJob(partnerId, jobDesc);
      trackManualFeatures(partnerId, features);
    },
    COMMON_FEATURE_TAGS: COMMON_FEATURE_TAGS,
    JOB_INTRO_TAGS: JOB_INTRO_TAGS,
  };
})(window);
