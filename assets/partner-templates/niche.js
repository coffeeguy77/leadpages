/* Industry partner pages (Nov 2026): makes each "example experience" work, then hands what the
   prospect tried to the partner's enquiry form. Generic data-nz-* behaviours:
   radio/checkbox cards (.nz-opt / .nz-check) \u00b7 tabs (data-nz-tab / data-nz-panel) \u00b7
   reveal (data-nz-reveal) \u00b7 steps (data-nz-steps / data-nz-next / data-nz-prev) \u00b7
   filter chips (data-nz-filter + data-nz-row[data-type]) \u00b7 search (data-nz-search) \u00b7
   shortlist toggles (data-nz-toggle + data-nz-count) \u00b7 qty steppers (data-nz-inc / data-nz-dec) \u00b7
   file names (data-nz-file \u2192 data-nz-filename) \u00b7 dependent selects (data-nz-make \u2192 data-nz-models) \u00b7
   lookbook (data-nz-look) \u00b7 timetable rows (data-nz-row[data-class] \u2192 data-nz-class) \u00b7
   send (data-nz-send): summary of data-nz-q fields into the enquiry message. */
(function () {
  'use strict';
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function syncOpts(root) {
    $$('.nz-opt, .nz-check, .nz-swatch', root).forEach(function (l) {
      var i = l.querySelector('input'); if (i) l.classList.toggle('is-on', !!i.checked);
    });
  }

  function valueOf(el) {
    if (el.matches('input[type=checkbox], input[type=radio]')) return el.checked ? (el.value || 'Yes') : '';
    if (el.matches('input, select, textarea')) {
      if (el.type === 'file') return el.files && el.files.length ? Array.prototype.map.call(el.files, function (f) { return f.name; }).join(', ') : '';
      return String(el.value || '').trim();
    }
    if (el.hasAttribute('data-nz-text')) return el.textContent.replace(/\s+/g, ' ').trim();
    return $$('input:checked', el).map(function (i) { return i.value; }).join(', ');
  }

  function summary(w) {
    var parts = [];
    $$('[data-nz-q]', w).forEach(function (el) {
      // Answers on earlier steps still count; inactive tabs and unrevealed results don't.
      var hid = el.closest('[hidden]');
      if (hid && !hid.hasAttribute('data-nz-step')) return;
      var v = valueOf(el);
      if (v) parts.push(el.getAttribute('data-nz-q') + ': ' + v);
    });
    // Shortlists with quantities (manufacturing)
    var items = $$('[data-nz-toggle].is-on[data-item]', w).map(function (b) {
      var q = w.querySelector('[data-nz-qtyfor="' + b.getAttribute('data-item').replace(/"/g, '') + '"]');
      return b.getAttribute('data-item') + (q ? ' \u00d7 ' + q.value : '');
    });
    if (items.length) parts.push('Shortlist: ' + items.join(', '));
    $$('input[type=file]', w).forEach(function (f) { if (f.files && f.files.length && !f.hasAttribute('data-nz-q')) parts.push('Files: ' + Array.prototype.map.call(f.files, function (x) { return x.name; }).join(', ')); });
    return parts.join(' \u00b7 ');
  }

  ready(function () {
    $$('[data-nz-w]').forEach(syncOpts);

    document.addEventListener('change', function (e) {
      var w = e.target.closest && e.target.closest('[data-nz-w], .nz-exp-widget');
      if (!w) return;
      syncOpts(w);
      var t = e.target;
      if (t.matches('input[type=radio][data-team]')) {
        var team = w.querySelector('[data-nz-team]'); if (team) team.textContent = t.getAttribute('data-team');
      }
      if (t.matches('[data-nz-make]')) {
        var m = w.querySelector('[data-nz-models]');
        if (m) {
          var map = {}; try { map = JSON.parse(m.getAttribute('data-nz-models')); } catch (_e) {}
          m.innerHTML = (map[t.value] || []).map(function (x) { return '<option>' + x.replace(/</g, '&lt;') + '</option>'; }).join('');
        }
      }
      if (t.matches('[data-nz-file]')) {
        var label = t.closest('label'); var span = label && label.querySelector('[data-nz-filename]');
        if (span) span.textContent = t.files && t.files.length ? Array.prototype.map.call(t.files, function (f) { return f.name; }).join(', ') : span.textContent;
      }
      if (t.matches('[data-nz-type]')) filterTypes(w);
    });

    document.addEventListener('input', function (e) {
      var t = e.target;
      if (!t.matches || !t.matches('[data-nz-search]')) return;
      var w = t.closest('[data-nz-w]'); var q = t.value.trim().toLowerCase();
      $$('[data-nz-row]', w).forEach(function (r) { r.hidden = !!q && r.textContent.toLowerCase().indexOf(q) < 0; });
    });

    function filterTypes(w) {
      var on = $$('[data-nz-type]:checked', w).map(function (i) { return i.value; });
      $$('[data-nz-row]', w).forEach(function (r) { r.classList.toggle('is-dim', on.length > 0 && on.indexOf(r.getAttribute('data-type')) < 0); });
    }

    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target : null; if (!t) return;
      var w = t.closest('[data-nz-w]') || t.closest('.nz-exp-widget');

      var more = t.closest('[data-nz-more]');
      if (more) {
        var box = document.getElementById(more.getAttribute('aria-controls'));
        if (box) {
          var open = box.hasAttribute('hidden');
          if (open) box.removeAttribute('hidden'); else box.setAttribute('hidden', '');
          more.setAttribute('aria-expanded', open ? 'true' : 'false');
          more.classList.toggle('is-open', open);
          if (open) window.dispatchEvent(new Event('scroll'));
        }
        return;
      }
      if (!w) return;

      var tab = t.closest('[data-nz-tab]');
      if (tab) {
        var name = tab.getAttribute('data-nz-tab');
        $$('[data-nz-tab]', w).forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-nz-tab') === name && b.classList.contains('nz-tab')); });
        $$('[data-nz-panel]', w).forEach(function (p) { p.hidden = p.getAttribute('data-nz-panel') !== name; });
        return;
      }
      var rev = t.closest('[data-nz-reveal]');
      if (rev) {
        var target = w.querySelector(rev.getAttribute('data-nz-reveal'));
        if (target) { target.hidden = false; target.classList.add('is-new'); }
        return;
      }
      var next = t.closest('[data-nz-next], [data-nz-prev]');
      if (next) {
        var steps = $$('[data-nz-step]', w); var dots = $$('[data-nz-dot]', w);
        var cur = steps.findIndex(function (s) { return !s.hidden; });
        var to = Math.max(0, Math.min(steps.length - 1, cur + (next.hasAttribute('data-nz-next') ? 1 : -1)));
        steps.forEach(function (s, i) { s.hidden = i !== to; });
        dots.forEach(function (d, i) { d.classList.toggle('is-on', i <= to); });
        return;
      }
      var chip = t.closest('[data-nz-filter]');
      if (chip) {
        var want = chip.getAttribute('data-nz-filter');
        $$('[data-nz-filter]', w).forEach(function (c) { c.classList.toggle('is-on', c === chip); });
        $$('[data-nz-row]', w).forEach(function (r) { r.hidden = !!want && r.getAttribute('data-type') !== want; });
        return;
      }
      var row = t.closest('[data-nz-row][data-class]');
      if (row) {
        var wrap = row.closest('.nz-fit') || w;
        $$('[data-nz-row]', wrap).forEach(function (r) { r.classList.toggle('is-on', r === row); });
        var sel = wrap.querySelector('[data-nz-class]');
        if (sel) { sel.value = row.getAttribute('data-class'); sel.classList.add('is-new'); setTimeout(function () { sel.classList.remove('is-new'); }, 900); }
        return;
      }
      var tog = t.closest('[data-nz-toggle]');
      if (tog) {
        var on = !tog.classList.contains('is-on');
        tog.classList.toggle('is-on', on);
        tog.textContent = on ? tog.getAttribute('data-on') : tog.getAttribute('data-off');
        var cnt = w.querySelector('[data-nz-count]');
        if (cnt) cnt.textContent = String($$('[data-nz-toggle].is-on[data-item]', w).length);
        return;
      }
      var step = t.closest('[data-nz-inc], [data-nz-dec]');
      if (step) {
        var inp = step.parentNode.querySelector('input');
        if (inp) inp.value = String(Math.max(1, (parseInt(inp.value, 10) || 1) + (step.hasAttribute('data-nz-inc') ? 1 : -1)));
        return;
      }
      var flash = t.closest('[data-nz-flash]');
      if (flash) {
        var was = flash.textContent; flash.textContent = flash.getAttribute('data-nz-flash'); flash.classList.add('is-done');
        setTimeout(function () { flash.textContent = was; flash.classList.remove('is-done'); }, 1400);
        return;
      }
      var look = t.closest('[data-nz-look]');
      if (look) {
        $$('[data-nz-look]', w).forEach(function (b) { b.classList.toggle('is-on', b === look); });
        var set = function (sel, v) { var el = w.querySelector(sel); if (el && v) el.textContent = v; };
        set('[data-nz-main-title]', look.getAttribute('data-title'));
        set('[data-nz-service]', look.getAttribute('data-service'));
        set('[data-nz-stylist]', look.getAttribute('data-stylist'));
        return;
      }
    });

    // Send: note what they tried in the enquiry form, before the pop-up opens (capture phase).
    document.addEventListener('click', function (e) {
      var s = e.target.closest && e.target.closest('[data-nz-send]');
      if (!s) return;
      var w = s.closest('.nz-exp-widget') || s.closest('[data-nz-w]');
      var note = summary(w);
      var title = (document.querySelector('.nz-exp .nz-h2') || {}).textContent || 'Example experience';
      var msg = 'I tried the example on your page (' + title.replace(/\s+/g, ' ').trim() + ')' + (note ? ': ' + note : '') + '.\nI\u2019d like something like this for my business.';
      var dlg = document.getElementById('st-contact');
      var ta = dlg && dlg.querySelector('textarea[name="message"]');
      if (ta) ta.value = msg;
      var hidden = document.querySelector('.nz-form input[name="message"]');
      if (hidden) hidden.value = msg;
    }, true);
  });
})();
