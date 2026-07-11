/**
 * LeadPages Online Quote — shared labour planner & multi-cart UI helpers.
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

  function ensureCarts(state, products) {
    if (!Array.isArray(state.carts)) state.carts = [];
    if (!state.carts.length && state.productId) {
      state.carts.push({
        productId: state.productId,
        quantity: 1,
        extraBaristas: state.extraBaristas || 0
      });
    }
    state.carts = state.carts.filter(function(c) {
      return c && c.productId && (products || []).some(function(p) { return p.id === c.productId; });
    });
    if (!state.carts.length && products && products.length) {
      state.carts.push({ productId: products[0].id, quantity: 1, extraBaristas: 0 });
    }
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

  function renderLabourPlanning(state, shell) {
    if (!allowsShiftPlanner(shell)) {
      return '<label class="lp-oq-field"><span>Event duration (hours)</span>' +
        '<input type="number" min="1" max="48" data-field="hours" value="' + esc(state.hours != null ? state.hours : 3) + '"></label>';
    }
    var mode = state.labourPlanning === 'shifts' ? 'shifts' : 'hours';
    var html = '<fieldset class="lp-oq-plan"><legend>Event scheduling</legend>' +
      '<label class="lp-oq-radio"><input type="radio" name="lp-oq-labour" value="hours"' + (mode === 'hours' ? ' checked' : '') + '> Simple hours</label>' +
      '<label class="lp-oq-radio"><input type="radio" name="lp-oq-labour" value="shifts"' + (mode === 'shifts' ? ' checked' : '') + '> Multi-day shift planner</label>';
    if (mode === 'hours') {
      html += '<label class="lp-oq-field"><span>Event duration (hours)</span>' +
        '<input type="number" min="1" max="48" data-field="hours" value="' + esc(state.hours != null ? state.hours : 3) + '"></label>';
    } else {
      ensureShifts(state);
      html += '<div class="lp-oq-shifts" data-lp-oq-shifts>';
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

  function renderCartRows(state, shell, products, choiceHtml) {
    var carts = ensureCarts(state, products);
    var multi = products.length > 1;
    var html = '';
    if (!multi) {
      var p = products[0];
      if (!p) return '<p class="lp-oq-muted">No equipment configured.</p>';
      var sel = state.productId === p.id ? ' is-selected' : '';
      html += '<button type="button" class="lp-oq-choice' + sel + '" data-pick="productId" data-val="' + esc(p.id) + '">' +
        choiceHtml(p) + '</button>';
      var cart = carts[0] || { quantity: 1, extraBaristas: 0 };
      if (p.allowQuantity) {
        html += '<label class="lp-oq-field"><span>Quantity</span>' +
          '<input type="number" min="1" max="20" data-cart-field="quantity" data-cart-idx="0" value="' + esc(cart.quantity || 1) + '"></label>';
      }
      if (extraBaristaEnabled(shell) && p.allowExtraBarista !== false) {
        html += '<label class="lp-oq-check"><input type="checkbox" data-cart-field="extraBaristas" data-cart-idx="0"' +
          (cart.extraBaristas > 0 ? ' checked' : '') + '> ' + esc(extraBaristaLabel(shell)) + '</label>';
      }
      return html;
    }

    html += '<div class="lp-oq-carts" data-lp-oq-carts>';
    carts.forEach(function(cart, i) {
      html += '<div class="lp-oq-cart" data-cart-idx="' + i + '">' +
        '<div class="lp-oq-cart-head"><strong>Equipment ' + (i + 1) + '</strong>' +
        (carts.length > 1 ? '<button type="button" class="lp-oq-btn lp-oq-btn-ghost lp-oq-cart-remove" data-cart-remove="' + i + '">Remove</button>' : '') +
        '</div>';
      products.forEach(function(p) {
        var on = cart.productId === p.id ? ' is-selected' : '';
        html += '<button type="button" class="lp-oq-choice' + on + '" data-cart-pick="' + i + '" data-val="' + esc(p.id) + '">' +
          choiceHtml(p) + '</button>';
      });
      var prod = products.find(function(p) { return p.id === cart.productId; }) || products[0];
      if (prod && prod.allowQuantity !== false) {
        html += '<label class="lp-oq-field"><span>Quantity</span>' +
          '<input type="number" min="1" max="20" data-cart-field="quantity" data-cart-idx="' + i + '" value="' + esc(cart.quantity || 1) + '"></label>';
      }
      if (prod && extraBaristaEnabled(shell) && prod.allowExtraBarista !== false) {
        html += '<label class="lp-oq-check"><input type="checkbox" data-cart-field="extraBaristas" data-cart-idx="' + i + '"' +
          (cart.extraBaristas > 0 ? ' checked' : '') + '> ' + esc(extraBaristaLabel(shell)) + '</label>';
      }
      html += '</div>';
    });
    html += '<button type="button" class="lp-oq-btn lp-oq-btn-ghost" data-cart-add>+ Add equipment</button></div>';
    return html;
  }

  function packageQtyLabel(shell, beverageId) {
    var bev = (shell.beverages || []).find(function(b) { return b.id === beverageId; });
    if (bev && (bev.pricingMode === 'tiered' || (bev.tiers && bev.tiers.length))) {
      return bev.unitLabel || 'Units';
    }
    return 'Expected guests';
  }

  function packageQtyValue(state) {
    if (state.unitCount != null && state.unitCount !== '') return state.unitCount;
    return state.guestCount != null ? state.guestCount : 50;
  }

  function renderPackageQty(state, shell) {
    var field = state.beverageId ? packageQtyLabel(shell, state.beverageId) : 'Expected guests';
    var val = packageQtyValue(state);
    var dataField = (shell.beverages || []).some(function(b) {
      return b.id === state.beverageId && (b.pricingMode === 'tiered' || (b.tiers && b.tiers.length));
    }) ? 'unitCount' : 'guestCount';
    return '<label class="lp-oq-field"><span>' + esc(field) + '</span>' +
      '<input type="number" min="1" max="50000" data-field="' + dataField + '" value="' + esc(val) + '"></label>';
  }

  function wireLabourPlanning(root, state, shell, rerender) {
    root.querySelectorAll('input[name="lp-oq-labour"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        state.labourPlanning = radio.value;
        if (state.labourPlanning === 'shifts') ensureShifts(state);
        rerender();
      });
    });
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
      state.shifts.push(defaultShift());
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

  function wireCartRows(root, state, shell, products, rerender) {
    ensureCarts(state, products);
    root.querySelectorAll('[data-cart-pick]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.getAttribute('data-cart-pick'), 10);
        state.carts[idx].productId = btn.getAttribute('data-val');
        state.productId = state.carts[0] ? state.carts[0].productId : '';
        rerender();
      });
    });
    root.querySelectorAll('[data-cart-field]').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var idx = parseInt(inp.getAttribute('data-cart-idx'), 10);
        var key = inp.getAttribute('data-cart-field');
        ensureCarts(state, products);
        if (key === 'extraBaristas') state.carts[idx][key] = inp.checked ? 1 : 0;
        else state.carts[idx][key] = parseInt(inp.value, 10) || 1;
        rerender();
      });
    });
    var addCart = root.querySelector('[data-cart-add]');
    if (addCart) addCart.addEventListener('click', function() {
      ensureCarts(state, products);
      var next = products[0];
      state.carts.push({ productId: next ? next.id : '', quantity: 1, extraBaristas: 0 });
      rerender();
    });
    root.querySelectorAll('[data-cart-remove]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.getAttribute('data-cart-remove'), 10);
        ensureCarts(state, products);
        if (state.carts.length > 1) state.carts.splice(idx, 1);
        state.productId = state.carts[0] ? state.carts[0].productId : '';
        rerender();
      });
    });
  }

  function progressPayload(state) {
    ensureCarts(state, []);
    var p = {
      productId: state.productId,
      hours: state.hours,
      guestCount: state.guestCount,
      unitCount: state.unitCount,
      beverageId: state.beverageId,
      addonIds: state.addonIds,
      travelZoneId: state.travelZoneId,
      labourPlanning: state.labourPlanning || 'hours',
      shifts: state.shifts,
      carts: state.carts
    };
    if (p.labourPlanning !== 'shifts') delete p.shifts;
    else if (Array.isArray(p.shifts)) {
      p.shifts = p.shifts.map(function(sh) {
        return { date: sh.date, startTime: sh.startTime, endTime: sh.endTime };
      });
    }
    if (p.carts && p.carts.length === 1) {
      p.extraBaristas = p.carts[0].extraBaristas;
      if (!p.productId) p.productId = p.carts[0].productId;
    }
    return p;
  }

  global.LPQuotePlanning = {
    esc: esc,
    allowsShiftPlanner: allowsShiftPlanner,
    extraBaristaEnabled: extraBaristaEnabled,
    ensureCarts: ensureCarts,
    ensureShifts: ensureShifts,
    renderLabourPlanning: renderLabourPlanning,
    renderCartRows: renderCartRows,
    renderPackageQty: renderPackageQty,
    wireLabourPlanning: wireLabourPlanning,
    wireCartRows: wireCartRows,
    progressPayload: progressPayload,
    packageQtyLabel: packageQtyLabel
  };
})(typeof window !== 'undefined' ? window : global);
