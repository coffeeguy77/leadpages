'use strict';

/**
 * AI Composer design blocks: template / CSS safety checks (lib/ai-composer/blocks.js),
 * the renderer (assets/lp-blocks.js), build-config wiring and block access rules.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://x.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'x';

const blocks = require('../lib/ai-composer/blocks');
const lpb = require('../assets/lp-blocks.js');
const { appFieldSheet } = require('../lib/ai-composer/catalogue');
const { buildSiteConfig } = require('../lib/ai-composer/build-config');
const { sanitizeClientPlan } = require('../lib/ai-composer/plan');
const { mayUse } = require('../lib/ai-composer/block-store');

const ID = '11111111-2222-4333-8444-555555555555';
const sheet = appFieldSheet('specialOffer', 'card');
const GOOD = {
  name: 'Overlay card banner',
  looks: 'Full-width photo with a white card on the left.',
  template: '<div class="b-wrap"><img class="b-bg" src="{{bgImage}}" alt="{{heading}}" loading="lazy"><div class="b-card">{{?eyebrow}}<p class="b-eye">{{eyebrow}}</p>{{/eyebrow}}<h2>{{heading}}</h2><ul>{{#points}}<li><span>{{@nn}}</span>{{icon:icon}} {{text}}</li>{{/points}}</ul><a class="b-btn" href="#quote">{{cta}}</a></div></div>',
  css: '.b-wrap{position:relative;max-width:var(--site-maxw,1200px);margin:0 auto}.b-card{background:#fff;color:var(--steel-900)} @media (max-width:760px){.b-card{position:static}} @font-face{font-family:x}'
};

test('fieldNames uses the app sheet', () => {
  const n = blocks.fieldNames(sheet);
  assert.ok(n.scalars.heading && n.scalars.heading.path);
  assert.ok(n.lists.points && n.lists.points.fields.indexOf('text') >= 0);
});

test('a good block passes, CSS is scoped and @font-face dropped', () => {
  const r = blocks.prepareBlock(GOOD, 'specialOffer', sheet, ID);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
  assert.match(r.block.css, /^\.lpb-11111111-2222-4333-8444-555555555555 \.b-wrap\{/);
  assert.match(r.block.css, /@media \(max-width:760px\)\{\.lpb-[\w-]+ \.b-card\{/);
  assert.doesNotMatch(r.block.css, /font-face/);
});

test('unsafe templates are refused', () => {
  const n = blocks.fieldNames(sheet);
  const bad = {
    '<script>alert(1)</script>': /tag <script>/,
    '<div onclick="x()">{{heading}}</div>': /attribute onclick/,
    '<div style="color:red">{{heading}}</div>': /attribute style/,
    '<img src="https://evil/x.png">': /src must be a single placeholder/,
    '<a href="javascript:alert(1)">x</a>': /script URLs/,
    '<a href="https://x.com">{{heading}}</a>': /href must be/,
    '<div>{{secretField}}</div>': /not a field/,
    '<div>{{#nope}}x{{/nope}}</div>': /not a list/,
    '<div><p>{{heading}}</div>': /does not match/,
    '<div>{{heading}': /malformed/,
    '<!-- hi --><div></div>': /comments/,
    '<iframe src="{{bgImage}}"></iframe>': /tag <iframe>/,
    '<div class=x>{{heading}}</div>': /not quoted/
  };
  Object.keys(bad).forEach((t) => {
    const p = blocks.validateTemplate(t, n);
    assert.ok(p.some((x) => bad[t].test(x)), t + ' → ' + JSON.stringify(p));
  });
});

test('unsafe CSS is refused', () => {
  ['.a{background:url(https://x)}', '@import "x";', '.a{width:expression(1)}', '.a{content:"\\3c"}', '.a{}</style><script>'].forEach((c) => {
    assert.ok(blocks.scopeCss(c, ID).problems.length, c);
  });
  assert.equal(blocks.scopeCss('body .x{color:red} :root{--a:1}', ID).css, '.lpb-' + ID + ' .x{color:red}.lpb-' + ID + '{--a:1}');
});

test('renderer fills fields, lists, conditionals, numbers and escapes values', () => {
  const block = blocks.prepareBlock(GOOD, 'specialOffer', sheet, ID).block;
  const C = { businessName: 'Acme', sections: { specialOffer: {
    heading: 'Save <b>big</b>', eyebrow: '', bgImage: 'javascript:alert(1)', cta: 'Get a quote',
    points: [{ text: 'One', icon: 'star' }, { text: 'Hidden', on: false }, { text: 'Two "x"', icon: 'bad icon' }]
  } } };
  const html = lpb.render(block, C, { star: '<path d="M1 1"/>' });
  assert.match(html, /<h2>Save &lt;b&gt;big&lt;\/b&gt;<\/h2>/);
  assert.doesNotMatch(html, /b-eye/, 'empty eyebrow hidden');
  assert.match(html, /src=""/, 'unsafe src dropped');
  assert.match(html, /<li><span>01<\/span><svg[^>]*><path d="M1 1"\/><\/svg> One<\/li><li><span>02<\/span> Two &quot;x&quot;<\/li>/);
  assert.doesNotMatch(html, /Hidden/);
  assert.equal(lpb.safeUrl('https://a.b/c.jpg'), 'https://a.b/c.jpg');
  assert.equal(lpb.safeUrl('//evil.com/x'), '');
  assert.equal(lpb.safeUrl('data:text/html,x'), '');
});

function plan(block) {
  return sanitizeClientPlan({
    businessName: 'Acme',
    design: { url: 'https://res.cloudinary.com/dzx6x1hou/image/upload/v1790000000/leadpages/ai-composer/202610/design-abc.png', width: 1440, height: 3000 },
    sections: [
      { id: 's1', appKey: 'heroSlider', label: 'Hero', rows: { y0: 0, y1: 800 } },
      { id: 's2', appKey: 'specialOffer', label: 'Offer', rows: { y0: 800, y1: 1400 }, layout: 'card', block: block }
    ],
    photos: []
  });
}

test('plan keeps a block id only when it is a uuid', () => {
  assert.equal(plan(ID).sections.find((s) => s.id === 's2').block, ID);
  assert.ok(!plan('<x>').sections.find((s) => s.id === 's2').block);
});

test('build-config stores the block and points the app at it', () => {
  const b = blocks.prepareBlock(GOOD, 'specialOffer', sheet, ID).block;
  const cfg = buildSiteConfig(plan(ID), [{ sectionId: 's2', scalars: { 'sections.specialOffer.heading': 'Save' }, lists: { 'sections.specialOffer.points': [{ text: 'One' }] } }], { businessName: 'Acme', blocks: { [ID]: b } });
  assert.equal(cfg.blockLayouts[ID].template, b.template);
  assert.equal(cfg.sections.specialOffer.blockLayout, ID);
  // Without the block loaded (not allowed / missing) nothing is set.
  const cfg2 = buildSiteConfig(plan(ID), [], { businessName: 'Acme', blocks: {} });
  assert.ok(!cfg2.blockLayouts || !cfg2.blockLayouts[ID]);
  assert.ok(!cfg2.sections.specialOffer || !cfg2.sections.specialOffer.blockLayout);
});

test('block access: approved for all, site blocks only for their partner, hidden for nobody', () => {
  const sup = { role: 'super' };
  const p1 = { role: 'partner', partner: { id: 'p1' } };
  const p2 = { role: 'partner', partner: { id: 'p2' } };
  assert.equal(mayUse(p2, { status: 'approved', partner_id: 'p1' }), true);
  assert.equal(mayUse(p1, { status: 'site', partner_id: 'p1' }), true);
  assert.equal(mayUse(p2, { status: 'site', partner_id: 'p1' }), false);
  assert.equal(mayUse(sup, { status: 'site', partner_id: 'p1' }), true);
  assert.equal(mayUse(sup, { status: 'hidden' }), false);
});

test('render.js only adds the block script when a site has blocks', () => {
  const src = require('fs').readFileSync(require.resolve('../api/render.js'), 'utf8');
  assert.match(src, /function injectBlocks\(doc, cfg\)/);
  assert.match(src, /html = injectBlocks\(html, cfg\)/);
});

test('approved custom layouts: offered in the plan prompt and resolved back to a block id', () => {
  const { catalogueForPlanPrompt } = require('../lib/ai-composer/catalogue');
  const { resolvePlanAliases, blockAlias } = require('../lib/ai-composer/block-store');
  const alias = blockAlias(ID);
  assert.equal(alias, 'custom-11111111');
  const txt = catalogueForPlanPrompt({ specialOffer: [{ alias: alias, looks: 'White card over a photo' }] });
  assert.match(txt, /custom-11111111 — CUSTOM layout, looks: White card over a photo/);
  const approved = { byAlias: { ['specialOffer/' + alias]: { id: ID, layout: 'banner' } } };
  const raw = { sections: [
    { appKey: 'specialOffer', layout: alias },
    { appKey: 'faq', layout: alias },
    { appKey: 'faq', layout: 'split' }
  ] };
  resolvePlanAliases(raw, approved);
  assert.deepEqual(raw.sections[0], { appKey: 'specialOffer', layout: 'banner', block: ID });
  assert.equal(raw.sections[1].layout, '', 'alias of another app is dropped');
  assert.ok(!raw.sections[1].block);
  assert.equal(raw.sections[2].layout, 'split');
});
