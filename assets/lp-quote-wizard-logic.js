/**
 * Browser shared wizard logic — mirrors lib/quote-system/wizard.js
 */
(function(global) {
  'use strict';

  var STEP_ALIASES = {
    equipment: 'equipment', products: 'equipment', event: 'equipment',
    beverages: 'beverages', packages: 'beverages',
    addons: 'addons', travel: 'travel', contact: 'contact'
  };

  var STEP_CATALOG = [
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

  function resolveWizardSteps(wizard, progress, travelZoneCount) {
    var configured = normalizeWizardSteps((wizard && wizard.steps) || []);
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
    var norm = normalizeStepId(stepId);
    for (var i = 0; i < STEP_CATALOG.length; i++) {
      if (STEP_CATALOG[i].id === norm) return STEP_CATALOG[i].label;
    }
    return stepId;
  }

  global.LPQuoteWizardLogic = {
    STEP_CATALOG: STEP_CATALOG,
    normalizeStepId: normalizeStepId,
    matchesWhen: matchesWhen,
    normalizeWizardSteps: normalizeWizardSteps,
    resolveWizardSteps: resolveWizardSteps,
    filterByShowWhen: filterByShowWhen,
    catalogLabel: catalogLabel,
    stepVisible: stepVisible
  };
})(window);
