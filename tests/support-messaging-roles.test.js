/**
 * Support messaging roles / dark-theme regression checks (static).
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const embedJs = fs.readFileSync(path.join(root, 'assets/lp-messages-embed.js'), 'utf8');
const embedCss = fs.readFileSync(path.join(root, 'assets/lp-messages-embed.css'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const messages = fs.readFileSync(path.join(root, 'messages.html'), 'utf8');

// Dark theme: filter/bubbles must not depend solely on overwritten --panel-soft
assert.ok(embedCss.includes('--lme-filter-bg'), 'embed CSS defines local filter bg token');
assert.ok(embedCss.includes('var(--lme-filter-bg)'), 'filters use --lme-filter-bg');
assert.ok(embedCss.includes('--lme-bubble-them'), 'them bubbles use dedicated token');
assert.ok(embedCss.includes('.lme-escalate'), 'escalate footer styles present');

// Appearance must not clobber workspace --panel-soft
assert.ok(manage.includes("S('--ad-panel-soft'"), 'appearance writes --ad-panel-soft');
assert.ok(!manage.includes("S('--panel-soft',apprMix"), 'appearance no longer overwrites --panel-soft');
assert.ok(manage.includes('var(--ad-panel-soft'), 'ad panel labels use --ad-panel-soft');

// Role / escalate behaviour in embed
assert.ok(embedJs.includes("label: 'My provider'"), 'clients get My provider chip, not Clients');
assert.ok(embedJs.includes('Escalate to LeadPages support'), 'escalate link present');
assert.ok(embedJs.includes("me.role === 'client' && c.kind === 'partner_client'"), 'escalate only on provider thread for clients');
assert.ok(embedJs.includes("kind === 'support' && me.role !== 'client'"), 'New→support blocked for clients');
assert.ok(embedJs.includes('filterBySiteScope'), 'site scoping for manage embed');
assert.ok(embedJs.includes("role === 'super'"), 'super role supported');

// manage wiring
assert.ok(manage.includes('updateSupportNavBadge'), 'Support nav badge helper');
assert.ok(manage.includes('supportNavAllowed'), 'Support tab gated for customer admin');
assert.ok(manage.includes("role='super'"), 'renderMessages passes super role');
assert.ok(manage.includes('siteId: currentSiteId'), 'embed receives siteId');
assert.ok(manage.includes('onUnread: updateSupportNavBadge'), 'unread wired to nav');
assert.ok(manage.includes('.lme-nav-dot'), 'nav unread dot CSS');

// messages.html parity for clients
assert.ok(!messages.includes('Contact LeadPages support</button>'), 'messages.html removes primary LeadPages CTA');
assert.ok(messages.includes('Escalate to LeadPages support'), 'messages.html escalate link');

console.log('support-messaging-roles.test.js: ok');
