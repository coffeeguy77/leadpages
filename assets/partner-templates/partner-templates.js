document.addEventListener('DOMContentLoaded', function () {
  initLeadForms();
  initMobileMenu();
  initWordArt();
  initGlitch();
  initScrollReveal();
  initPartnerLogos();
  initCausehouseFaqExpand();
  initCausehouseStagedForm();
  initWebcultureDemoCarousel();
  initWebcultureGallery();
  initWebcultureFormMore();
  initWebcultureHeroShowcase();
  initWebcultureHeroEcosystem();
  initWebcultureFlowPulse();
  initWebcultureTimeline();
  initWebcultureStickyCta();
  initWebcultureReviewSlider();
  initWebcultureDemoFaq();
});

// Avoid bfcache showing a previously visited trade demo when returning to a partner theme page.
window.addEventListener('pageshow', function (event) {
  if (event.persisted && document.body && document.body.getAttribute('data-pt-template')) {
    window.location.reload();
  }
});

function initWebcultureFooterLogo() {
  var footerLp = document.querySelector('.wc-footer-lp-logo');
  if (!footerLp || !window.LPLogo || !window.LPLogo.mountLogo) return Promise.resolve();
  footerLp.dataset.lpLogoMounted = 'false';
  var accent = getComputedStyle(document.documentElement).getPropertyValue('--pt-accent').trim() || '#C5E13F';
  return window.LPLogo.mountLogo(footerLp, { pulse: true, ink: '#ffffff', accent: accent });
}

function initPartnerLogos() {
  if (!document.body.getAttribute('data-pt-template')) return;
  if (!window.LPLogo || !window.LPLogo.upgradeAll) return;
  var tpl = document.body.getAttribute('data-pt-template') || '';
  var pulse = tpl === 'webculture';
  window.LPLogo.upgradeAll({ pulse: pulse }).then(function () {
    if (tpl === 'webculture') return initWebcultureFooterLogo();
  }).catch(function () {});
}

function initLeadForms() {
  var body = document.body;
  var siteId = body.getAttribute('data-pl-site-id') || '';
  var slug = body.getAttribute('data-pl-slug') || '';
  var siteName = body.getAttribute('data-pl-site') || 'Partner website';

  document.querySelectorAll('[data-pl-lead-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var err = form.querySelector('.pl-form-err');
      var ok = form.querySelector('.pl-form-ok');
      if (err) err.textContent = '';
      if (ok) ok.hidden = true;
      var fd = new FormData(form);
      var name = String(fd.get('name') || '').trim();
      var email = String(fd.get('email') || '').trim();
      var phone = String(fd.get('phone') || '').trim();
      if (!name && !email && !phone) {
        if (err) err.textContent = 'Add your name and a phone or email so we can reach you.';
        return;
      }
      if (btn) {
        btn.disabled = true;
        btn.dataset.plLabel = btn.textContent;
        btn.textContent = 'Sending…';
      }
      var kind = form.getAttribute('data-pl-kind') || 'partner-showcase';
      var partnerId = body.getAttribute('data-pl-partner-id') || '';
      var template = body.getAttribute('data-pt-template') || '';
      var extended = form.getAttribute('data-pl-extended') === '1';
      var details = {
        source: 'partner-template',
        template: template,
        form: kind,
        partnerId: partnerId || undefined,
        referrer: document.referrer || undefined,
        utm: window.location.search || undefined
      };
      if (extended) {
        ['businessName', 'existingWebsite', 'industry', 'suburb', 'projectType', 'mainGoal', 'budget', 'timeframe', 'contactMethod', 'message'].forEach(function (k) {
          var v = String(fd.get(k) || '').trim();
          if (v) details[k] = v;
        });
        var feats = fd.getAll('features');
        if (feats && feats.length) details.features = feats;
        var demoRef = form.closest('[data-demo-ref]');
        if (demoRef) details.demoRef = demoRef.getAttribute('data-demo-ref');
      }
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site: siteName,
          siteId: siteId || undefined,
          slug: slug || undefined,
          partnerId: partnerId || undefined,
          kind: kind,
          name: name,
          email: email || null,
          phone: phone,
          details: details
        })
      }).then(function () {
        form.reset();
        if (ok) ok.hidden = false;
      }).catch(function () {
        if (err) err.textContent = 'Something went wrong — please call or email us directly.';
      }).finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = btn.dataset.plLabel || 'Submit';
        }
      });
    });
  });
}

