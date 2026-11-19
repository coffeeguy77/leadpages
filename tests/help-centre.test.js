/**
 * Customer Help Centre — catalogue, overlay API, Manage wiring, ticket endpoint.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'assets/help/catalogue.json'), 'utf8'));
const js = fs.readFileSync(path.join(root, 'assets/lp-help-centre.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/lp-help-centre.css'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const helpHtml = fs.readFileSync(path.join(root, 'help.html'), 'utf8');
const ticket = fs.readFileSync(path.join(root, 'api/help/ticket.js'), 'utf8');
const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
const featureDoc = fs.readFileSync(path.join(root, 'docs/features/Help Centre.md'), 'utf8');

describe('Help Centre catalogue', () => {
  it('covers core guides and many apps', () => {
    const ids = new Set(catalogue.topics.map((t) => t.id));
    ['getting-started', 'page-editor', 'marketplace', 'publish', 'backups', 'support-ticket', 'hero', 'heroSlider', 'orders', 'bookings'].forEach((id) => {
      assert.ok(ids.has(id), 'missing topic ' + id);
    });
    assert.ok(catalogue.topics.length >= 70, 'expected rich catalogue');
    assert.equal(catalogue.topics.filter((t) => t.kind === 'app').length >= 50, true);
    assert.ok(catalogue.topics.some((t) => t.id === 'journey-publish' && Array.isArray(t.trail)));
    assert.ok(catalogue.topics.some((t) => t.id === 'fix-not-live' && Array.isArray(t.choices)));
    assert.equal(catalogue.version, 2);
  });

  it('documents agent maintenance rule', () => {
    assert.ok(catalogue.agentNotes && catalogue.agentNotes.rule);
    assert.match(agents, /Help Centre rules/);
    assert.match(featureDoc, /Agent rule \(mandatory\)/);
  });
});

describe('Help Centre runtime', () => {
  it('exposes LPHelp.open and ticket UI', () => {
    assert.match(js, /window\.LPHelp/);
    assert.match(js, /function open\(/);
    assert.match(js, /function showMe\(/);
    assert.match(js, /\/api\/help\/ticket/);
    assert.match(js, /lph-mock/);
    assert.match(js, /lph-suggest/);
    assert.match(css, /#lph-root/);
    assert.match(css, /#lph-spot/);
    assert.match(css, /\.lph-need-help/);
  });

  it('wires Manage: assets, secCard, marketplace ?, command Help', () => {
    assert.match(manage, /lp-help-centre\.js/);
    assert.match(manage, /lp-help-centre\.css/);
    assert.match(manage, /lph-need-help/);
    assert.match(manage, /amp-tile-help/);
    assert.match(manage, /lpc-help/);
    assert.match(manage, /LPHelp\.open/);
  });

  it('standalone /help boots LPHelp', () => {
    assert.match(helpHtml, /lp-help-centre\.js/);
    assert.match(helpHtml, /LPHelp\.open/);
  });

  it('ticket API requires auth and accepts message', () => {
    assert.match(ticket, /Sign in to request help/);
    assert.match(ticket, /help_tickets/);
    assert.match(ticket, /RESEND_API_KEY/);
    assert.match(ticket, /openSupport:\s*true/);
  });
});
