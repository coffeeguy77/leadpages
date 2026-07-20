/**
 * Support messaging + newsletter UX regression checks (static).
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
assert.ok(embedCss.includes('.lme-footer-actions'), 'footer actions styles present');
assert.ok(!embedCss.includes('.lme-escalate'), 'old escalate styles removed');

// Appearance must not clobber workspace --panel-soft
assert.ok(manage.includes("S('--ad-panel-soft'"), 'appearance writes --ad-panel-soft');
assert.ok(!manage.includes("S('--panel-soft',apprMix"), 'appearance no longer overwrites --panel-soft');
assert.ok(manage.includes('var(--ad-panel-soft'), 'ad panel labels use --ad-panel-soft');

// Support UX: New starts provider chat; no escalation discussion / Escalated filter
assert.ok(embedJs.includes("label: 'My provider'"), 'clients get My provider chip');
assert.ok(!embedJs.includes('Escalate to LeadPages support'), 'escalate link removed from embed');
assert.ok(!embedJs.includes("label: 'Escalated'"), 'Escalated filter removed');
assert.ok(embedJs.includes('Add LeadPages Team to this chat'), 'add LeadPages Team action');
assert.ok(embedJs.includes('added LeadPages Team to the chat'), 'transparent join system line');
assert.ok(embedJs.includes('Contact LeadPages team privately'), 'client private LeadPages option');
assert.ok(embedJs.includes("me.role === 'client'") && embedJs.includes('openProvider()'), 'client New opens provider');
assert.ok(embedJs.includes('filterBySiteScope'), 'site scoping for manage embed');
assert.ok(embedJs.includes("role === 'super'") || embedJs.includes("me.role === 'super'"), 'super role supported');
assert.ok(embedJs.includes('<p>No conversations yet.</p>'), 'empty state uses stacked paragraphs');
assert.ok(!embedJs.includes('No conversations yet.<br>'), 'empty state no longer uses br in flex row');

// manage wiring
assert.ok(manage.includes('updateSupportNavBadge'), 'Support nav badge helper');
assert.ok(manage.includes('supportNavAllowed'), 'Support tab gated for customer admin');
assert.ok(manage.includes("role='super'") || manage.includes("role='super'"), 'renderMessages passes super role');
assert.ok(manage.includes('siteId: currentSiteId'), 'embed receives siteId');
assert.ok(manage.includes('onUnread: updateSupportNavBadge'), 'unread wired to nav');
assert.ok(manage.includes('.lme-nav-dot'), 'nav unread dot CSS');
assert.ok(manage.includes('add LeadPages Team to the chat') || manage.includes('You can add LeadPages Team'), 'support lede updated');

// Newsletter UX
assert.ok(!manage.includes("seg('individual','One person')"), 'One person option removed');
assert.ok(manage.includes("seg('all','All contacts"), 'All contacts option present');
assert.ok(manage.includes("seg('selected','Selected')"), 'Selected option present');
assert.ok(manage.includes('mlr-compose'), 'compose hero section');
assert.ok(manage.includes('id="mlr-search"'), 'selected search lookup');
assert.ok(manage.includes('max-height:calc(10 * 2.65em'), 'scroll after ~10 names');
assert.ok(manage.includes("MAILER.mode==='individual'") && manage.includes("MAILER.mode='selected'"), 'legacy individual coerced to selected');

// messages.html parity
assert.ok(!messages.includes('Escalate to LeadPages support'), 'messages.html escalate link removed');
assert.ok(messages.includes('Add LeadPages Team to this chat'), 'messages.html add LeadPages');
assert.ok(messages.includes('Contact LeadPages team privately'), 'messages.html private option');
assert.ok(messages.includes('<p style="margin:0">No conversations yet.</p>'), 'messages.html empty state fixed');

console.log('support-messaging-roles.test.js: ok');
