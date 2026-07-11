/**
 * Online Quote System — pricing helpers (tiers, shifts, carts, staffing).
 */

function findById(list, id) {
  return (list || []).find(function(item) { return item.id === id; }) || null;
}

function parseTimeToMinutes(t) {
  var s = String(t || '').trim();
  var m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  var h = parseInt(m[1], 10);
  var min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function shiftDurationHours(shift) {
  var start = parseTimeToMinutes(shift && shift.startTime);
  var end = parseTimeToMinutes(shift && shift.endTime);
  if (start == null || end == null) return 0;
  var diff = end - start;
  if (diff <= 0) diff += 24 * 60;
  return diff / 60;
}

function billableShiftHours(shifts, minimumPerShift) {
  var min = Math.max(0.5, Number(minimumPerShift) || 3);
  return (shifts || []).reduce(function(sum, sh) {
    var raw = shiftDurationHours(sh);
    if (raw <= 0) return sum;
    return sum + Math.max(min, raw);
  }, 0);
}

function normalizeCarts(inp, products) {
  var carts = Array.isArray(inp.carts) ? inp.carts.filter(function(c) {
    return c && c.productId;
  }) : [];
  if (carts.length) {
    return carts.map(function(c) {
      return {
        productId: String(c.productId).trim(),
        quantity: Math.max(1, parseInt(c.quantity, 10) || 1),
        extraBaristas: Math.max(0, parseInt(c.extraBaristas, 10) || 0)
      };
    });
  }
  var pid = String(inp.productId || inp.equipmentId || '').trim();
  if (!pid) return [];
  return [{
    productId: pid,
    quantity: 1,
    extraBaristas: Math.max(0, parseInt(inp.extraBaristas, 10) || 0)
  }];
}

function resolveTierRate(tiers, qty) {
  var list = (tiers || []).slice().sort(function(a, b) {
    return (Number(b.minQty) || 0) - (Number(a.minQty) || 0);
  });
  var q = Math.max(0, Number(qty) || 0);
  for (var i = 0; i < list.length; i++) {
    if (q >= (Number(list[i].minQty) || 0)) {
      return Math.round(Number(list[i].perUnitCents) || 0);
    }
  }
  return 0;
}

function beveragePricingMode(beverage) {
  if (!beverage) return 'per_head';
  if (beverage.pricingMode === 'tiered' || (beverage.tiers && beverage.tiers.length)) return 'tiered';
  if (beverage.pricingMode === 'flat' || (beverage.packageCents && !beverage.perHeadCents)) return 'flat';
  return 'per_head';
}

function packageQuantity(inp) {
  var n = inp.unitCount != null && inp.unitCount !== '' ? Number(inp.unitCount) : Number(inp.guestCount);
  return Math.max(0, isNaN(n) ? 0 : n);
}

function eventBillableHours(inp, labour) {
  var planning = String(inp.labourPlanning || labour.planningMode || 'hours');
  var allowShifts = labour.allowShiftPlanner !== false && planning === 'shifts';
  var shifts = Array.isArray(inp.shifts) ? inp.shifts : [];
  if (allowShifts && shifts.length) {
    return billableShiftHours(shifts, labour.minimumHoursPerShift || labour.minimumHours || 3);
  }
  var min = Math.max(1, Number(labour.minimumHours) || 3);
  return Math.max(min, Number(inp.hours) || min);
}

function staffCountForCart(cart, product, labour) {
  var included = Math.max(1, Number(product && product.baristasIncluded) || 1);
  var extra = Math.max(0, Number(cart.extraBaristas) || 0);
  if (labour.extraBarista && labour.extraBarista.enabled === false && extra > 0) extra = 0;
  return (included + extra) * Math.max(1, Number(cart.quantity) || 1);
}

module.exports = {
  findById,
  parseTimeToMinutes,
  shiftDurationHours,
  billableShiftHours,
  normalizeCarts,
  resolveTierRate,
  beveragePricingMode,
  packageQuantity,
  eventBillableHours,
  staffCountForCart
};
