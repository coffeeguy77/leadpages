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

  function defaultCartRow(product) {
    var included = Math.max(1, Number(product && product.baristasIncluded) || 1);
    return {
      productId: product ? product.id : '',
      quantity: 1,
      baristas: included,
      extraBaristaMode: 'none',
      splitHours: Math.max(3, Number(splitShiftSettings({ labour: { extraBarista: {} } }).defaultHours) || 4)
    };
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

  function ensureCarts(state, products) {
    if (!Array.isArray(state.carts)) state.carts = [];
    if (!state.carts.length && state.productId) {
      var legacyProd = (products || []).find(function(p) { return p.id === state.productId; });
      state.carts.push(defaultCartRow(legacyProd || { id: state.productId, baristasIncluded: 1 }));
      if (state.extraBaristas > 0) {
        state.carts[0].baristas = (legacyProd && legacyProd.baristasIncluded || 1) + state.extraBaristas;
        state.carts[0].extraBaristaMode = 'full';
      }
    }
    state.carts = state.carts.filter(function(c) {
      return c && c.productId && (products || []).some(function(p) { return p.id === c.productId; });
    });
    if (!state.carts.length && products && products.length) {
      state.carts.push(defaultCartRow(products[0]));
    }
    state.carts.forEach(function(cart, i) {
      var prod = (products || []).find(function(p) { return p.id === cart.productId; }) || products[0];
      normalizeCartStaff(cart, prod, state._shell || {});
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

  function renderStaffing(state, shell, products) {
    state._shell = shell;
    var carts = ensureCarts(state, products);
    if (!carts.length) return '';

    var splitCfg = splitShiftSettings(shell);
    var splitEnabled = splitCfg.enabled !== false;
    var splitRate = Number(splitCfg.hourlyCents) || 10000;
    var splitMin = Math.max(3, Number(splitCfg.minimumHours) || 3);

    var html = '<fieldset class="lp-oq-plan lp-oq-staffing"><legend>Barista staffing</legend>' +
      '<p class="lp-oq-muted" style="margin:0 0 12px">How many baristas per equipment line? Choose split shift if the second barista only covers the busy morning period.</p>';

    carts.forEach(function(cart, i) {
      var prod = (products || []).find(function(p) { return p.id === cart.productId; }) || {};
      var included = Math.max(1, Number(prod.baristasIncluded) || 1);
      var allowExtra = extraBaristaEnabled(shell) && prod.allowExtraBarista !== false;
      var baristas = cart.baristas != null ? cart.baristas : included;
      var cartLabel = carts.length > 1 ? 'Cart ' + (i + 1) : (prod.label || 'Equipment');
      if (carts.length > 1 && prod.label) cartLabel += ' — ' + prod.label;

      html += '<div class="lp-oq-staff-row" data-staff-idx="' + i + '">' +
        '<p class="lp-oq-staff-label"><strong>' + esc(cartLabel) + '</strong>' +
        (cart.quantity > 1 ? ' <span class="lp-oq-muted">×' + esc(cart.quantity) + '</span>' : '') + '</p>';

      html += '<div class="lp-oq-staff-count">';
      for (var n = included; n <= Math.min(included + 1, 4); n++) {
        html += '<label class="lp-oq-radio"><input type="radio" name="lp-oq-baristas-' + i + '" value="' + n + '"' +
          (baristas === n ? ' checked' : '') + ' data-staff-field="baristas" data-staff-idx="' + i + '"> ' +
          n + ' barista' + (n > 1 ? 's' : '') + '</label>';
      }
      html += '</div>';

      if (allowExtra && baristas > included) {
        var mode = cart.extraBaristaMode === 'split' ? 'split' : 'full';
        html += '<div class="lp-oq-extra-mode">';
        html += '<label class="lp-oq-radio"><input type="radio" name="lp-oq-extra-' + i + '" value="full"' +
          (mode === 'full' ? ' checked' : '') + ' data-staff-field="extraBaristaMode" data-staff-idx="' + i + '"> ' +
          esc(extraBaristaLabel(shell)) + ' — full shift (same hours)</label>';
        if (splitEnabled) {
          html += '<label class="lp-oq-radio"><input type="radio" name="lp-oq-extra-' + i + '" value="split"' +
            (mode === 'split' ? ' checked' : '') + ' data-staff-field="extraBaristaMode" data-staff-idx="' + i + '"> ' +
            esc(splitCfg.label || 'Split-shift barista (peak)') + ' — morning peak only</label>';
          if (mode === 'split') {
            var splitH = cart.splitHours || splitCfg.defaultHours || 4;
            html += '<label class="lp-oq-field"><span>Peak hours per day</span>' +
              '<input type="number" min="3" max="12" data-staff-field="splitHours" data-staff-idx="' + i + '" value="' + esc(splitH) + '"></label>' +
              '<p class="lp-oq-muted" style="font-size:12px;margin:4px 0 0">Billed at $' + (splitRate / 100).toFixed(0) + '/hr (min ' + splitMin + ' hrs/day)</p>';
          }
        }
        html += '</div>';
      }
      html += '</div>';
    });

    html += '</fieldset>';
    return html;
  }

  function renderCartRows(state, shell, products, choiceHtml) {
    state._shell = shell;
    var carts = ensureCarts(state, products);
    var multi = products.length > 1;
    var html = '';
    if (!multi) {
      var p = products[0];
      if (!p) return '<p class="lp-oq-muted">No equipment configured.</p>';
      var sel = state.productId === p.id ? ' is-selected' : '';
      html += '<button type="button" class="lp-oq-choice' + sel + '" data-pick="productId" data-val="' + esc(p.id) + '">' +
        choiceHtml(p) + '</button>';
      var cart = carts[0] || defaultCartRow(p);
      if (p.allowQuantity) {
        html += '<label class="lp-oq-field"><span>Quantity</span>' +
          '<input type="number" min="1" max="20" data-cart-field="quantity" data-cart-idx="0" value="' + esc(cart.quantity || 1) + '"></label>';
      }
      return html;
    }

    html += '<div class="lp-oq-carts" data-lp-oq-carts>';
    carts.forEach(function(cart, i) {
      html += '<div class="lp-oq-cart" data-cart-idx="' + i + '">' +
        '<div class="lp-oq-cart-head"><strong>Cart ' + (i + 1) + '</strong>' +
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

  function wireStaffing(root, state, shell, products, rerender) {
    state._shell = shell;
    ensureCarts(state, products);

    root.querySelectorAll('[data-staff-field]').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var idx = parseInt(inp.getAttribute('data-staff-idx'), 10);
        var key = inp.getAttribute('data-staff-field');
        var prod = products.find(function(p) { return p.id === state.carts[idx].productId; }) || {};
        if (key === 'baristas') {
          state.carts[idx].baristas = parseInt(inp.value, 10) || 1;
        } else if (key === 'extraBaristaMode') {
          state.carts[idx].extraBaristaMode = inp.value;
        } else if (key === 'splitHours') {
          state.carts[idx].splitHours = Math.max(3, parseInt(inp.value, 10) || 4);
        }
        normalizeCartStaff(state.carts[idx], prod, shell);
        rerender();
      });
    });
  }

  function wireCartRows(root, state, shell, products, rerender) {
    state._shell = shell;
    ensureCarts(state, products);
    root.querySelectorAll('[data-cart-pick]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.getAttribute('data-cart-pick'), 10);
        state.carts[idx].productId = btn.getAttribute('data-val');
        var prod = products.find(function(p) { return p.id === state.carts[idx].productId; });
        normalizeCartStaff(state.carts[idx], prod, shell);
        state.productId = state.carts[0] ? state.carts[0].productId : '';
        rerender();
      });
    });
    root.querySelectorAll('[data-cart-field]').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var idx = parseInt(inp.getAttribute('data-cart-idx'), 10);
        var key = inp.getAttribute('data-cart-field');
        ensureCarts(state, products);
        state.carts[idx][key] = parseInt(inp.value, 10) || 1;
        rerender();
      });
    });
    var addCart = root.querySelector('[data-cart-add]');
    if (addCart) addCart.addEventListener('click', function() {
      ensureCarts(state, products);
      var next = products[0];
      state.carts.push(defaultCartRow(next));
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
      carts: state.carts.map(function(c) {
        return {
          productId: c.productId,
          quantity: c.quantity,
          baristas: c.baristas,
          extraBaristaMode: c.extraBaristaMode,
          splitHours: c.splitHours,
          extraBaristas: c.extraBaristas
        };
      })
    };
    if (p.labourPlanning !== 'shifts') delete p.shifts;
    else if (Array.isArray(p.shifts)) {
      p.shifts = p.shifts.map(function(sh) {
        return { date: sh.date, startTime: sh.startTime, endTime: sh.endTime };
      });
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
    ensureCarts: ensureCarts,
    ensureShifts: ensureShifts,
    renderLabourPlanning: renderLabourPlanning,
    renderStaffing: renderStaffing,
    renderCartRows: renderCartRows,
    renderPackageQty: renderPackageQty,
    wireLabourPlanning: wireLabourPlanning,
    wireStaffing: wireStaffing,
    wireCartRows: wireCartRows,
    progressPayload: progressPayload,
    packageQtyLabel: packageQtyLabel
  };
})(typeof window !== 'undefined' ? window : global);
