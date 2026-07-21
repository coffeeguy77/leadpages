/**
 * Normalize quote config for builder + calculator (server-side).
 * Mirrors assets/lp-quote-builder.js normalizeConfig essentials.
 */

const {
  normalizeCustomFields,
  ensureCustomStepInSteps
} = require('./wizard');

function slugify(text) {
  return String(text || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function normalizeQuoteConfig(raw) {
  const cfg = JSON.parse(JSON.stringify(raw || {}));
  if (!cfg.business) cfg.business = {};
  if (!cfg.wizard) cfg.wizard = {};
  if (!Array.isArray(cfg.wizard.steps) || !cfg.wizard.steps.length) {
    cfg.wizard.steps = ['equipment', 'beverages', 'addons', 'contact'];
  }
  if (!cfg.wizard.layout) cfg.wizard.layout = 'cards';
  if (!cfg.wizard.stepLabels) cfg.wizard.stepLabels = {};
  if (!Array.isArray(cfg.wizard.conditions)) cfg.wizard.conditions = [];
  if (!cfg.wizard.equipmentCards) cfg.wizard.equipmentCards = {};
  if (!cfg.wizard.travelCards) cfg.wizard.travelCards = {};
  if (!cfg.wizard.packageCards) cfg.wizard.packageCards = {};
  if (!cfg.wizard.ui) cfg.wizard.ui = {};
  if (cfg.wizard.allowMultiCart == null) cfg.wizard.allowMultiCart = false;
  cfg.wizard.customFields = normalizeCustomFields(cfg.wizard.customFields);
  cfg.wizard.steps = ensureCustomStepInSteps(cfg.wizard.steps, cfg.wizard.customFields);
  cfg.products = Array.isArray(cfg.products) ? cfg.products : [];
  cfg.beverages = Array.isArray(cfg.beverages) ? cfg.beverages : [];
  cfg.addons = Array.isArray(cfg.addons) ? cfg.addons : [];
  if (!cfg.labour) cfg.labour = { label: 'Labour', hourlyCents: 7500, minimumHours: 3 };
  if (cfg.labour.allowShiftPlanner == null) cfg.labour.allowShiftPlanner = true;
  if (cfg.labour.minimumHoursPerShift == null) {
    cfg.labour.minimumHoursPerShift = cfg.labour.minimumHours || 3;
  }
  if (!cfg.labour.extraBarista) {
    cfg.labour.extraBarista = {
      enabled: true,
      label: 'Additional barista',
      hourlyCents: cfg.labour.hourlyCents || 7500
    };
  }
  if (!cfg.labour.extraBarista.splitShift) {
    cfg.labour.extraBarista.splitShift = {
      enabled: true,
      label: 'Split-shift barista (peak)',
      hourlyCents: 10000,
      minimumHours: 3,
      defaultHours: 4
    };
  }
  if (!cfg.travel) cfg.travel = { zones: [] };
  if (!Array.isArray(cfg.travel.zones)) cfg.travel.zones = [];
  if (!cfg.rules) cfg.rules = { gstRate: 0.1, quoteValidityDays: 14, minimumNoticeDays: 3 };

  cfg.products.forEach(function(p) {
    if (!p.id) p.id = slugify(p.label) || 'product';
    if (!p.type) p.type = 'equipment';
    if (p.baristasIncluded == null) p.baristasIncluded = 1;
    if (p.allowExtraBarista == null) p.allowExtraBarista = true;
    if (p.allowQuantity == null) p.allowQuantity = false;
    if (p.maxQuantity != null) {
      var mq = parseInt(p.maxQuantity, 10);
      p.maxQuantity = (!isNaN(mq) && mq > 0) ? mq : null;
    }
    if (p.badge == null) p.badge = '';
    if (p.subtitle == null) p.subtitle = '';
    if (!p.imageFit) p.imageFit = 'cover';
    if (!p.imagePos) p.imagePos = 'center';
    if (p.imageAxis !== 'height' && p.imageAxis !== 'width' && p.imageAxis !== 'frame') p.imageAxis = 'frame';
    if (p.imageScale == null) p.imageScale = 100;
  });
  cfg.beverages.forEach(function(b) {
    if (!b.id) b.id = slugify(b.label) || 'bev';
    if (!b.pricingMode) {
      b.pricingMode = (b.tiers && b.tiers.length) ? 'tiered'
        : (b.packageCents && !b.perHeadCents ? 'flat' : 'per_head');
    }
    if (!Array.isArray(b.tiers)) b.tiers = [];
    if (b.group == null && b.category) b.group = b.category;
    if (b.group == null) b.group = '';
    if (b.minQuantity != null && b.minQuantity !== '') {
      var bmin = parseInt(b.minQuantity, 10);
      b.minQuantity = (!isNaN(bmin) && bmin > 0) ? Math.min(50000, bmin) : null;
    } else {
      b.minQuantity = null;
    }
  });
  cfg.addons.forEach(function(a) { if (!a.id) a.id = slugify(a.label) || 'addon'; });
  cfg.travel.zones.forEach(function(z) {
    if (!z.id) z.id = slugify(z.label) || 'zone';
    if (z.badge == null) z.badge = '';
    if (z.subtitle == null) z.subtitle = '';
    if (z.description == null) z.description = '';
    if (!z.imageFit) z.imageFit = 'cover';
    if (!z.imagePos) z.imagePos = 'center';
    if (z.imageAxis !== 'height' && z.imageAxis !== 'width' && z.imageAxis !== 'frame') z.imageAxis = 'frame';
    if (z.imageScale == null) z.imageScale = 100;
    if (!z.displayMode) z.displayMode = z.imageUrl ? 'image' : (z.icon ? 'icon' : 'text');
  });

  return cfg;
}

module.exports = { normalizeQuoteConfig, slugify };
