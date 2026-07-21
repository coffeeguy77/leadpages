/**
 * Live frontend Travel Zone step must paint after Packages (no hang/skip).
 *
 * Regression: travel render used bare `global.LPQuotePlanning` inside a strict
 * IIFE with no `global` binding → ReferenceError → UI stuck on Packages while
 * state.step already advanced; second Continue jumped to Add-ons and skipped Travel.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const onlineSrc = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
const planningSrc = fs.readFileSync(path.join(root, 'assets/lp-quote-planning.js'), 'utf8');
const displaySrc = fs.readFileSync(path.join(root, 'assets/lp-quote-display.js'), 'utf8');
const logicSrc = fs.readFileSync(path.join(root, 'assets/lp-quote-wizard-logic.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');

function makeEl() {
  const listeners = [];
  const el = {
    innerHTML: '',
    style: {},
    attributes: { 'data-slug': 'beanculture' },
    getAttribute: function(name) {
      return this.attributes[name] || null;
    },
    setAttribute: function(name, value) {
      this.attributes[name] = String(value);
    },
    querySelectorAll: function() { return []; },
    querySelector: function() { return null; },
    addEventListener: function(type, fn) { listeners.push([type, fn]); },
    closest: function() { return null; }
  };
  return el;
}

function loadLiveWizardSandbox() {
  // Simulate browser: window exists, Node `global` is NOT visible to scripts.
  const windowObj = {
    document: {
      readyState: 'complete',
      createElement: function() {
        return {
          style: {},
          appendChild: function() {},
          setAttribute: function() {},
          addEventListener: function() {}
        };
      },
      head: { appendChild: function() {} },
      body: {},
      getElementById: function() { return null; },
      addEventListener: function() {}
    },
    addEventListener: function() {},
    LP_ICONS: {},
    console: console
  };
  windowObj.window = windowObj;

  const sandbox = {
    window: windowObj,
    document: windowObj.document,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    fetch: function() {
      return Promise.reject(new Error('no fetch in test'));
    }
    // intentionally NO `global` — mirrors browser strict IIFE scope
  };
  sandbox.self = windowObj;
  vm.createContext(sandbox);

  vm.runInContext(logicSrc, sandbox);
  vm.runInContext(displaySrc, sandbox);
  vm.runInContext(planningSrc, sandbox);
  vm.runInContext(onlineSrc, sandbox);

  assert.equal(typeof sandbox.global, 'undefined', 'sandbox must not define global');
  assert.ok(sandbox.window.LPQuotePlanning, 'planning mounted on window');
  assert.ok(sandbox.window.LPOnlineQuoteWidget, 'widget exported for tests');
  return sandbox;
}

function coffeeVanShell() {
  return {
    business: { name: 'Bean Culture' },
    products: [{ id: 'coffee-van', label: 'Coffee van', showWhen: null }],
    beverages: [
      { id: 'pkg-classic', label: 'Classic', showWhen: null, unitMode: 'guests' }
    ],
    addons: [{ id: 'addon-cups', label: 'Cups', showWhen: null }],
    travelZones: [
      { id: 'inner', label: 'Inner metro', feeCents: 0 },
      { id: 'outer', label: 'Outer metro', feeCents: 5000 }
    ],
    wizard: {
      steps: ['equipment', 'event', 'beverages', 'travel', 'addons', 'contact'],
      stepLabels: {
        equipment: 'Equipment',
        event: 'Event',
        beverages: 'Packages',
        travel: 'Travel zone',
        addons: 'Add-ons',
        contact: 'Your details'
      },
      conditions: [],
      layout: 'cards'
    }
  };
}

test('live travel step does not reference bare global (browser-strict safe)', function() {
  assert.doesNotMatch(onlineSrc, /\bglobal\.LPQuotePlanning\b/);
  assert.match(onlineSrc, /key === 'travel'[\s\S]*?this\.planning\(\)/);
  assert.match(onlineSrc, /moveStep render failed; rolled back/);
});

test('Packages → Travel paints travel zones in a strict sandbox without global', function() {
  const sandbox = loadLiveWizardSandbox();
  const Widget = sandbox.window.LPOnlineQuoteWidget;
  const el = makeEl();
  const widget = new Widget(el);
  widget.shell = coffeeVanShell();
  widget.state.productId = 'coffee-van';
  widget.state.eventDate = '2026-08-01';
  widget.state.beverageLines = [{ beverageId: 'pkg-classic', quantity: 50 }];
  widget.state.beverageId = 'pkg-classic';

  // JSON round-trip avoids cross-realm Array deepEqual quirks from vm.runInContext.
  const steps = JSON.parse(JSON.stringify(widget.resolvedSteps()));
  assert.equal(steps.join(','), 'equipment,event,beverages,travel,addons,contact',
    'travel stays between packages and addons for coffee van');

  widget.state.step = steps.indexOf('beverages');
  widget.render();
  assert.match(el.innerHTML, /Packages|package|quantity|Classic/i);

  // Continue from Packages → Travel (the hang/skip surface)
  widget.moveStep(1);
  const afterPkg = JSON.parse(JSON.stringify(widget.resolvedSteps()));
  assert.equal(afterPkg[widget.state.step], 'travel', 'state lands on travel');
  assert.match(el.innerHTML, /data-travel-pick|Travel zone|Inner metro|Outer metro/i,
    'travel UI must paint on the live frontend');
  assert.doesNotMatch(el.innerHTML, /Optional extras|data-addon=/);

  // Continue Travel → Add-ons (must not have skipped travel)
  widget.moveStep(1);
  const afterTravel = JSON.parse(JSON.stringify(widget.resolvedSteps()));
  assert.equal(afterTravel[widget.state.step], 'addons');
  assert.match(el.innerHTML, /Optional extras|Cups|data-addon=/);
});

test('bare global.LPQuotePlanning still throws in browser-strict scope (documents the bug)', function() {
  assert.throws(function() {
    vm.runInNewContext(`
      'use strict';
      var Pt = global.LPQuotePlanning;
    `, { /* no global */ });
  }, /global is not defined|ReferenceError/);
});

test('wizard keeps travel in resolved steps when zones exist after coffee-van pick', function() {
  const { resolveWizardSteps } = require('../../lib/quote-system/wizard');
  const steps = resolveWizardSteps(
    {
      steps: ['equipment', 'event', 'beverages', 'travel', 'addons', 'contact'],
      conditions: []
    },
    { productId: 'coffee-van' },
    2
  );
  assert.ok(steps.indexOf('travel') >= 0, 'travel present when zones configured');
  assert.ok(steps.indexOf('travel') < steps.indexOf('addons'), 'travel before addons');
});

test('cache bust covers travel frontend fix', function() {
  assert.match(manage, /oq-layout-cal-1/);
  assert.match(render, /lp-online-quote\.js\?v=oq-layout-cal-1/);
});
