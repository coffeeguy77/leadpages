/**
 * Online Quote System — server-side pricing engine (integer cents).
 * All monetary math happens here; never trust client-submitted totals.
 */

const { GST_RATE } = require('./constants');
const {
  findById,
  normalizeCarts,
  resolveTierRate,
  beveragePricingMode,
  packageQuantity,
  eventBillableHours,
  splitShiftBillableHours,
  cartStaffCounts
} = require('./pricing');

function lineItem(label, quantity, unitCents, meta) {
  const qty = Math.max(0, Number(quantity) || 0);
  const unit = Math.max(0, Math.round(Number(unitCents) || 0));
  const totalCents = Math.round(qty * unit);
  return Object.assign({
    label,
    quantity: qty,
    unitCents: unit,
    totalCents
  }, meta || {});
}

function addBeverageLines(breakdown, beverage, inp) {
  const qty = packageQuantity(inp);
  if (!beverage || qty <= 0) return;

  const included = Math.max(0, Number(beverage.includedHeads) || 0);
  const billableQty = Math.max(0, qty - included);
  const mode = beveragePricingMode(beverage);
  const unitLabel = beverage.unitLabel || 'units';

  if (mode === 'tiered' && billableQty > 0) {
    const rate = resolveTierRate(beverage.tiers, qty);
    if (rate > 0) {
      breakdown.push(lineItem(beverage.label, billableQty, rate, {
        id: beverage.id,
        kind: 'beverage',
        pricingMode: 'tiered',
        unitCount: qty,
        billableQty,
        unitLabel,
        tierRateCents: rate
      }));
    }
    return;
  }

  const perHead = Math.round(Number(beverage.perHeadCents) || 0);
  if (billableQty > 0 && perHead > 0) {
    breakdown.push(lineItem(beverage.label, billableQty, perHead, {
      id: beverage.id,
      kind: 'beverage',
      pricingMode: 'per_head',
      guestCount: qty,
      includedHeads: included
    }));
    return;
  }

  if (qty > 0 && (beverage.packageCents || 0) > 0) {
    breakdown.push(lineItem(beverage.label, 1, beverage.packageCents, {
      id: beverage.id,
      kind: 'beverage',
      pricingMode: 'flat',
      unitCount: qty
    }));
  }
}

function addLabourLines(breakdown, labour, inp, carts, products) {
  const hourlyCents = Math.round(Number(labour.hourlyCents) || 0);
  if (hourlyCents <= 0) return;

  const eventHours = eventBillableHours(inp, labour);
  const extraCfg = labour.extraBarista || {};
  const extraHourly = Math.round(Number(extraCfg.hourlyCents) || hourlyCents);
  const extraLabel = extraCfg.label || 'Additional barista';
  const splitCfg = extraCfg.splitShift || {};
  const splitHourly = Math.round(Number(splitCfg.hourlyCents) || 10000);
  const splitLabel = splitCfg.label || 'Split-shift barista (peak)';

  if (!carts.length) {
    breakdown.push(lineItem(labour.label || 'Labour', eventHours, hourlyCents, {
      id: 'labour',
      kind: 'labour',
      minimumHours: labour.minimumHours || 3,
      labourPlanning: inp.labourPlanning || labour.planningMode || 'hours'
    }));
    return;
  }

  var labourLines = [];
  carts.forEach(function(cart) {
    var product = findById(products, cart.productId);
    var staff = cartStaffCounts(cart, product);
    var prodLabel = product ? product.label : cart.productId;
    var cartSuffix = carts.length > 1 ? ' — ' + prodLabel : '';

    if (staff.baseStaff > 0) {
      labourLines.push({
        label: (labour.label || 'Labour') + cartSuffix,
        quantity: eventHours * staff.baseStaff,
        unitCents: hourlyCents,
        meta: {
          id: carts.length === 1 && staff.extraStaff === 0 ? 'labour' : 'labour-' + cart.productId,
          kind: 'labour',
          productId: cart.productId,
          staffCount: staff.baseStaff,
          eventHours,
          baristaRole: 'base'
        }
      });
    }

    if (staff.extraStaff > 0 && extraCfg.enabled !== false) {
      var mode = cart.extraBaristaMode === 'split' ? 'split' : 'full';
      if (mode === 'split' && splitCfg.enabled !== false) {
        var splitHours = splitShiftBillableHours(inp, labour, cart.splitHours);
        labourLines.push({
          label: splitLabel + cartSuffix,
          quantity: splitHours * staff.extraStaff,
          unitCents: splitHourly,
          meta: {
            id: 'split-barista-' + cart.productId,
            kind: 'labour',
            productId: cart.productId,
            staffCount: staff.extraStaff,
            splitHours: cart.splitHours,
            extraBarista: true,
            extraBaristaMode: 'split'
          }
        });
      } else {
        labourLines.push({
          label: extraLabel + cartSuffix,
          quantity: eventHours * staff.extraStaff,
          unitCents: extraHourly,
          meta: {
            id: 'extra-barista-' + cart.productId,
            kind: 'labour',
            productId: cart.productId,
            staffCount: staff.extraStaff,
            eventHours,
            extraBarista: true,
            extraBaristaMode: 'full'
          }
        });
      }
    }
  });

  if (!labourLines.length) {
    breakdown.push(lineItem(labour.label || 'Labour', eventHours, hourlyCents, { id: 'labour', kind: 'labour' }));
    return;
  }

  labourLines.forEach(function(row) {
    breakdown.push(lineItem(row.label, row.quantity, row.unitCents, row.meta));
  });
}