function initMobileMenu() {
  var btn = document.querySelector('[data-pt-menu]');
  var nav = document.querySelector('.ch-nav-links, .ch-nav, .wc-nav-links, .wc-nav, .sg-nav, .at-mast-nav, .hz-nav nav, .pl-nav, .vt-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    btn.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      nav.classList.remove('is-open');
      btn.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
}

function initWordArt() {
  document.querySelectorAll('.ch-word-art').forEach(function (el) {
    var text = el.getAttribute('data-text') || el.textContent;
    if (!text) return;
    el.innerHTML = text.split('').map(function (ch, i) {
      if (ch === ' ') return '<span class="ch-char ch-space">&nbsp;</span>';
      return '<span class="ch-char" style="--i:' + i + '">' + ch + '</span>';
    }).join('');
  });
}

function initGlitch() {
  document.querySelectorAll('.pl-glitch').forEach(function (el) {
    if (!el.getAttribute('data-text')) el.setAttribute('data-text', el.textContent);
  });
}

function initScrollReveal() {
  if (!('IntersectionObserver' in window)) return;
  var els = document.querySelectorAll('.pt-demo-card, .pt-reveal, .ch-demo-card, .ch-card-hard, .sg-demo, .hz-card, .pl-demo, .vt-project, [data-prm-lift]');
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add('pt-visible');
        obs.unobserve(en.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach(function (el) {
    el.classList.add('pt-reveal');
    obs.observe(el);
  });
}

function initCausehouseFaqExpand() {
  document.querySelectorAll('[data-ch-faq-expand]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var more = document.querySelector('[data-ch-faq-more]');
      if (!more) return;
      var open = more.hidden;
      more.hidden = !open;
      btn.hidden = open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
}

function initCausehouseStagedForm() {
  document.querySelectorAll('[data-ch-staged-form]').forEach(function (form) {
    var toggle = form.querySelector('[data-ch-form-more]');
    var extended = form.querySelector('[data-ch-form-extended]');
    if (!toggle || !extended) return;
    toggle.addEventListener('click', function () {
      var open = extended.hidden;
      extended.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? 'Hide extra details' : toggle.getAttribute('data-label-default') || toggle.textContent;
    });
    toggle.setAttribute('data-label-default', toggle.textContent);
  });
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initLiveIframeScroll(root) {
  if (!root || prefersReducedMotion()) return;
  var states = [];
  root.querySelectorAll('[data-prm-live-scroll]').forEach(function (iframe) {
    states.push({ iframe: iframe, y: 0, dir: 1, paused: false, max: 0 });
    iframe.addEventListener('load', function () {
      try {
        var doc = iframe.contentDocument;
        var h = (doc && doc.documentElement) ? doc.documentElement.scrollHeight : 0;
        states.forEach(function (s) {
          if (s.iframe === iframe) {
            s.max = Math.max(0, h - iframe.clientHeight);
          }
        });
      } catch (_e) {}
    });
  });
  if (!states.length) return;
  function setPaused(val) {
    states.forEach(function (s) { s.paused = val; });
  }
  root.addEventListener('mouseenter', function () { setPaused(true); });
  root.addEventListener('mouseleave', function () { setPaused(false); });
  root.addEventListener('focusin', function () { setPaused(true); });
  root.addEventListener('focusout', function () { setPaused(false); });
  (function tick() {
    states.forEach(function (s) {
      if (s.paused) return;
      try {
        var win = s.iframe.contentWindow;
        var doc = s.iframe.contentDocument;
        if (!win || !doc) return;
        s.max = Math.max(0, (doc.documentElement.scrollHeight || doc.body.scrollHeight) - s.iframe.clientHeight);
        if (s.max <= 4) return;
        s.y += s.dir * 0.4;
        if (s.y >= s.max) { s.y = s.max; s.dir = -1; }
        if (s.y <= 0) { s.y = 0; s.dir = 1; }
        win.scrollTo(0, s.y);
      } catch (_e) {}
    });
    window.requestAnimationFrame(tick);
  })();
}

function initWebcultureDemoCarousel() {
  document.querySelectorAll('[data-prm-demo-carousel]').forEach(function (section) {
    var tablist = section.querySelector('[data-prm-demo-panels]');
    if (!tablist) return;
    var tabs = Array.prototype.slice.call(section.querySelectorAll('[data-prm-tab]'));
    var panels = Array.prototype.slice.call(tablist.querySelectorAll('[data-prm-panel]'));
    var indicators = Array.prototype.slice.call(section.querySelectorAll('[data-prm-demo-indicator]'));
    var prevBtn = section.querySelector('[data-prm-demo-prev]');
    var nextBtn = section.querySelector('[data-prm-demo-next]');
    var interval = parseInt(section.getAttribute('data-prm-demo-interval') || '8000', 10);
    var index = 0;
    var timer = null;
    var paused = false;

    function activate(next) {
      index = (next + panels.length) % panels.length;
      var panel = panels[index];
      var key = panel.getAttribute('data-prm-panel');
      tabs.forEach(function (tab, i) {
        var active = i === index;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      indicators.forEach(function (dot, i) {
        var active = i === index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panels.forEach(function (p, i) {
        var active = i === index;
        p.classList.toggle('is-active', active);
        p.hidden = !active;
        if (active) {
          p.classList.remove('is-entering');
          void p.offsetWidth;
          p.classList.add('is-entering');
          window.setTimeout(function () {
            p.classList.remove('is-entering');
          }, 380);
        }
      });
      section.querySelectorAll('[data-prm-faq-panel]').forEach(function (faqPanel) {
        faqPanel.hidden = faqPanel.getAttribute('data-prm-faq-panel') !== key;
      });
      if (panel) initLiveIframeScroll(panel);
    }

    function startTimer() {
      if (timer) window.clearInterval(timer);
      if (panels.length < 2 || paused) return;
      timer = window.setInterval(function () {
        activate(index + 1);
      }, interval);
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        activate(i);
        startTimer();
      });
    });
    indicators.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        activate(i);
        startTimer();
      });
    });
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        activate(index - 1);
        startTimer();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        activate(index + 1);
        startTimer();
      });
    }
    section.addEventListener('mouseenter', function () {
      paused = true;
      if (timer) window.clearInterval(timer);
    });
    section.addEventListener('mouseleave', function () {
      paused = false;
      startTimer();
    });
    activate(0);
    startTimer();
  });
}

