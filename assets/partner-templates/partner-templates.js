document.addEventListener('DOMContentLoaded', function () {
  initLeadForms();
  initMobileMenu();
  initWordArt();
  initGlitch();
  initScrollReveal();
  initPartnerLogos();
});

function initPartnerLogos() {
  if (!document.body.getAttribute('data-pt-template')) return;
  if (window.LPLogo && window.LPLogo.upgradeAll) {
    window.LPLogo.upgradeAll({ pulse: false }).catch(function () {});
  }
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
  var nav = document.querySelector('.ch-nav-links, .sg-nav, .at-mast-nav, .hz-nav nav, .pl-nav, .vt-nav');
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
  var els = document.querySelectorAll('.pt-demo-card, .pt-reveal, .ch-demo-card, .sg-demo, .hz-card, .pl-demo, .vt-project');
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