/**
 * @param {object} config  Active quote_system_config_versions.config
 * @param {object} inputs  Visitor selections from wizard progress
 * @returns {{ breakdown, subtotalCents, gstCents, totalCents, inputs }}
 */
function calculateQuote(config, inputs) {
  const cfg = config || {};
  const inp = inputs || {};
  const breakdown = [];
  const labour = cfg.labour || {};
  const products = cfg.products || [];
  const carts = normalizeCarts(inp, products);

  carts.forEach(function(cart) {
    const product = findById(products, cart.productId);
    if (!product) return;
    const qty = Math.max(1, Number(cart.quantity) || 1);
    const unit = Math.round(Number(product.baseCents) || 0);
    breakdown.push(lineItem(product.label, qty, unit, {
      id: product.id,
      kind: 'equipment',
      quantity: qty
    }));
  });

  addLabourLines(breakdown, labour, inp, carts, products);

  const beverageId = String(inp.beverageId || '').trim();
  const beverage = beverageId ? findById(cfg.beverages, beverageId) : null;
  addBeverageLines(breakdown, beverage, inp);

  const addonIds = Array.isArray(inp.addonIds) ? inp.addonIds : [];
  addonIds.forEach(function(aid) {
    const addon = findById(cfg.addons, aid);
    if (!addon) return;
    const pricing = addon.pricing || 'fixed';
    if (pricing === 'hourly') {
      const eventHours = eventBillableHours(inp, labour);
      const minH = Math.max(1, Number(addon.minimumHours) || Number(labour.minimumHours) || 3);
      const billH = Math.max(minH, eventHours);
      breakdown.push(lineItem(addon.label, billH, addon.hourlyCents || labour.hourlyCents || 0, {
        id: addon.id,
        kind: 'addon',
        pricing: 'hourly'
      }));
    } else {
      breakdown.push(lineItem(addon.label, 1, addon.fixedCents || 0, {
        id: addon.id,
        kind: 'addon',
        pricing: 'fixed'
      }));
    }
  });

  const travel = cfg.travel || {};
  const zoneId = String(inp.travelZoneId || '').trim();
  const zone = zoneId ? findById(travel.zones, zoneId) : null;
  if (zone && (zone.feeCents || 0) > 0) {
    breakdown.push(lineItem(zone.label || 'Travel fee', 1, zone.feeCents, {
      id: zone.id,
      kind: 'travel'
    }));
  }

  const subtotalCents = breakdown.reduce(function(sum, row) {
    return sum + (row.totalCents || 0);
  }, 0);

  const gstRegistered = cfg.business && cfg.business.gstRegistered !== false;
  const gstCents = gstRegistered ? Math.round(subtotalCents * GST_RATE) : 0;
  const totalCents = subtotalCents + gstCents;

  const normalized = Object.assign({}, inp, {
    guestCount: packageQuantity(inp),
    hours: eventBillableHours(inp, labour),
    carts: carts.length ? carts : undefined
  });

  return {
    breakdown,
    subtotalCents,
    gstCents,
    totalCents,
    inputs: normalized
  };
}

module.exports = { calculateQuote, lineItem, findById };
