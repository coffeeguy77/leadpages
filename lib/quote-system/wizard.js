/**
 * Online Quote System — wizard step resolution and conditional visibility.
 */

const STEP_ALIASES = {
  equipment: 'equipment',
  products: 'equipment',
  beverages: 'beverages',
  packages: 'beverages',
  addons: 'addons',
  travel: 'travel',
  contact: 'contact',
  event: 'event'
};

const STEP_CATALOG = [
  { id: 'equipment', label: 'Equipment / products', icon: 'package' },
  { id: 'event', label: 'Event details', icon: 'calendar' },
  { id: 'beverages', label: 'Packages / per-head', icon: 'users' },
  { id: 'travel', label: 'Travel zone', icon: 'map-pin' },
  { id: 'addons', label: 'Add-ons & extras', icon: 'plus-circle' },
  { id: 'contact', label: 'Contact details', icon: 'mail' }
];

function normalizeStepId(stepId) {
  return STEP_ALIASES[String(stepId || '').trim()] || String(stepId || '').trim();
}

function matchesWhen(when, progress) {
  if (!when || typeof when !== 'object') return true;
  const field = when.field;
  if (!field) return true;
  const actual = (progress || {})[field];
  let values = when.values;
  if (values == null && when.value != null) values = [when.value];
  if (!values || (Array.isArray(values) && !values.length)) return !!actual;
  const list = Array.isArray(values) ? values : [values];
  if (list.indexOf('*') >= 0) return true;
  if (actual == null || actual === '') return false;
  if (Array.isArray(actual)) {
    return actual.some(function(v) { return list.indexOf(v) >= 0; });
  }
  return list.indexOf(actual) >= 0;
}

function stepCondition(wizard, stepId) {
  const conditions = (wizard && wizard.conditions) || [];
  const norm = normalizeStepId(stepId);
  return conditions.find(function(c) {
    return normalizeStepId(c.step) === norm;
  }) || null;
}

function stepVisible(stepId, wizard, progress, travelZoneCount) {
  const norm = normalizeStepId(stepId);
  if (norm === 'contact') return true;
  if (norm === 'travel') {
    const n = travelZoneCount != null
      ? travelZoneCount
      : ((wizard && wizard.travelZones) || []).length;
    if (!n) return false;
  }
  const rule = stepCondition(wizard, norm);
  if (!rule || !rule.when) return true;
  return matchesWhen(rule.when, progress);
}

function normalizeWizardSteps(rawSteps) {
  const out = [];
  (rawSteps || []).forEach(function(s) {
    const id = normalizeStepId(s);
    if (!id) return;
    if (id === 'contact') return;
    if (out.indexOf(id) < 0) out.push(id);
  });
  if (out.indexOf('contact') < 0) out.push('contact');
  else {
    out.splice(out.indexOf('contact'), 1);
    out.push('contact');
  }
  return out;
}

function resolveWizardSteps(wizard, progress, travelZoneCount) {
  const tz = travelZoneCount != null
    ? travelZoneCount
    : ((wizard && wizard.travelZones) || []).length;
  const configured = normalizeWizardSteps((wizard && wizard.steps) || []);
  const resolved = [];
  configured.forEach(function(stepId) {
    if (stepId === 'contact') return;
    if (!stepVisible(stepId, wizard, progress, tz)) return;
    if (resolved.indexOf(stepId) < 0) resolved.push(stepId);
  });
  resolved.push('contact');
  return resolved;
}

function filterByShowWhen(items, progress) {
  return (items || []).filter(function(item) {
    return matchesWhen(item.showWhen, progress);
  });
}

function catalogLabel(stepId) {
  const raw = String(stepId || '').trim();
  const direct = STEP_CATALOG.find(function(s) { return s.id === raw; });
  if (direct) return direct.label;
  const norm = normalizeStepId(stepId);
  const row = STEP_CATALOG.find(function(s) { return s.id === norm; });
  return row ? row.label : stepId;
}

module.exports = {
  STEP_CATALOG,
  STEP_ALIASES,
  normalizeStepId,
  matchesWhen,
  stepVisible,
  normalizeWizardSteps,
  resolveWizardSteps,
  filterByShowWhen,
  catalogLabel
};
