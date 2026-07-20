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
  event: 'event',
  custom: 'custom',
  questions: 'custom'
};

const STEP_CATALOG = [
  { id: 'equipment', label: 'Equipment / products', icon: 'package' },
  { id: 'event', label: 'Event details', icon: 'calendar' },
  { id: 'beverages', label: 'Packages / per-head', icon: 'users' },
  { id: 'travel', label: 'Travel zone', icon: 'map-pin' },
  { id: 'addons', label: 'Add-ons & extras', icon: 'plus-circle' },
  { id: 'custom', label: 'Custom questions', icon: 'sparkles' },
  { id: 'contact', label: 'Contact details', icon: 'mail' }
];

const CUSTOM_FIELD_TYPES = ['text', 'textarea', 'email', 'tel', 'number', 'select', 'checkbox', 'date'];
const CUSTOM_ATTACH_TO = ['custom', 'event', 'contact'];

function slugifyFieldId(text) {
  return String(text || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'field';
}

function normalizeCustomField(raw, index) {
  if (!raw || typeof raw !== 'object') return null;
  const type = CUSTOM_FIELD_TYPES.indexOf(raw.type) >= 0 ? raw.type : 'text';
  const attachTo = CUSTOM_ATTACH_TO.indexOf(raw.attachTo) >= 0 ? raw.attachTo : 'custom';
  let options = [];
  if (Array.isArray(raw.options)) {
    options = raw.options.map(function(o) { return String(o == null ? '' : o).trim(); }).filter(Boolean);
  } else if (typeof raw.options === 'string') {
    options = raw.options.split(/\n|,/).map(function(o) { return o.trim(); }).filter(Boolean);
  }
  const id = String(raw.id || '').trim() || (slugifyFieldId(raw.label) + '-' + (index || 0));
  return {
    id: id,
    type: type,
    label: String(raw.label || 'Question').trim() || 'Question',
    placeholder: String(raw.placeholder || '').trim(),
    helpText: String(raw.helpText || '').trim(),
    required: !!raw.required,
    options: type === 'select' ? options : [],
    attachTo: attachTo
  };
}

function normalizeCustomFields(list) {
  const out = [];
  const seen = {};
  (Array.isArray(list) ? list : []).forEach(function(raw, i) {
    const field = normalizeCustomField(raw, i);
    if (!field) return;
    let id = field.id;
    if (seen[id]) id = id + '-' + i;
    seen[id] = true;
    field.id = id;
    out.push(field);
  });
  return out;
}

function customFieldsFor(wizard, attachTo) {
  const target = CUSTOM_ATTACH_TO.indexOf(attachTo) >= 0 ? attachTo : 'custom';
  return normalizeCustomFields(wizard && wizard.customFields).filter(function(f) {
    return f.attachTo === target;
  });
}

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
  if (norm === 'custom') {
    if (!customFieldsFor(wizard, 'custom').length) return false;
  }
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

/**
 * Keep contact last. Auto-insert/remove the dedicated Custom questions step
 * when fields are attached to that step.
 */
function ensureCustomStepInSteps(steps, customFields) {
  const fields = normalizeCustomFields(customFields);
  const needsCustom = fields.some(function(f) { return f.attachTo === 'custom'; });
  const editable = [];
  (steps || []).forEach(function(s) {
    const id = normalizeStepId(s);
    if (!id || id === 'contact') return;
    if (!needsCustom && id === 'custom') return;
    if (editable.indexOf(id) < 0) editable.push(id);
  });
  if (needsCustom && editable.indexOf('custom') < 0) editable.push('custom');
  editable.push('contact');
  return editable;
}

function resolveWizardSteps(wizard, progress, travelZoneCount) {
  const tz = travelZoneCount != null
    ? travelZoneCount
    : ((wizard && wizard.travelZones) || []).length;
  const configured = ensureCustomStepInSteps(
    (wizard && wizard.steps) || [],
    (wizard && wizard.customFields) || []
  );
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
  CUSTOM_FIELD_TYPES,
  CUSTOM_ATTACH_TO,
  normalizeStepId,
  matchesWhen,
  stepVisible,
  normalizeWizardSteps,
  ensureCustomStepInSteps,
  resolveWizardSteps,
  filterByShowWhen,
  catalogLabel,
  normalizeCustomField,
  normalizeCustomFields,
  customFieldsFor
};
