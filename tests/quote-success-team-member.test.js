/**
 * Quote form confirmation — no hardcoded plumber; editable successSub.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const trade = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
const shell = JSON.parse(fs.readFileSync(path.join(root, 'landing-shell-neutral-v1.template.json'), 'utf8')).html;
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const fields = fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8');
const defaults = fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8');
const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-quote.html'), 'utf8');

assert.ok(!/plumber will call you/i.test(trade), 'trade template has no plumber confirmation');
assert.ok(trade.includes('team member from {{businessName}}'), 'trade template defaults to team member');
assert.ok(trade.includes('successSub') || trade.includes('successBody'), 'trade hydrates editable success body');

assert.ok(!/plumber will call you/i.test(shell), 'landing shell has no plumber confirmation');
assert.ok(shell.includes('team member from {{businessName}}'), 'landing shell defaults to team member');

assert.ok(manage.includes("successSub:"), 'manage defaults include successSub');
assert.ok(manage.includes("['successSub'") || manage.includes("['successSub',"), 'manage wires successSub field');
assert.ok(manage.includes('Sent confirmation message'), 'quote editor has confirmation section');
assert.ok(!/plumber calls you/.test(manage.match(/quote:\{[^}]+successTitle[^}]+\}/)[0]), 'default quote.sub is not plumber-specific');

assert.ok(fields.includes('sections.quote.successSub'), 'marketplace field defs expose successSub');
assert.ok(defaults.includes('"successSub"'), 'playground defaults include successSub');
assert.ok(!/plumber will call you/i.test(demo), 'demo quote has no plumber confirmation');
assert.ok(demo.includes('team member from {{businessName}}'), 'demo quote uses team member');

console.log('quote-success-team-member.test.js: ok');
