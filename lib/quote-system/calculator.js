/**
 * Online Quote System — server-side pricing engine (integer cents).
 * All monetary math happens here; never trust client-submitted totals.
 */

const { GST_RATE } = require('./constants');

function findById(list, id) {
  return (list || []).find(function(item) { return item.id === id; }) || null;
}

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

/**
 * @param {object} config  Active quote_system_config_versions.config
 * @param {object} inputs  Visitor selections from wizard progress
 * @returns {{ breakdown, subtotalCents, gstCents, totalCents, inputs }}
 */
function calculateQuote(config, inputs) {
  const cfg = config || {};
  const inp = inputs || {};
  const breakdown = [];

  const productId = String(inp.productId || inp.equipmentId || '').trim();
  const product = findById(cfg.products, productId);
  if (product) {
    breakdown.push(lineItem(product.label, 1, product.baseCents || 0, {
      id: product.id,
      kind: 'equipment'
    }));
  }

  const labour = cfg.labour || {};
  const minHours = Math.max(1, Number(labour.minimumHours) || 3);
  const hours = Math.max(minHours, Number(inp.hours) || minHours);
  const hourlyCents = Math.round(Number(labour.hourlyCents) || 0);
  if (hourlyCents > 0) {
    breakdown.push(lineItem(labour.label || 'Labour', hours, hourlyCents, {
      id: 'labour',
      kind: 'labour',
      minimumHours: minHours
    }));
  }

  const guestCount = Math.max(0, Number(inp.guestCount) || 0);
  const beverageId = String(inp.beverageId || '').trim();
  const beverage = beverageId ? findById(cfg.beverages, beverageId) : null;
  if (beverage && guestCount > 0) {
    const included = Math.max(0, Number(beverage.includedHeads) || 0);
    const billableHeads = Math.max(0, guestCount - included);
    const perHead = Math.round(Number(beverage.perHeadCents) || 0);
    if (billableHeads > 0 && perHead > 0) {
      breakdown.push(lineItem(beverage.label, billableHeads, perHead, {
        id: beverage.id,
        kind: 'beverage',
        guestCount,
        includedHeads: included
      }));
    } else if (guestCount > 0 && (beverage.packageCents || 0) > 0) {
      breakdown.push(lineItem(beverage.label, 1, beverage.packageCents, {
        id: beverage.id,
        kind: 'beverage',
        guestCount
      }));
    }
  }

  const addonIds = Array.isArray(inp.addonIds) ? inp.addonIds : [];
  addonIds.forEach(function(aid) {
    const addon = findById(cfg.addons, aid);
    if (!addon) return;
    breakdown.push(lineItem(addon.label, 1, addon.fixedCents || 0, {
      id: addon.id,
      kind: 'addon'
    }));
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

  return {
    breakdown,
    subtotalCents,
    gstCents,
    totalCents,
    inputs: Object.assign({}, inp, { hours, guestCount })
  };
}

module.exports = { calculateQuote, lineItem, findById };
