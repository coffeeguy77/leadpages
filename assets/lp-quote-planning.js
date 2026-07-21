/**
 * LeadPages Online Quote — shared labour planner, staffing & multi-cart UI helpers.
 */
(function(global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function uid() {
    return 'shift-' + Math.random().toString(36).slice(2, 9);
  }

  function defaultShift() {
    return { id: uid(), date: '', startTime: '09:00', endTime: '17:00' };
  }

  function nextCalendarDay(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  function nextShiftFromPrevious(shifts) {
    var list = shifts && shifts.length ? shifts : [defaultShift()];
    var prev = list[list.length - 1];
    return {
      id: uid(),
      date: nextCalendarDay(prev.date) || '',
      startTime: prev.startTime || '09:00',
      endTime: prev.endTime || '17:00'
    };
  }

  function shellLabour(shell) {
    return (shell && shell.labour) || {};
  }

  function allowsShiftPlanner(shell) {
    return shellLabour(shell).allowShiftPlanner !== false;
  }

  function extraBaristaEnabled(shell) {
    var eb = shellLabour(shell).extraBarista || {};
    return eb.enabled !== false;
  }

  function extraBaristaLabel(shell) {
    var eb = shellLabour(shell).extraBarista || {};
    return eb.label || 'Additional barista';
  }

  function splitShiftSettings(shell) {
    var eb = shellLabour(shell).extraBarista || {};
    return eb.splitShift || {};
  }

  function defaultCartRow(product, template) {
    var included = Math.max(1, Number(product && product.baristasIncluded) || 1);
    var row = {
      productId: product ? product.id : '',
      quantity: 1,
      baristas: included,
      extraBaristaMode: 'none',
      splitHours: Math.max(3, Number(splitShiftSettings({ labour: { extraBarista: {} } }).defaultHours) || 4),
      hours: null
    };
    if (template) {
      if (template.hours != null) row.hours = template.hours;
      if (template.baristas != null) row.baristas = template.baristas;
      if (template.extraBaristaMode) row.extraBaristaMode = template.extraBaristaMode;
      if (template.splitHours != null) row.splitHours = template.splitHours;
    }
    return row;
  }

  function defaultHours(state, shell) {
    var min = Math.max(1, Number(shellLabour(shell).minimumHours) || 3);
    var h = parseInt(state.hours, 10);
    return (!isNaN(h) && h > 0) ? h : min;
  }

  function isMultiCart(carts) {
    return (carts || []).length > 1;
  }

  function ensureEventConfig(state, products) {
    var carts = ensureCarts(state, products);
    var shell = state._shell || {};
    if (!isMultiCart(carts)) {
      state.eventConfigMode = 'same';
    } else if (state.eventConfigMode !== 'custom') {
      state.eventConfigMode = 'same';
    }
    var baseH = defaultHours(state, shell);
    state.hours = baseH;
    carts.forEach(function(cart) {
      var ch = parseInt(cart.hours, 10);
      if (isNaN(ch) || ch < 1) cart.hours = baseH;
      else cart.hours = Math.max(1, Math.min(48, ch));
    });
    return carts;
  }

  function syncAllCartsEvent(state, templateIdx) {
    var idx = templateIdx != null ? templateIdx : 0;
    var src = state.carts && state.carts[idx];
    if (!src) return;
    var h = parseInt(src.hours, 10);
    if (!isNaN(h) && h > 0) state.hours = h;
    state.carts.forEach(function(cart, i) {
      if (i === idx) return;
      cart.hours = src.hours;
      cart.baristas = src.baristas;
      cart.extraBaristaMode = src.extraBaristaMode;
      cart.splitHours = src.splitHours;
    });
  }

  function setGlobalBarista1Hours(state, hours) {
    var h = Math.max(1, Math.min(48, parseInt(hours, 10) || 3));
    state.hours = h;
    (state.carts || []).forEach(function(cart) { cart.hours = h; });
  }

  function renderBarista1HoursField(state, opts) {
    opts = opts || {};
    var val = opts.hours != null ? opts.hours : defaultHours(state, state._shell || {});
    var attrs = opts.cartIdx != null
      ? ' data-cart-hours="' + opts.cartIdx + '"'
      : ' data-field="hours"';
    var hint = opts.hint
      ? '<p class="lp-oq-muted" style="font-size:12px;margin:4px 0 0">' + esc(opts.hint) + '</p>' : '';
    return '<label class="lp-oq-field"><span>Barista 1 — event duration (hours)</span>' +
      '<input type="number" min="1" max="48"' + attrs + ' value="' + esc(val) + '"></label>' + hint;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function toIsoDate(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function parseIsoDate(str) {
    var m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  function monthLabel(year, monthIndex) {
    try {
      return new Date(year, monthIndex, 1).toLocaleString('en-AU', { month: 'long', year: 'numeric' });
    } catch (e) {
      return (monthIndex + 1) + '/' + year;
    }
  }

  /**
   * Theme-styled month calendar (replaces native date input for event date).
   * Keeps a hidden input[data-field=eventDate] for existing sync helpers.
   */
  function renderEventCalendar(state, opts) {
    opts = opts || {};
    var selected = (state && state.eventDate) || '';
    var selectedDate = parseIsoDate(selected);
    var view = (state && state._calView) || '';
    var viewDate = parseIsoDate(view + '-01') || selectedDate || new Date();
    var year = viewDate.getFullYear();
    var month = viewDate.getMonth();
    if (state) state._calView = year + '-' + pad2(month + 1);

    var todayIso = toIsoDate(new Date());
    var firstDow = new Date(year, month, 1).getDay(); // 0=Sun
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var prevDays = new Date(year, month, 0).getDate();

    var html = '<div class="lp-oq-cal" data-lp-oq-cal>' +
      '<input type="hidden" data-field="eventDate" value="' + esc(selected) + '">' +
      '<div class="lp-oq-cal-head">' +
      '<span class="lp-oq-cal-label">Event date</span>' +
      (selected
        ? '<span class="lp-oq-cal-selected">' + esc(selectedDate
          ? selectedDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
          : selected) + '</span>'
        : '<span class="lp-oq-cal-selected is-empty">Pick a day</span>') +
      '</div>' +
      '<div class="lp-oq-cal-nav">' +
      '<button type="button" class="lp-oq-cal-nav-btn" data-cal-nav="-1" aria-label="Previous month">‹</button>' +
      '<div class="lp-oq-cal-month" data-cal-month="' + year + '-' + pad2(month + 1) + '">' +
      esc(monthLabel(year, month)) + '</div>' +
      '<button type="button" class="lp-oq-cal-nav-btn" data-cal-nav="1" aria-label="Next month">›</button>' +
      '</div>' +
      '<div class="lp-oq-cal-weekdays" aria-hidden="true">' +
      '<span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>' +
      '</div><div class="lp-oq-cal-grid" role="grid">';

    var cells = [];
    var i;
    for (i = 0; i < firstDow; i++) {
      var pd = prevDays - firstDow + i + 1;
      var pMonth = month === 0 ? 11 : month - 1;
      var pYear = month === 0 ? year - 1 : year;
      cells.push({ day: pd, iso: pYear + '-' + pad2(pMonth + 1) + '-' + pad2(pd), muted: true });
    }
    for (i = 1; i <= daysInMonth; i++) {
      cells.push({ day: i, iso: year + '-' + pad2(month + 1) + '-' + pad2(i), muted: false });
    }
    var nextDay = 1;
    var nMonth = month === 11 ? 0 : month + 1;
    var nYear = month === 11 ? year + 1 : year;
    while (cells.length % 7 !== 0) {
      cells.push({
        day: nextDay,
        iso: nYear + '-' + pad2(nMonth + 1) + '-' + pad2(nextDay),
        muted: true
      });
      nextDay += 1;
    }

    cells.forEach(function(cell) {
      var cls = 'lp-oq-cal-day';
      if (cell.muted) cls += ' is-muted';
      if (cell.iso === selected) cls += ' is-selected';
      if (cell.iso === todayIso) cls += ' is-today';
      html += '<button type="button" class="' + cls + '" data-cal-day="' + esc(cell.iso) + '"' +
        (cell.muted ? ' tabindex="-1"' : '') + '>' + cell.day + '</button>';
    });

    html += '</div>';
    if (opts.hint !== false) {
      html += opts.hint
        ? '<p class="lp-oq-muted lp-oq-cal-hint">' + esc(opts.hint) + '</p>'
        : '<p class="lp-oq-muted lp-oq-cal-hint">When is the event?</p>';
    }
    html += '</div>';
    return html;
  }

  function renderEventDateField(state, opts) {
    return renderEventCalendar(state, opts);
  }

  function wireEventCalendar(root, state, rerender) {
    if (!root || !state) return;
    root.querySelectorAll('[data-lp-oq-cal]').forEach(function(cal) {
      if (cal.__lpOqCalWired) return;
      cal.__lpOqCalWired = true;
      cal.addEventListener('click', function(e) {
        var nav = e.target.closest('[data-cal-nav]');
        if (nav && cal.contains(nav)) {
          e.preventDefault();
          var dir = parseInt(nav.getAttribute('data-cal-nav'), 10) || 0;
          var base = parseIsoDate((state._calView || '') + '-01') || parseIsoDate(state.eventDate) || new Date();
          var next = new Date(base.getFullYear(), base.getMonth() + dir, 1);
          state._calView = next.getFullYear() + '-' + pad2(next.getMonth() + 1);
          if (typeof rerender === 'function') rerender();
          return;
        }
        var day = e.target.closest('[data-cal-day]');
        if (day && cal.contains(day)) {
          e.preventDefault();
          var iso = day.getAttribute('data-cal-day') || '';
          if (!iso) return;
          state.eventDate = iso;
          state._calView = iso.slice(0, 7);
          if (typeof rerender === 'function') rerender();
        }
      });
    });
  }

  /** Split custom fields: compact (left) vs textarea/notes (right). */
  function partitionCustomFields(fields) {
    var left = [];
    var right = [];
    (fields || []).forEach(function(f) {
      if (!f) return;
      if (f.type === 'textarea') right.push(f);
      else left.push(f);
    });
    return { left: left, right: right };
  }

  function syncEventFieldsFromDom(root, state) {
    if (!root || !state) return;
    root.querySelectorAll('[data-field="eventDate"]').forEach(function(inp) {
      state.eventDate = inp.value || '';
    });
    var hoursInp = root.querySelector('[data-field="hours"]');
    if (hoursInp) setGlobalBarista1Hours(state, hoursInp.value);
  }

  function renderEventConfigMode(state, carts) {
    if (!isMultiCart(carts)) return '';
    var mode = state.eventConfigMode === 'custom' ? 'custom' : 'same';
    return '<fieldset class="lp-oq-plan lp-oq-event-config"><legend>Multiple equipment lines</legend>' +
      '<p class="lp-oq-muted" style="margin:0 0 10px">You have more than one equipment line. Use the same event hours and barista setup for each, or configure each line separately.</p>' +
      '<label class="lp-oq-radio"><input type="radio" name="lp-oq-event-config" value="same"' +
      (mode === 'same' ? ' checked' : '') + ' data-event-config="same"> Same hours &amp; staffing for all equipment lines</label>' +
      '<label class="lp-oq-radio"><input type="radio" name="lp-oq-event-config" value="custom"' +
      (mode === 'custom' ? ' checked' : '') + ' data-event-config="custom"> Custom configuration per equipment line</label>' +
      '</fieldset>';
  }

  function renderStaffingRow(state, shell, products, cart, i, opts) {
    opts = opts || {};
    var splitCfg = splitShiftSettings(shell);
    var splitEnabled = splitCfg.enabled !== false;
    var splitRate = Number(splitCfg.hourlyCents) || 10000;
    var splitMin = Math.max(3, Number(splitCfg.minimumHours) || 3);
    var prod = (products || []).find(function(p) { return p.id === cart.productId; }) || {};
    var included = Math.max(1, Number(prod.baristasIncluded) || 1);
    var allowExtra = extraBaristaEnabled(shell) && prod.allowExtraBarista !== false;
    var baristas = cart.baristas != null ? cart.baristas : included;
    var cartLabel = opts.cartLabel || (prod.label || 'Equipment');
    var staffIdx = opts.staffIdx != null ? opts.staffIdx : i;
    var radioSuffix = opts.radioSuffix != null ? opts.radioSuffix : i;
    var simpleHours = state.labourPlanning !== 'shifts';

    var html = '<div class="lp-oq-staff-row" data-staff-idx="' + staffIdx + '">' +
      '<p class="lp-oq-staff-label"><strong>' + esc(cartLabel) + '</strong>' +
      (cart.quantity > 1 ? ' <span class="lp-oq-muted">×' + esc(cart.quantity) + '</span>' : '') + '</p>';

    if (simpleHours && opts.showBarista1Hours) {
      html += renderBarista1HoursField(state, {
        cartIdx: i,
        hours: cart.hours,
        hint: 'Barista 1 works this many hours for this equipment line.'
      });
    }

    html += '<div class="lp-oq-staff-count">';
    for (var n = included; n <= Math.min(included + 1, 4); n++) {
      html += '<label class="lp-oq-radio"><input type="radio" name="lp-oq-baristas-' + radioSuffix + '" value="' + n + '"' +
        (baristas === n ? ' checked' : '') + ' data-staff-field="baristas" data-staff-idx="' + staffIdx + '"> ' +
        n + ' barista' + (n > 1 ? 's' : '') + ' <span class="lp-oq-muted">(Barista 1' + (n > included ? ' + Barista 2' : '') + ')</span></label>';
    }
    html += '</div>';

    if (allowExtra && baristas > included) {
      var mode = cart.extraBaristaMode === 'split' ? 'split' : 'full';
      var b1h = cart.hours != null ? cart.hours : defaultHours(state, shell);
      html += '<div class="lp-oq-extra-mode">';
      html += '<label class="lp-oq-radio"><input type="radio" name="lp-oq-extra-' + radioSuffix + '" value="full"' +
        (mode === 'full' ? ' checked' : '') + ' data-staff-field="extraBaristaMode" data-staff-idx="' + staffIdx + '"> ' +
        'Barista 2 — full shift (' + esc(b1h) + ' hrs, same as Barista 1)</label>';
      if (splitEnabled) {
        html += '<label class="lp-oq-radio"><input type="radio" name="lp-oq-extra-' + radioSuffix + '" value="split"' +
          (mode === 'split' ? ' checked' : '') + ' data-staff-field="extraBaristaMode" data-staff-idx="' + staffIdx + '"> ' +
          'Barista 2 — split shift (peak hours only)</label>';
        if (mode === 'split') {
          var splitH = cart.splitHours || splitCfg.defaultHours || 4;
          html += '<label class="lp-oq-field"><span>Barista 2 — peak hours (hours)</span>' +
            '<input type="number" min="3" max="12" data-staff-field="splitHours" data-staff-idx="' + staffIdx + '" value="' + esc(splitH) + '"></label>' +
            '<p class="lp-oq-muted" style="font-size:12px;margin:4px 0 0">Barista 1 works ' + esc(b1h) + ' hrs; Barista 2 covers the busy period for ' + esc(splitH) + ' hrs. Billed at $' +
            (splitRate / 100).toFixed(0) + '/hr (min ' + splitMin + ' hrs).</p>';
        }
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function normalizeCartStaff(cart, product, shell) {
    var included = Math.max(1, Number(product && product.baristasIncluded) || 1);
    var baristas = parseInt(cart.baristas != null ? cart.baristas : (cart.baristaCount != null ? cart.baristaCount : included), 10);
    if (isNaN(baristas) || baristas < included) {
      baristas = included + (parseInt(cart.extraBaristas, 10) || 0);
    }
    if (isNaN(baristas) || baristas < included) baristas = included;
    baristas = Math.min(4, baristas);

    var mode = String(cart.extraBaristaMode || 'none');
    if (baristas <= included) mode = 'none';
    else if (mode !== 'split' && mode !== 'full') mode = 'full';

    var splitCfg = splitShiftSettings(shell);
    var splitHours = Math.max(3, Math.min(12, parseInt(cart.splitHours, 10) || Number(splitCfg.defaultHours) || 4));

    cart.baristas = baristas;
    cart.extraBaristaMode = mode;
    cart.splitHours = splitHours;
    cart.extraBaristas = Math.max(0, baristas - included);
    return cart;
  }

  function productMaxQty(product) {
    if (!product || !product.allowQuantity) return 1;
    var n = parseInt(product.maxQuantity, 10);
    return (!isNaN(n) && n > 0) ? n : 20;
  }

  function clampCartQuantity(cart, product) {
    if (!cart || !product) return;
    var maxQ = productMaxQty(product);
    var q = parseInt(cart.quantity, 10) || 1;
    cart.quantity = Math.max(1, Math.min(maxQ, q));
  }

  function ensureCarts(state, products) {
    products = products || [];
    if (!Array.isArray(state.carts)) state.carts = [];
    if (!state.carts.length && state.productId) {
      var legacyProd = products.find(function(p) { return p.id === state.productId; });
      state.carts.push(defaultCartRow(legacyProd || { id: state.productId, baristasIncluded: 1 }));
      if (state.extraBaristas > 0) {
        state.carts[0].baristas = (legacyProd && legacyProd.baristasIncluded || 1) + state.extraBaristas;
        state.carts[0].extraBaristaMode = 'full';
      }
    }
    if (products.length) {
      state.carts = state.carts.filter(function(c) {
        return c && c.productId && products.some(function(p) { return p.id === c.productId; });
      });
      if (!state.carts.length) {
        state.carts.push(defaultCartRow(products[0]));
      }
    }
    state.carts.forEach(function(cart) {
      var prod = products.find(function(p) { return p.id === cart.productId; }) || products[0];
      normalizeCartStaff(cart, prod, state._shell || {});
      if (prod) clampCartQuantity(cart, prod);
    });
    state.productId = state.carts[0] ? state.carts[0].productId : '';
    return state.carts;
  }

  function ensureShifts(state) {
    if (!Array.isArray(state.shifts) || !state.shifts.length) {
      state.shifts = [defaultShift()];
    }
    state.shifts.forEach(function(sh) {
      if (!sh.id) sh.id = uid();
    });
    return state.shifts;
  }

  function renderLabourPlanning(state, shell, products) {
    state._shell = shell;
    var carts = products ? ensureEventConfig(state, products) : [];
    var multi = isMultiCart(carts);
    var custom = multi && state.eventConfigMode === 'custom';
    var configBlock = multi ? renderEventConfigMode(state, carts) : '';

    if (!allowsShiftPlanner(shell)) {
      return configBlock +
        renderEventDateField(state) +
        (state.labourPlanning !== 'shifts' && !custom
          ? renderBarista1HoursField(state, { hint: 'How long Barista 1 is on site for this event.' })
          : '<label class="lp-oq-field"><span>Event duration (hours)</span>' +
            '<input type="number" min="1" max="48" data-field="hours" value="' + esc(state.hours != null ? state.hours : 3) + '"></label>');
    }
    var mode = state.labourPlanning === 'shifts' ? 'shifts' : 'hours';
    var html = configBlock + '<fieldset class="lp-oq-plan"><legend>Event scheduling</legend>' +
      '<label class="lp-oq-radio"><input type="radio" name="lp-oq-labour" value="hours"' + (mode === 'hours' ? ' checked' : '') + '> Simple hours</label>' +
      '<label class="lp-oq-radio"><input type="radio" name="lp-oq-labour" value="shifts"' + (mode === 'shifts' ? ' checked' : '') + '> Multi-day shift planner</label>';
    if (mode === 'hours') {
      html += renderEventDateField(state);
      if (!custom) {
        html += renderBarista1HoursField(state, {
          hint: multi
            ? 'Barista 1 works this many hours on every equipment line (unless you choose custom per line below).'
            : 'How long Barista 1 is on site. If you add Barista 2 on full shift, they work the same hours.'
        });
      } else {
        html += '<p class="lp-oq-muted" style="margin:8px 0 0">Set Barista 1 hours and staffing for each equipment line below.</p>';
      }
    } else {
      ensureShifts(state);
      html += '<p class="lp-oq-muted" style="margin:8px 0 0">Barista 1 is scheduled for each day below. Configure baristas per equipment line in the staffing section.</p>' +
        '<div class="lp-oq-shifts" data-lp-oq-shifts>';
      state.shifts.forEach(function(sh, i) {
        html += '<div class="lp-oq-shift" data-shift-idx="' + i + '">' +
          '<label class="lp-oq-field"><span>Day ' + (i + 1) + ' date</span><input type="date" data-shift-field="date" value="' + esc(sh.date || '') + '"></label>' +
          '<label class="lp-oq-field"><span>Start</span><input type="time" data-shift-field="startTime" value="' + esc(sh.startTime || '09:00') + '"></label>' +
          '<label class="lp-oq-field"><span>End</span><input type="time" data-shift-field="endTime" value="' + esc(sh.endTime || '17:00') + '"></label>' +
          (state.shifts.length > 1 ? '<button type="button" class="lp-oq-btn lp-oq-btn-ghost lp-oq-shift-remove" data-shift-remove="' + i + '">Remove day</button>' : '') +
          '</div>';
      });
      html += '<button type="button" class="lp-oq-btn lp-oq-btn-ghost" data-shift-add>+ Add day</button></div>';
    }
    html += '</fieldset>';
    return html;
  }

  function renderStaffing(state, shell, products) {
    state._shell = shell;
    var carts = ensureEventConfig(state, products);
    if (!carts.length) return '';

    var multi = isMultiCart(carts);
    var custom = multi && state.eventConfigMode === 'custom';
    var html = '<fieldset class="lp-oq-plan lp-oq-staffing"><legend>Barista staffing</legend>' +
      '<p class="lp-oq-muted" style="margin:0 0 12px">Barista 1 is included with your equipment. Add Barista 2 if you need cover for the full event or just the busy peak.</p>';

    if (multi && !custom) {
      var cart0 = carts[0];
      html += renderStaffingRow(state, shell, products, cart0, 0, {
        staffIdx: 0,
        radioSuffix: 'all',
        cartLabel: 'All equipment lines',
        showBarista1Hours: false
      });
    } else {
      carts.forEach(function(cart, i) {
        var prod = (products || []).find(function(p) { return p.id === cart.productId; }) || {};
        var cartLabel = multi ? 'Equipment line ' + (i + 1) : (prod.label || 'Equipment');
        if (multi && prod.label) cartLabel += ' — ' + prod.label;
        html += renderStaffingRow(state, shell, products, cart, i, {
          staffIdx: i,
          radioSuffix: i,
          cartLabel: cartLabel,
          showBarista1Hours: custom && state.labourPlanning !== 'shifts'
        });
      });
    }

    html += '</fieldset>';
    return html;
  }

  function pickEquipment(state, shell, products, cartIdx, productId) {
    state._shell = shell;
    ensureCarts(state, products);
    if (!state.carts[cartIdx]) state.carts[cartIdx] = defaultCartRow(products[0]);
    state.carts[cartIdx].productId = productId;
    state.productId = productId;
    var prod = (products || []).find(function(p) { return p.id === productId; });
    normalizeCartStaff(state.carts[cartIdx], prod, shell);
    state.productId = state.carts[cartIdx].productId;
  }

  function renderProductCard(p, cart, cartIdx, helpers, shell) {
    var isSel = cart && cart.productId === p.id;
    var qty = isSel && cart ? (cart.quantity || 1) : 1;
    var D = global.LPQuoteDisplay;
    var qtyHtml = '';
    if (p.allowQuantity) {
      var maxQ = productMaxQty(p);
      var disabled = isSel ? '' : ' aria-disabled="true"';
      qtyHtml =
        '<div class="lp-oq-eq-qty" data-qty-wrap="' + cartIdx + '"' + disabled + '>' +
        '<span class="lp-oq-eq-qty-num" data-product-qty-display="' + cartIdx + '">' + esc(qty) + '</span>' +
        '<div class="lp-oq-eq-qty-btns">' +
        '<button type="button" class="lp-oq-eq-qty-btn" data-qty-delta="1" data-product-qty-btn="' + cartIdx + '" data-val="' + esc(p.id) + '" aria-label="Increase quantity"' + (isSel ? '' : ' tabindex="-1"') + '>▲</button>' +
        '<button type="button" class="lp-oq-eq-qty-btn" data-qty-delta="-1" data-product-qty-btn="' + cartIdx + '" data-val="' + esc(p.id) + '" aria-label="Decrease quantity"' + (isSel ? '' : ' tabindex="-1"') + '>▼</button>' +
        '</div>' +
        '<input type="hidden" min="1" max="' + maxQ + '" data-product-qty="' + cartIdx + '" data-val="' + esc(p.id) + '" value="' + esc(qty) + '">' +
        '</div>';
    }
    var inner = (D && D.equipmentCardHtml)
      ? D.equipmentCardHtml(p, helpers || { esc: esc }, { qtyHtml: qtyHtml })
      : '<div class="fp-body"><div class="fp-title-row"><h3 class="fp-title">' + esc(p.label) + '</h3>' + qtyHtml + '</div></div>';
    return '<div class="fp-card lp-oq-eq-card' + (isSel ? ' is-selected' : '') + '" role="button" tabindex="0"' +
      ' data-equipment-pick="' + cartIdx + '" data-val="' + esc(p.id) + '" data-product-card="' + esc(p.id) + '">' +
      inner + '</div>';
  }

  function renderCartRows(state, shell, products, helpers) {
    state._shell = shell;
    if (!products || !products.length) return '<p class="lp-oq-muted">No equipment configured.</p>';
    var h = helpers || {};
    var previewFocus = !!h.previewFocusSingle;
    var displayProducts = previewFocus ? products.slice(0, 1) : products;
    var carts = ensureCarts(state, products);
    // Always attach the equipment grid class so photo cards sit in a row
    // (list layout CSS on the shell still stacks them vertically).
    var gridCls = 'lp-oq-choices fp-grid lp-oq-fp-grid';
    if (previewFocus) gridCls += ' lp-oq-preview-focus-single';
    var D = global.LPQuoteDisplay;
    var cardVars = (D && D.equipmentCardVars) ? D.equipmentCardVars(shell) : '';
    var html = (previewFocus
      ? '<p class="lp-oq-muted oqb-preview-focus-note" style="margin:0 0 10px;font-size:12px">Focus mode — all equipment cards share this styling.</p>'
      : '') +
      '<div class="lp-oq-carts" data-lp-oq-carts' + (cardVars ? ' style="' + cardVars + '"' : '') + '>';

    carts.forEach(function(cart, cartIdx) {
      if (carts.length > 1) {
        html += '<div class="lp-oq-cart" data-cart-idx="' + cartIdx + '">' +
          '<div class="lp-oq-cart-head"><strong>Equipment line ' + (cartIdx + 1) + '</strong>' +
          '<button type="button" class="lp-oq-btn lp-oq-btn-ghost lp-oq-cart-remove" data-cart-remove="' + cartIdx + '">Remove</button></div>';
      }
      html += '<div class="' + gridCls + '">';
      displayProducts.forEach(function(p) {
        html += renderProductCard(p, cart, cartIdx, helpers, shell);
      });
      html += '</div>';
      if (carts.length > 1) html += '</div>';
    });

    if (shell && shell.wizard && shell.wizard.allowMultiCart) {
      html += '<button type="button" class="lp-oq-btn lp-oq-btn-ghost" data-cart-add>+ Add another equipment line</button>';
    }
    html += '</div>';
    return html;
  }

  function renderTravelZoneCard(z, selectedId, helpers) {
    var isSel = selectedId && z && z.id === selectedId;
    var D = global.LPQuoteDisplay;
    var h = helpers || { esc: esc };
    var inner = (D && D.equipmentCardHtml)
      ? D.equipmentCardHtml(z, h, { zoomable: true, placeholderLabel: 'Travel zone' })
      : '<div class="fp-body"><div class="fp-title-row"><h3 class="fp-title">' + esc(z.label) + '</h3></div></div>';
    return '<div class="fp-card lp-oq-eq-card lp-oq-tz-card' + (isSel ? ' is-selected' : '') + '" role="button" tabindex="0"' +
      ' data-travel-pick="' + esc(z.id) + '" data-val="' + esc(z.id) + '">' +
      inner + '</div>';
  }

  function renderTravelZoneRows(state, shell, zones, helpers) {
    if (!zones || !zones.length) return '<p class="lp-oq-muted">No travel zones configured.</p>';
    var D = global.LPQuoteDisplay;
    var cardVars = (D && D.equipmentCardVars)
      ? (D.equipmentCardVars(shell, 'travelCards') || D.equipmentCardVars(shell))
      : '';
    var selected = (state && state.travelZoneId) || '';
    var html = '<div class="lp-oq-carts lp-oq-travel-cards" data-lp-oq-travel' + (cardVars ? ' style="' + cardVars + '"' : '') + '>' +
      '<div class="lp-oq-choices fp-grid lp-oq-fp-grid">';
    zones.forEach(function(z) {
      html += renderTravelZoneCard(z, selected, helpers);
    });
    html += '</div></div>';
    return html;
  }

  function wireTravelZoneRows(root, state, rerender) {
    if (!root) return;
    var D = global.LPQuoteDisplay;
    if (D && D.wireImageZoom) D.wireImageZoom(root);
    if (root.__lpOqTravelWired) return;
    root.__lpOqTravelWired = true;
    root.addEventListener('click', function(e) {
      if (e.target.closest('[data-oq-zoom-src]')) return;
      var card = e.target.closest('[data-travel-pick]');
      if (!card || !root.contains(card)) return;
      e.preventDefault();
      var id = card.getAttribute('data-travel-pick') || card.getAttribute('data-val');
      if (!id) return;
      state.travelZoneId = id;
      if (typeof rerender === 'function') rerender();
    });
    root.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('[data-oq-zoom-src]')) return;
      var card = e.target.closest('[data-travel-pick]');
      if (!card || !root.contains(card)) return;
      e.preventDefault();
      card.click();
    });
  }

  function packageQtyLabel(shell, beverageId) {
    var bev = (shell.beverages || []).find(function(b) { return b.id === beverageId; });
    if (bev && (bev.pricingMode === 'tiered' || (bev.tiers && bev.tiers.length))) {
      return bev.unitLabel || 'Units';
    }
    if (bev && bev.unitLabel) return bev.unitLabel;
    return 'Quantity';
  }

  function packageQtyValue(state) {
    if (state.unitCount != null && state.unitCount !== '') return state.unitCount;
    return state.guestCount != null ? state.guestCount : 50;
  }

  function ensureBeverageLines(state) {
    if (!Array.isArray(state.beverageLines)) state.beverageLines = [];
    if (!state.beverageLines.length && state.beverageId) {
      var q = Math.max(1, Number(packageQtyValue(state)) || 50);
      state.beverageLines = [{ beverageId: state.beverageId, quantity: q }];
    }
    return state.beverageLines;
  }

  function beverageLineQty(state, id) {
    ensureBeverageLines(state);
    var line = state.beverageLines.find(function(l) { return l.beverageId === id; });
    return line ? Math.max(0, Number(line.quantity) || 0) : 0;
  }

  function syncBeverageLegacy(state) {
    var lines = (state.beverageLines || []).filter(function(l) {
      return l && l.beverageId && (Number(l.quantity) || 0) > 0;
    });
    state.beverageLines = lines;
    if (lines.length) {
      state.beverageId = lines[0].beverageId;
      state.guestCount = lines[0].quantity;
      state.unitCount = lines[0].quantity;
    } else {
      state.beverageId = '';
    }
  }

  function findBeverage(state, id) {
    var list = (state && state._bevList) ||
      (state && state._shell && state._shell.beverages) ||
      (state && state._wireShell && state._wireShell.beverages) ||
      [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function beverageMinQty(beverage) {
    var n = parseInt(beverage && beverage.minQuantity, 10);
    return (!isNaN(n) && n > 0) ? Math.min(50000, n) : 0;
  }

  function defaultBeverageStartQty(beverage) {
    var min = beverageMinQty(beverage);
    return min > 0 ? min : 50;
  }

  /**
   * @param {object} [opts]
   * @param {boolean} [opts.fromDelta] stepper change — dropping below min deselects
   */
  function setBeverageLineQty(state, id, qty, opts) {
    opts = opts || {};
    ensureBeverageLines(state);
    var bev = findBeverage(state, id);
    var min = beverageMinQty(bev);
    var cur = beverageLineQty(state, id);
    qty = Math.max(0, Math.min(50000, parseInt(qty, 10) || 0));
    if (qty > 0 && min > 0 && qty < min) {
      if (opts.fromDelta && cur >= min) qty = 0;
      else qty = min;
    }
    var idx = -1;
    for (var i = 0; i < state.beverageLines.length; i++) {
      if (state.beverageLines[i].beverageId === id) { idx = i; break; }
    }
    if (qty <= 0) {
      if (idx >= 0) state.beverageLines.splice(idx, 1);
    } else if (idx >= 0) {
      state.beverageLines[idx].quantity = qty;
    } else {
      state.beverageLines.push({ beverageId: id, quantity: qty });
    }
    syncBeverageLegacy(state);
    return qty;
  }

  function beverageGroupLabel(group) {
    var g = String(group || '').toLowerCase();
    if (g === 'catering') return 'Catering';
    if (g === 'drinks' || g === 'beverage' || g === 'beverages') return 'Drinks';
    if (g === 'other') return 'Other';
    return '';
  }

  function renderBeverageQtyCards(state, shell, beverages, helpers) {
    var list = beverages || [];
    if (!list.length) return '<p class="lp-oq-muted">No packages for this selection.</p>';
    ensureBeverageLines(state);
    state._shell = shell;
    state._bevList = list;
    var h = helpers || {};
    var D = global.LPQuoteDisplay;
    var groups = [];
    var byGroup = {};
    list.forEach(function(b) {
      var g = String(b.group || b.category || '').trim().toLowerCase() || '_default';
      if (!byGroup[g]) {
        byGroup[g] = [];
        groups.push(g);
      }
      byGroup[g].push(b);
    });

    var cardVars = (D && D.equipmentCardVars)
      ? (D.equipmentCardVars(shell, 'packageCards') || D.equipmentCardVars(shell))
      : '';
    /* One shared 2-up grid for every group (Drinks, Catering, …) so a 3rd/4th
       card wraps with the same even gap as the first row. */
    var html = '<div class="lp-oq-bev-wrap" data-lp-oq-beverages' +
      (cardVars ? ' style="' + cardVars + '"' : '') + '>' +
      '<div class="lp-oq-choices lp-oq-bev-grid">';
    groups.forEach(function(g) {
      var heading = beverageGroupLabel(g);
      if (heading) html += '<h4 class="lp-oq-bev-group">' + esc(heading) + '</h4>';
      byGroup[g].forEach(function(b) {
        var qty = beverageLineQty(state, b.id);
        var min = beverageMinQty(b);
        var on = qty > 0 ? ' is-selected' : '';
        var unit = packageQtyLabel(shell, b.id);
        var minHint = min > 0
          ? '<span class="lp-oq-bev-min">Min ' + esc(min) + '</span>'
          : '';
        var visual = (D && D.choiceVisualHtml)
          ? D.choiceVisualHtml(b, { esc: esc, iconHtml: h.iconHtml })
          : ('<strong>' + esc(b.label || '') + '</strong>' +
            (b.description ? '<span>' + esc(b.description) + '</span>' : ''));
        html += '<div class="lp-oq-choice lp-oq-bev-card' + on + '" data-bev-card="' + esc(b.id) + '"' +
          (min > 0 ? ' data-bev-min="' + esc(min) + '"' : '') + '>' +
          '<div class="lp-oq-bev-main">' + visual + '</div>' +
          '<div class="lp-oq-bev-qty-row">' +
          '<span class="lp-oq-bev-unit">' + esc(unit) + (minHint ? ' · ' + minHint : '') + '</span>' +
          '<div class="lp-oq-eq-qty lp-oq-bev-qty" data-bev-qty-wrap="' + esc(b.id) + '">' +
          '<button type="button" class="lp-oq-eq-qty-btn lp-oq-bev-qty-btn" data-bev-qty-delta="-10" data-bev-id="' + esc(b.id) + '" aria-label="Decrease by 10">−10</button>' +
          '<button type="button" class="lp-oq-eq-qty-btn lp-oq-bev-qty-btn" data-bev-qty-delta="-1" data-bev-id="' + esc(b.id) + '" aria-label="Decrease">−</button>' +
          '<input type="number" class="lp-oq-bev-qty-input" min="0" max="50000" data-bev-qty-input="' + esc(b.id) + '" value="' + esc(qty) + '" aria-label="' + esc((b.label || 'Package') + ' quantity') + (min > 0 ? (' (minimum ' + min + ')') : '') + '">' +
          '<button type="button" class="lp-oq-eq-qty-btn lp-oq-bev-qty-btn" data-bev-qty-delta="1" data-bev-id="' + esc(b.id) + '" aria-label="Increase">+</button>' +
          '<button type="button" class="lp-oq-eq-qty-btn lp-oq-bev-qty-btn" data-bev-qty-delta="10" data-bev-id="' + esc(b.id) + '" aria-label="Increase by 10">+10</button>' +
          '</div></div></div>';
      });
    });
    html += '</div></div>';
    return html;
  }

  function syncBeverageQtyFromDom(root, state) {
    if (!root || !state) return;
    root.querySelectorAll('[data-bev-qty-input]').forEach(function(inp) {
      var id = inp.getAttribute('data-bev-qty-input');
      if (!id) return;
      setBeverageLineQty(state, id, inp.value);
    });
  }

  function wireBeverageQty(root, state, rerender) {
    if (!root) return;
    if (root.__lpOqBevWired) return;
    root.__lpOqBevWired = true;
    root.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-bev-qty-delta]');
      if (!btn || !root.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      var id = btn.getAttribute('data-bev-id');
      var delta = parseInt(btn.getAttribute('data-bev-qty-delta'), 10) || 0;
      if (!id || !delta) return;
      var cur = beverageLineQty(state, id);
      var next = cur + delta;
      // From 0, + steppers jump to the package start qty (min or 50)
      if (cur <= 0 && delta > 0) {
        next = defaultBeverageStartQty(findBeverage(state, id));
      }
      setBeverageLineQty(state, id, next, { fromDelta: true });
      if (typeof rerender === 'function') rerender();
    });
    root.addEventListener('change', function(e) {
      var inp = e.target.closest('[data-bev-qty-input]');
      if (!inp || !root.contains(inp)) return;
      e.stopPropagation();
      // Update state only — do not re-render. Re-rendering here destroys the
      // Continue button mid-click (blur→change before click), so Packages→Travel
      // appears to pause, then a second Continue can skip Travel.
      var id = inp.getAttribute('data-bev-qty-input');
      var qty = setBeverageLineQty(state, id, inp.value);
      if (String(inp.value) !== String(qty)) inp.value = qty;
      var card = inp.closest('[data-bev-card]');
      if (card) card.classList.toggle('is-selected', qty > 0);
    });
    root.addEventListener('click', function(e) {
      if (e.target.closest('[data-bev-qty-delta]') || e.target.closest('[data-bev-qty-input]') || e.target.closest('.lp-oq-bev-qty')) return;
      var card = e.target.closest('[data-bev-card]');
      if (!card || !root.contains(card)) return;
      e.preventDefault();
      var id = card.getAttribute('data-bev-card');
      var cur = beverageLineQty(state, id);
      // Tap card: if zero, start at min quantity (or 50); if selected, leave qty
      if (cur <= 0) setBeverageLineQty(state, id, defaultBeverageStartQty(findBeverage(state, id)));
      if (typeof rerender === 'function') rerender();
    });
  }

  /** @deprecated Prefer renderBeverageQtyCards — kept for back-compat */
  function renderPackageQty(state, shell) {
    return renderBeverageQtyCards(state, shell, (shell && shell.beverages) || [], {});
  }

  function wireLabourPlanning(root, state, shell, rerender, products) {
    state._shell = shell;
    if (products) ensureEventConfig(state, products);

    root.querySelectorAll('input[name="lp-oq-event-config"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        state.eventConfigMode = radio.value === 'custom' ? 'custom' : 'same';
        if (state.eventConfigMode === 'custom') syncAllCartsEvent(state, 0);
        rerender();
      });
    });

    root.querySelectorAll('[data-cart-hours]').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var idx = parseInt(inp.getAttribute('data-cart-hours'), 10);
        if (!state.carts[idx]) return;
        var h = Math.max(1, Math.min(48, parseInt(inp.value, 10) || 3));
        state.carts[idx].hours = h;
        if (idx === 0) state.hours = h;
        rerender();
      });
    });

    root.querySelectorAll('input[name="lp-oq-labour"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        state.labourPlanning = radio.value;
        if (state.labourPlanning === 'shifts') ensureShifts(state);
        rerender();
      });
    });
    root.querySelectorAll('[data-field="eventDate"]').forEach(function(inp) {
      inp.addEventListener('change', function() {
        state.eventDate = inp.value || '';
      });
    });
    wireEventCalendar(root, state, rerender);
    root.querySelectorAll('[data-shift-field]').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var row = inp.closest('[data-shift-idx]');
        if (!row) return;
        var idx = parseInt(row.getAttribute('data-shift-idx'), 10);
        ensureShifts(state);
        var key = inp.getAttribute('data-shift-field');
        state.shifts[idx][key] = inp.value;
      });
    });
    var addBtn = root.querySelector('[data-shift-add]');
    if (addBtn) addBtn.addEventListener('click', function() {
      ensureShifts(state);
      state.shifts.push(nextShiftFromPrevious(state.shifts));
      rerender();
    });
    root.querySelectorAll('[data-shift-remove]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.getAttribute('data-shift-remove'), 10);
        ensureShifts(state);
        if (state.shifts.length > 1) state.shifts.splice(idx, 1);
        rerender();
      });
    });
  }

  function applyStaffingChange(state, shell, products, idx, key, rawValue) {
    var carts = state.carts || [];
    var value = key === 'splitHours'
      ? Math.max(3, parseInt(rawValue, 10) || 4)
      : (key === 'baristas' ? parseInt(rawValue, 10) || 1 : rawValue);
    var applyAll = state.eventConfigMode !== 'custom' && isMultiCart(carts);

    function updateCart(cart, cartIdx) {
      var prod = (products || []).find(function(p) { return p.id === cart.productId; }) || {};
      if (key === 'baristas') cart.baristas = value;
      else if (key === 'extraBaristaMode') cart.extraBaristaMode = value;
      else if (key === 'splitHours') cart.splitHours = value;
      normalizeCartStaff(cart, prod, shell);
    }

    if (applyAll) {
      carts.forEach(function(cart, i) { updateCart(cart, i); });
    } else {
      updateCart(carts[idx], idx);
    }
  }

  function wireStaffing(root, state, shell, products, rerender) {
    state._shell = shell;
    ensureEventConfig(state, products);

    root.querySelectorAll('[data-staff-field]').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var idx = parseInt(inp.getAttribute('data-staff-idx'), 10);
        var key = inp.getAttribute('data-staff-field');
        applyStaffingChange(state, shell, products, idx, key, inp.value);
        rerender();
      });
    });
  }

  function wireCartRows(root, state, shell, products, rerender) {
    state._shell = shell;
    ensureCarts(state, products);
    var D = global.LPQuoteDisplay;
    if (D && D.wireImageZoom) D.wireImageZoom(root);

    if (!root.__lpOqCartWired) {
      root.__lpOqCartWired = true;
      root.addEventListener('click', function(e) {
        var qtyBtn = e.target.closest('[data-product-qty-btn]');
        if (qtyBtn && root.contains(qtyBtn)) {
          e.preventDefault();
          e.stopPropagation();
          if (qtyBtn.closest('.lp-oq-eq-qty[aria-disabled="true"]')) return;
          var idx = parseInt(qtyBtn.getAttribute('data-product-qty-btn'), 10);
          var delta = parseInt(qtyBtn.getAttribute('data-qty-delta'), 10) || 0;
          var prods = state._wireProducts || products;
          var sh = state._wireShell || shell;
          ensureCarts(state, prods);
          if (!state.carts[idx]) return;
          var pid = qtyBtn.getAttribute('data-val');
          if (pid && state.carts[idx].productId !== pid) {
            pickEquipment(state, sh, prods, idx, pid);
          }
          var prod = prods.find(function(p) { return p.id === state.carts[idx].productId; }) || {};
          state.carts[idx].quantity = Math.max(1, (parseInt(state.carts[idx].quantity, 10) || 1) + delta);
          clampCartQuantity(state.carts[idx], prod);
          rerender();
          return;
        }
        if (e.target.closest('[data-product-qty]')) return;
        if (e.target.closest('[data-qty-wrap]')) return;
        if (e.target.closest('[data-cart-add]')) return;
        if (e.target.closest('[data-cart-remove]')) return;
        if (e.target.closest('[data-oq-zoom-src]')) return;
        var card = e.target.closest('[data-equipment-pick]');
        if (!card || !root.contains(card)) return;
        e.preventDefault();
        var pickIdx = parseInt(card.getAttribute('data-equipment-pick'), 10);
        var pickPid = card.getAttribute('data-val');
        if (!pickPid || isNaN(pickIdx)) return;
        var pickProds = state._wireProducts || products;
        var pickShell = state._wireShell || shell;
        pickEquipment(state, pickShell, pickProds, pickIdx, pickPid);
        rerender();
      });
      root.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var card = e.target.closest('[data-equipment-pick]');
        if (!card || !root.contains(card)) return;
        e.preventDefault();
        card.click();
      });
      root.addEventListener('change', function(e) {
        var inp = e.target.closest('[data-product-qty]');
        if (!inp || !root.contains(inp)) return;
        e.stopPropagation();
        var idx = parseInt(inp.getAttribute('data-product-qty'), 10);
        var prods = (state._wireProducts) || products;
        ensureCarts(state, prods);
        if (!state.carts[idx]) return;
        var prod = prods.find(function(p) { return p.id === state.carts[idx].productId; }) || {};
        state.carts[idx].quantity = Math.max(1, parseInt(inp.value, 10) || 1);
        clampCartQuantity(state.carts[idx], prod);
        rerender();
      });
    }
    state._wireProducts = products;
    state._wireShell = shell;

    var addCart = root.querySelector('[data-cart-add]');
    if (addCart && !addCart.__lpOqWired) {
      addCart.__lpOqWired = true;
      addCart.addEventListener('click', function(e) {
        e.preventDefault();
        ensureCarts(state, products);
        state.carts.push(defaultCartRow(products[0], state.carts[0]));
        rerender();
      });
    }
    root.querySelectorAll('[data-cart-remove]').forEach(function(btn) {
      if (btn.__lpOqWired) return;
      btn.__lpOqWired = true;
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var idx = parseInt(btn.getAttribute('data-cart-remove'), 10);
        ensureCarts(state, products);
        if (state.carts.length > 1) state.carts.splice(idx, 1);
        state.productId = state.carts[0] ? state.carts[0].productId : '';
        rerender();
      });
    });
  }

  function customFieldsFor(wizard, attachTo) {
    var W = global.LPQuoteWizardLogic;
    if (W && W.customFieldsFor) return W.customFieldsFor(wizard, attachTo);
    return [];
  }

  function renderCustomFieldsHtml(fields, answers, opts) {
    opts = opts || {};
    var attr = opts.attr || 'data-custom-field';
    var escFn = opts.esc || esc;
    answers = answers || {};
    return (fields || []).map(function(f) {
      var val = answers[f.id];
      if (val == null) val = '';
      var req = f.required ? ' <span aria-hidden="true">*</span>' : '';
      var help = f.helpText
        ? '<small class="lp-oq-muted">' + escFn(f.helpText) + '</small>'
        : '';
      var label = '<span>' + escFn(f.label || 'Question') + req + '</span>';
      if (f.type === 'textarea') {
        return '<label class="lp-oq-field lp-oq-field-textarea">' + label +
          '<textarea rows="4" ' + attr + '="' + escFn(f.id) + '" placeholder="' + escFn(f.placeholder || '') + '">' +
          escFn(val) + '</textarea>' + help + '</label>';
      }
      if (f.type === 'checkbox') {
        return '<label class="lp-oq-check lp-oq-field"><input type="checkbox" ' + attr + '="' + escFn(f.id) + '"' +
          (val ? ' checked' : '') + '> <span>' + escFn(f.label || 'Yes') + req + '</span></label>' + help;
      }
      if (f.type === 'select') {
        var optsHtml = '<option value="">' + escFn(f.placeholder || 'Select…') + '</option>' +
          (f.options || []).map(function(o) {
            return '<option value="' + escFn(o) + '"' + (String(val) === String(o) ? ' selected' : '') + '>' +
              escFn(o) + '</option>';
          }).join('');
        return '<label class="lp-oq-field">' + label +
          '<select ' + attr + '="' + escFn(f.id) + '">' + optsHtml + '</select>' + help + '</label>';
      }
      var type = (f.type === 'email' || f.type === 'tel' || f.type === 'number' || f.type === 'date')
        ? f.type
        : 'text';
      return '<label class="lp-oq-field">' + label +
        '<input type="' + type + '" ' + attr + '="' + escFn(f.id) + '" placeholder="' + escFn(f.placeholder || '') +
        '" value="' + escFn(val) + '">' + help + '</label>';
    }).join('');
  }

  function syncCustomAnswersFromDom(root, state, attr) {
    if (!root || !state) return;
    attr = attr || 'data-custom-field';
    if (!state.customAnswers || typeof state.customAnswers !== 'object') state.customAnswers = {};
    root.querySelectorAll('[' + attr + ']').forEach(function(el) {
      var id = el.getAttribute(attr);
      if (!id) return;
      if (el.type === 'checkbox') state.customAnswers[id] = !!el.checked;
      else state.customAnswers[id] = el.value;
    });
  }

  function wireCustomFields(root, state, attr) {
    if (!root || !state) return;
    attr = attr || 'data-custom-field';
    if (!state.customAnswers || typeof state.customAnswers !== 'object') state.customAnswers = {};
    root.querySelectorAll('[' + attr + ']').forEach(function(el) {
      var evt = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, function() {
        var id = el.getAttribute(attr);
        if (!id) return;
        if (el.type === 'checkbox') state.customAnswers[id] = !!el.checked;
        else state.customAnswers[id] = el.value;
      });
    });
  }

  function validateCustomFields(fields, answers) {
    answers = answers || {};
    for (var i = 0; i < (fields || []).length; i++) {
      var f = fields[i];
      if (!f || !f.required) continue;
      var v = answers[f.id];
      if (f.type === 'checkbox') {
        if (!v) return 'Please confirm: ' + (f.label || 'required field');
      } else if (v == null || String(v).trim() === '') {
        return 'Please fill in: ' + (f.label || 'required field');
      }
    }
    return null;
  }

  function progressPayload(state) {
    if (!Array.isArray(state.carts)) state.carts = [];
    ensureBeverageLines(state);
    syncBeverageLegacy(state);
    var p = {
      productId: state.productId,
      hours: state.hours,
      eventDate: state.eventDate || '',
      eventConfigMode: state.eventConfigMode || 'same',
      guestCount: state.guestCount,
      unitCount: state.unitCount,
      beverageId: state.beverageId,
      beverageLines: (state.beverageLines || []).map(function(l) {
        return { beverageId: l.beverageId, quantity: Math.max(0, Number(l.quantity) || 0) };
      }).filter(function(l) { return l.beverageId && l.quantity > 0; }),
      addonIds: state.addonIds,
      travelZoneId: state.travelZoneId,
      labourPlanning: state.labourPlanning || 'hours',
      shifts: state.shifts,
      customAnswers: state.customAnswers && typeof state.customAnswers === 'object'
        ? state.customAnswers
        : {},
      carts: state.carts.map(function(c) {
        return {
          productId: c.productId,
          quantity: c.quantity,
          hours: c.hours,
          baristas: c.baristas,
          extraBaristaMode: c.extraBaristaMode,
          splitHours: c.splitHours,
          extraBaristas: c.extraBaristas
        };
      })
    };
    if (p.labourPlanning !== 'shifts') {
      delete p.shifts;
      if (!p.eventDate) delete p.eventDate;
    } else {
      delete p.eventDate;
      if (Array.isArray(p.shifts)) {
        p.shifts = p.shifts.map(function(sh) {
          return { date: sh.date, startTime: sh.startTime, endTime: sh.endTime };
        });
      }
    }
    if (p.carts && p.carts.length === 1) {
      p.extraBaristas = p.carts[0].extraBaristas;
      p.extraBaristaMode = p.carts[0].extraBaristaMode;
      p.splitHours = p.carts[0].splitHours;
      if (!p.productId) p.productId = p.carts[0].productId;
    }
    return p;
  }

  global.LPQuotePlanning = {
    esc: esc,
    allowsShiftPlanner: allowsShiftPlanner,
    extraBaristaEnabled: extraBaristaEnabled,
    nextShiftFromPrevious: nextShiftFromPrevious,
    pickEquipment: pickEquipment,
    ensureShifts: ensureShifts,
    setGlobalBarista1Hours: setGlobalBarista1Hours,
    renderLabourPlanning: renderLabourPlanning,
    renderEventDateField: renderEventDateField,
    renderEventCalendar: renderEventCalendar,
    wireEventCalendar: wireEventCalendar,
    partitionCustomFields: partitionCustomFields,
    syncEventFieldsFromDom: syncEventFieldsFromDom,
    renderStaffing: renderStaffing,
    renderCartRows: renderCartRows,
    renderPackageQty: renderPackageQty,
    renderBeverageQtyCards: renderBeverageQtyCards,
    wireBeverageQty: wireBeverageQty,
    syncBeverageQtyFromDom: syncBeverageQtyFromDom,
    beverageMinQty: beverageMinQty,
    defaultBeverageStartQty: defaultBeverageStartQty,
    setBeverageLineQty: setBeverageLineQty,
    beverageLineQty: beverageLineQty,
    wireLabourPlanning: wireLabourPlanning,
    wireStaffing: wireStaffing,
    wireCartRows: wireCartRows,
    renderTravelZoneRows: renderTravelZoneRows,
    wireTravelZoneRows: wireTravelZoneRows,
    progressPayload: progressPayload,
    packageQtyLabel: packageQtyLabel,
    customFieldsFor: customFieldsFor,
    renderCustomFieldsHtml: renderCustomFieldsHtml,
    syncCustomAnswersFromDom: syncCustomAnswersFromDom,
    wireCustomFields: wireCustomFields,
    validateCustomFields: validateCustomFields
  };
})(typeof window !== 'undefined' ? window : global);
