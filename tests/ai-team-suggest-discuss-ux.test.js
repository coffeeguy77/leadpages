/**
 * AI Website Team panel UX — soft refresh + suggestion card structure (static).
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'assets/ai-website-team.js'), 'utf8');
const atlas = fs.readFileSync(path.join(root, 'lib/ai-team/atlas.js'), 'utf8');

assert.ok(ui.includes('async function softRefresh'), 'softRefresh helper exists');
assert.ok(ui.includes('await softRefresh('), 'ask / reject paths use softRefresh');
assert.ok(
  ui.includes("statusText:") && ui.includes('Suggestions updated'),
  'ask success does not wipe to Loading via loadPanel'
);
assert.ok(!/setMsg\(msg, 'Review ready'[\s\S]{0,40}loadPanel\(panelCtx\)/.test(ui), 'ask no longer loadPanels after Review ready');

assert.ok(ui.includes("ai-rec-label\">Issue"), 'Issue label on cards');
assert.ok(ui.includes("ai-rec-label\">Suggestion"), 'Suggestion label on cards');
assert.ok(ui.includes('Why this was suggested'), 'reason label on cards');
assert.ok(ui.includes('ai-rec-discuss'), 'Discuss button present');
assert.ok(ui.includes('Discuss this suggestion:'), 'Discuss prefills ask box');
assert.ok(ui.includes('does <em>not</em> build pages'), 'clarifies Ask does not build pages');

assert.ok(atlas.includes('plan_seo_landing'), 'landing outcome still generated');
assert.ok(atlas.includes('Generated because you asked'), 'landing reason cites user ask');
assert.ok(atlas.includes('landingpage'), 'matches landingpage as one word');

console.log('ai-team-suggest-discuss-ux.test.js: ok');