function initWebcultureGallery() {
  document.querySelectorAll('[data-prm-gallery-card]').forEach(function (card) {
    var btn = card.querySelector('.prm-gallery-thumb');
    var panel = card.querySelector('.prm-gallery-panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', function () {
      var open = panel.hidden;
      document.querySelectorAll('.prm-gallery-panel').forEach(function (p) { p.hidden = true; });
      document.querySelectorAll('.prm-gallery-thumb').forEach(function (b) {
        b.setAttribute('aria-expanded', 'false');
      });
      if (open) {
        panel.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

function initWebcultureFormMore() {
  document.querySelectorAll('[data-prm-form-more]').forEach(function (btn) {
    var targetId = btn.getAttribute('aria-controls');
    var panel = targetId ? document.getElementById(targetId) : null;
    if (!panel) return;
    btn.addEventListener('click', function () {
      var open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
}

function initWebcultureHeroShowcase() {
  document.querySelectorAll('[data-prm-hero-showcase]').forEach(function (root) {
    var picks = Array.prototype.slice.call(root.querySelectorAll('[data-prm-hero-pick]'));
    if (!picks.length) return;
    var interval = parseInt(root.getAttribute('data-prm-hero-interval') || '6000', 10);
    var index = 0;
    var timer = null;
    var paused = false;
    var urlEl = root.querySelector('[data-prm-hero-url]');
    var openEl = root.querySelector('[data-prm-hero-open]');
    var phoneOpenEl = root.querySelector('[data-prm-hero-phone-open]');
    var toastTitle = root.querySelector('[data-prm-toast-title]');
    var toastBody = root.querySelector('[data-prm-toast-body]');
    var toastTime = root.querySelector('[data-prm-toast-time]');
    var frames = Array.prototype.slice.call(root.querySelectorAll('.prm-live-frame'));

    function pickAt(i) {
      return picks[(i + picks.length) % picks.length];
    }

    function bindIframe(frame) {
      var iframe = frame.querySelector('.prm-live-iframe');
      if (!iframe || iframe.dataset.prmLiveBound === '1') return;
      iframe.dataset.prmLiveBound = '1';
      iframe.addEventListener('load', function () {
        frame.classList.add('is-live');
      });
    }

    frames.forEach(bindIframe);

    function toastForPick(pick) {
      if (!pick) return;
      var name = pick.getAttribute('data-demo-name') || 'Live demo';
      if (toastTitle) toastTitle.textContent = 'New quote request';
      if (toastBody) toastBody.textContent = name + ' enquiry';
      if (toastTime) {
        var idx = parseInt(pick.getAttribute('data-prm-hero-pick'), 10) || 0;
        toastTime.textContent = (idx % 3 === 0) ? 'Just now' : ((idx % 3 === 1) ? '2 mins ago' : '5 mins ago');
      }
    }

    function setActive(next) {
      index = (next + picks.length) % picks.length;
      var pick = pickAt(index);
      var url = pick.getAttribute('data-demo-url') || '#demos';
      var host = pick.getAttribute('data-demo-host') || '';
      var thumb = pick.getAttribute('data-demo-thumb') || '';

      picks.forEach(function (btn) {
        var active = parseInt(btn.getAttribute('data-prm-hero-pick'), 10) === index;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      if (urlEl && host) urlEl.textContent = host;
      if (openEl) openEl.href = url;
      if (phoneOpenEl) phoneOpenEl.href = url;

      frames.forEach(function (frame) {
        frame.classList.remove('is-live');
        frame.classList.add('is-switching');
        var poster = frame.querySelector('.prm-live-poster');
        if (poster && thumb) poster.src = thumb;
        var iframe = frame.querySelector('.prm-live-iframe');
        if (!iframe) return;
        if (iframe.getAttribute('src') !== url) iframe.src = url;
        else frame.classList.add('is-live');
        window.setTimeout(function () {
          frame.classList.remove('is-switching');
        }, 280);
      });

      toastForPick(pick);
    }

    function startTimer() {
      if (timer) window.clearInterval(timer);
      if (picks.length < 2 || paused) return;
      timer = window.setInterval(function () {
        setActive(index + 1);
      }, interval);
    }

    picks.forEach(function (pick) {
      pick.addEventListener('click', function () {
        var next = parseInt(pick.getAttribute('data-prm-hero-pick'), 10);
        if (Number.isNaN(next)) return;
        setActive(next);
        startTimer();
      });
    });

    root.addEventListener('mouseenter', function () {
      paused = true;
      if (timer) window.clearInterval(timer);
    });
    root.addEventListener('mouseleave', function () {
      paused = false;
      startTimer();
    });
    root.addEventListener('focusin', function () {
      paused = true;
      if (timer) window.clearInterval(timer);
    });
    root.addEventListener('focusout', function () {
      paused = false;
      startTimer();
    });

    setActive(0);
    startTimer();
    initLiveIframeScroll(root);
  });
}

function initWebcultureHeroJourney() {
  if (prefersReducedMotion()) {
    document.querySelectorAll('[data-prm-hero-journey]').forEach(function (root) {
      root.setAttribute('data-journey-step', '5');
      root.classList.add('is-step-5');
    });
    return;
  }
  document.querySelectorAll('[data-prm-hero-journey]').forEach(function (root) {
    var steps = Array.prototype.slice.call(root.querySelectorAll('.prm-journey-step[data-journey-step]'));
    var caption = root.querySelector('[data-prm-journey-caption]');
    var interval = parseInt(root.getAttribute('data-prm-journey-interval') || '7000', 10);
    var stepCount = steps.length || 6;
    var stepMs = Math.max(900, Math.round(interval / stepCount));
    var index = 0;
    var timer = null;
    var labels = steps.map(function (step) {
      return step.getAttribute('title') || '';
    });

    function setStep(next) {
      index = next % stepCount;
      root.setAttribute('data-journey-step', String(index));
      for (var c = 0; c < 6; c++) root.classList.remove('is-step-' + c);
      root.classList.add('is-step-' + index);
      steps.forEach(function (step, i) {
        step.classList.toggle('is-active', i === index);
      });
      if (caption && labels[index]) caption.textContent = labels[index];
    }

    function tick() {
      setStep(index + 1);
    }

    function start() {
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(tick, stepMs);
    }

    setStep(0);
    start();
    root.addEventListener('mouseenter', function () {
      if (timer) window.clearInterval(timer);
    });
    root.addEventListener('mouseleave', start);
  });
}

function initWebcultureHeroEcosystem() {
  document.querySelectorAll('[data-prm-hero-ecosystem]').forEach(function (root) {
    var toasts = [
      root.querySelector('[data-prm-eco-toast="lead"]'),
      root.querySelector('[data-prm-eco-toast="crm"]')
    ].filter(Boolean);
    initLiveIframeScroll(root);
    if (!toasts.length) return;
    if (prefersReducedMotion()) {
      toasts[0].classList.add('is-visible');
      toasts[0].setAttribute('aria-hidden', 'false');
      return;
    }
    var index = 0;
    var timer = null;
    function show(i) {
      index = i % toasts.length;
      toasts.forEach(function (toast, j) {
        var on = j === index;
        toast.classList.toggle('is-visible', on);
        toast.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
    }
    function start() {
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(function () {
        show(index + 1);
      }, 4200);
    }
    show(0);
    start();
    root.addEventListener('mouseenter', function () {
      if (timer) window.clearInterval(timer);
    });
    root.addEventListener('mouseleave', start);
  });
}

function initWebcultureFlowPulse() {
  if (prefersReducedMotion()) return;
  document.querySelectorAll('[data-prm-flow-board]').forEach(function (board) {
    var flowSteps = Array.prototype.slice.call(board.querySelectorAll('[data-prm-flow-step]'));
    if (!flowSteps.length) {
      board.classList.add('is-pulsing');
      return;
    }
    if (!('IntersectionObserver' in window)) {
      flowSteps.forEach(function (step) { step.classList.add('is-lit'); });
      board.classList.add('is-pulsing');
      return;
    }
    board.classList.add('is-sequencing');
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var ratio = en.intersectionRatio;
        var litCount = Math.max(1, Math.ceil(ratio * flowSteps.length));
        flowSteps.forEach(function (step, i) {
          step.classList.toggle('is-lit', i < litCount);
        });
        if (ratio >= 0.75) {
          board.classList.add('is-glowing');
        } else {
          board.classList.remove('is-glowing');
        }
        if (ratio >= 0.92) {
          board.classList.add('is-complete');
          board.classList.remove('is-sequencing');
          board.classList.add('is-pulsing');
        }
      });
    }, { threshold: [0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88, 1], rootMargin: '0px 0px -5% 0px' });
    obs.observe(board);
  });
}

function initWebcultureTimeline() {
  document.querySelectorAll('[data-prm-timeline-animate]').forEach(function (timeline) {
    if (!('IntersectionObserver' in window)) {
      timeline.classList.add('is-complete');
      timeline.querySelectorAll('.prm-timeline-step').forEach(function (step) {
        step.classList.add('is-lit');
      });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var steps = timeline.querySelectorAll('.prm-timeline-step');
        steps.forEach(function (step, i) {
          window.setTimeout(function () {
            step.classList.add('is-lit');
          }, i * 220);
        });
        timeline.classList.add('is-complete');
        obs.unobserve(timeline);
      });
    }, { threshold: 0.25 });
    obs.observe(timeline);
  });

  if (window.matchMedia && window.matchMedia('(min-width: 1024px)').matches) {
    document.querySelectorAll('[data-prm-timeline-interactive]').forEach(function (timeline) {
      var steps = Array.prototype.slice.call(timeline.querySelectorAll('[data-prm-timeline-step]'));
      steps.forEach(function (step) {
        step.addEventListener('mouseenter', function () {
          timeline.classList.add('is-hovered');
          steps.forEach(function (s) { s.classList.remove('is-focused'); });
          step.classList.add('is-focused');
        });
      });
      timeline.addEventListener('mouseleave', function () {
        timeline.classList.remove('is-hovered');
        steps.forEach(function (s) { s.classList.remove('is-focused'); });
      });
    });
  }
}

function initWebcultureDemoFaq() {
  document.querySelectorAll('[data-prm-faq-expand]').forEach(function (btn) {
    var panel = btn.closest('.prm-demo-faq');
    if (!panel) return;
    var more = panel.querySelector('[data-prm-faq-more]');
    if (!more) return;
    btn.addEventListener('click', function () {
      more.hidden = false;
      btn.hidden = true;
    });
  });
}

function initWebcultureStickyCta() {
  var btn = document.querySelector('[data-wc-sticky-cta]');
  if (!btn) return;
  var finalCta = document.querySelector('#cta');
  var footer = document.querySelector('.wc-footer');
  var show = false;
  var ctaVisible = false;
  var footerVisible = false;

  function refresh() {
    btn.hidden = !show || ctaVisible || footerVisible;
  }

  window.addEventListener('scroll', function () {
    show = window.scrollY > 420;
    refresh();
  }, { passive: true });

  function trackVisibility(el, setter) {
    if (!el || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        setter(en.isIntersecting);
        refresh();
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }).observe(el);
  }

  trackVisibility(finalCta, function (v) { ctaVisible = v; });
  trackVisibility(footer, function (v) { footerVisible = v; });

  refresh();
}

function initWebcultureReviewSlider() {
  document.querySelectorAll('[data-prm-review-slider]').forEach(function (root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll('[data-prm-review-slide]'));
    if (slides.length < 2) return;
    var indicators = Array.prototype.slice.call(root.querySelectorAll('[data-prm-review-indicator]'));
    var prevBtn = root.querySelector('[data-prm-review-prev]');
    var nextBtn = root.querySelector('[data-prm-review-next]');
    var interval = parseInt(root.getAttribute('data-prm-review-interval') || '7000', 10);
    var index = 0;
    var timer = null;
    var paused = false;
    var reduced = prefersReducedMotion();

    function activate(next) {
      index = (next + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        var active = i === index;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      indicators.forEach(function (dot, i) {
        var active = i === index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }

    function startTimer() {
      if (timer) window.clearInterval(timer);
      if (reduced || paused || slides.length < 2) return;
      timer = window.setInterval(function () {
        activate(index + 1);
      }, interval);
    }

    indicators.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        activate(i);
        startTimer();
      });
    });
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        activate(index - 1);
        startTimer();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        activate(index + 1);
        startTimer();
      });
    }
    root.addEventListener('mouseenter', function () {
      paused = true;
      if (timer) window.clearInterval(timer);
    });
    root.addEventListener('mouseleave', function () {
      paused = false;
      startTimer();
    });
    root.addEventListener('focusin', function () {
      paused = true;
      if (timer) window.clearInterval(timer);
    });
    root.addEventListener('focusout', function () {
      paused = false;
      startTimer();
    });

    activate(0);
    startTimer();
  });
}
