/**
 * Browser shared wizard logic — mirrors lib/quote-system/wizard.js
 */
(function(global) {
  'use strict';

  var STEP_ALIASES = {
    equipment: 'equipment', products: 'equipment',
    event: 'event',
    beverages: 'beverages', packages: 'beverages',
    addons: 'addons', travel: 'travel', contact: 'contact',
    custom: 'custom', questions: 'custom'
  };

  var STEP_CATALOG = [
    { id: 'equipment', label: 'Equipment / products', icon: 'package' },
    { id: 'event', label: 'Event details', icon: 'calendar' },
    { id: 'beverages', label: 'Packages / per-head', icon: 'users' },
    { id: 'travel', label: 'Travel zone', icon: 'map-pin' },
    { id: 'addons', label: 'Add-ons & extras', icon: 'plus-circle' },
    { id: 'custom', label: 'Custom questions', icon: 'sparkles' },
    { id: 'contact', label: 'Contact details', icon: 'mail' }
  ];

  var CUSTOM_FIELD_TYPES = ['text', 'textarea', 'email', 'tel', 'number', 'select', 'checkbox', 'date'];
  var CUSTOM_ATTACH_TO = ['custom', 'event', 'contact'];

  function slugifyFieldId(text) {
    return String(text || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'field';
  }

  function normalizeCustomField(raw, index) {
    if (!raw || typeof raw !== 'object') return null;
    var type = CUSTOM_FIELD_TYPES.indexOf(raw.type) >= 0 ? raw.type : 'text';
    var attachTo = CUSTOM_ATTACH_TO.indexOf(raw.attachTo) >= 0 ? raw.attachTo : 'custom';
    var options = [];
    if (Array.isArray(raw.options)) {
      options = raw.options.map(function(o) { return String(o == null ? '' : o).trim(); }).filter(Boolean);
    } else if (typeof raw.options === 'string') {
      options = raw.options.split(/\n|,/).map(function(o) { return o.trim(); }).filter(Boolean);
    }
    var id = String(raw.id || '').trim() || (slugifyFieldId(raw.label) + '-' + (index || 0));
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
    var out = [];
    var seen = {};
    (Array.isArray(list) ? list : []).forEach(function(raw, i) {
      var field = normalizeCustomField(raw, i);
      if (!field) return;
      var id = field.id;
      if (seen[id]) id = id + '-' + i;
      seen[id] = true;
      field.id = id;
      out.push(field);
    });
    return out;
  }

  function customFieldsFor(wizard, attachTo) {
    var target = CUSTOM_ATTACH_TO.indexOf(attachTo) >= 0 ? attachTo : 'custom';
    return normalizeCustomFields(wizard && wizard.customFields).filter(function(f) {
      return f.attachTo === target;
    });
  }

  function normalizeStepId(stepId) {
    return STEP_ALIASES[String(stepId || '').trim()] || String(stepId || '').trim();
  }

  function matchesWhen(when, progress) {
    if (!when || typeof when !== 'object') return true;
    var field = when.field;
    if (!field) return true;
    var actual = (progress || {})[field];
    var values = when.values;
    if (values == null && when.value != null) values = [when.value];
    if (!values || (Array.isArray(values) && !values.length)) return !!actual;
    var list = Array.isArray(values) ? values : [values];
    if (list.indexOf('*') >= 0) return true;
    if (actual == null || actual === '') return false;
    if (Array.isArray(actual)) return actual.some(function(v) { return list.indexOf(v) >= 0; });
    return list.indexOf(actual) >= 0;
  }

  function stepCondition(wizard, stepId) {
    var conditions = (wizard && wizard.conditions) || [];
    var norm = normalizeStepId(stepId);
    for (var i = 0; i < conditions.length; i++) {
      if (normalizeStepId(conditions[i].step) === norm) return conditions[i];
    }
    return null;
  }

  function stepVisible(stepId, wizard, progress, travelZoneCount) {
    var norm = normalizeStepId(stepId);
    if (norm === 'contact') return true;
    if (norm === 'custom') {
      if (!customFieldsFor(wizard, 'custom').length) return false;
    }
    if (norm === 'travel') {
      var n = travelZoneCount != null ? travelZoneCount : ((wizard && wizard.travelZones) || []).length;
      if (!n) return false;
    }
    var rule = stepCondition(wizard, norm);
    if (!rule || !rule.when) return true;
    return matchesWhen(rule.when, progress);
  }

  function normalizeWizardSteps(rawSteps) {
    var out = [];
    (rawSteps || []).forEach(function(s) {
      var id = normalizeStepId(s);
      if (!id || id === 'contact') return;
      if (out.indexOf(id) < 0) out.push(id);
    });
    out.push('contact');
    return out;
  }

  function ensureCustomStepInSteps(steps, customFields) {
    var fields = normalizeCustomFields(customFields);
    var needsCustom = fields.some(function(f) { return f.attachTo === 'custom'; });
    var editable = [];
    (steps || []).forEach(function(s) {
      var id = normalizeStepId(s);
      if (!id || id === 'contact') return;
      if (!needsCustom && id === 'custom') return;
      if (editable.indexOf(id) < 0) editable.push(id);
    });
    if (needsCustom && editable.indexOf('custom') < 0) editable.push('custom');
    editable.push('contact');
    return editable;
  }

  function resolveWizardSteps(wizard, progress, travelZoneCount) {
    var configured = ensureCustomStepInSteps(
      (wizard && wizard.steps) || [],
      (wizard && wizard.customFields) || []
    );
    var resolved = [];
    var tz = travelZoneCount != null ? travelZoneCount : ((wizard && wizard.travelZones) || []).length;
    configured.forEach(function(stepId) {
      if (stepId === 'contact') return;
      if (stepVisible(stepId, wizard, progress, tz) && resolved.indexOf(stepId) < 0) {
        resolved.push(stepId);
      }
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
    var raw = String(stepId || '').trim();
    for (var i = 0; i < STEP_CATALOG.length; i++) {
      if (STEP_CATALOG[i].id === raw) return STEP_CATALOG[i].label;
    }
    var norm = normalizeStepId(stepId);
    for (var j = 0; j < STEP_CATALOG.length; j++) {
      if (STEP_CATALOG[j].id === norm) return STEP_CATALOG[j].label;
    }
    return stepId;
  }

  function stepIndexAfterMove(stepsBefore, currentIndex, delta, stepsAfter) {
    var before = Array.isArray(stepsBefore) ? stepsBefore : [];
    var after = Array.isArray(stepsAfter) ? stepsAfter : before;
    var curIdx = Math.max(0, Math.min(before.length - 1, Number(currentIndex) || 0));
    var curKey = before[curIdx];
    var targetIdx = curIdx + (delta < 0 ? -1 : 1);
    var targetKey = before[targetIdx];

    if (targetKey) {
      var mapped = after.indexOf(targetKey);
      if (mapped >= 0) return mapped;
    }

    var curAfter = after.indexOf(curKey);
    if (curAfter >= 0) {
      if (delta < 0) return Math.max(0, curAfter - 1);
      return Math.min(after.length - 1, curAfter + 1);
    }

    if (delta < 0) return Math.max(0, Math.min(after.length - 1, curIdx - 1));
    return Math.max(0, Math.min(after.length - 1, curIdx + 1));
  }

  global.LPQuoteWizardLogic = {
    STEP_CATALOG: STEP_CATALOG,
    CUSTOM_FIELD_TYPES: CUSTOM_FIELD_TYPES,
    CUSTOM_ATTACH_TO: CUSTOM_ATTACH_TO,
    normalizeStepId: normalizeStepId,
    matchesWhen: matchesWhen,
    normalizeWizardSteps: normalizeWizardSteps,
    ensureCustomStepInSteps: ensureCustomStepInSteps,
    resolveWizardSteps: resolveWizardSteps,
    filterByShowWhen: filterByShowWhen,
    catalogLabel: catalogLabel,
    stepVisible: stepVisible,
    normalizeCustomField: normalizeCustomField,
    normalizeCustomFields: normalizeCustomFields,
    customFieldsFor: customFieldsFor,
    stepIndexAfterMove: stepIndexAfterMove
  };
})(window);
