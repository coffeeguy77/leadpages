// Visual page editor (Landing pages → Page content → Visual): structure helpers and wiring.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'assets/lp-visual-editor.js'), 'utf8');
const sandbox = { window: {}, document: undefined };
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox);
const S = sandbox.window.LPVisual.struct;
const at = (body, needle) => { const i = body.indexOf(needle); assert.ok(i >= 0, 'missing ' + needle); return i; };

test('exposes the API manage.html calls', () => {
  const V = sandbox.window.LPVisual;
  for (const k of ['pageOpened', 'pageClosed', 'frameReady', 'sync']) assert.strictEqual(typeof V[k], 'function', k);
});

test('cards: move an item down and up, copy and delete', () => {
  const body = ':::cards cols=3\nstar | One | A\nstar | Two | B\nstar | Three | C\n:::';
  assert.strictEqual(S.itemOp(body, at(body, 'One'), 'down'), ':::cards cols=3\nstar | Two | B\nstar | One | A\nstar | Three | C\n:::');
  assert.strictEqual(S.itemOp(body, at(body, 'Two'), 'up'), ':::cards cols=3\nstar | Two | B\nstar | One | A\nstar | Three | C\n:::');
  assert.strictEqual(S.itemOp(body, at(body, 'One'), 'up'), null, 'first item cannot go up');
  assert.strictEqual(S.itemOp(body, at(body, 'Three'), 'down'), null, 'last item cannot go down');
  assert.strictEqual(S.itemOp(body, at(body, 'Two'), 'copy'), ':::cards cols=3\nstar | One | A\nstar | Two | B\nstar | Two | B\nstar | Three | C\n:::');
  assert.strictEqual(S.itemOp(body, at(body, 'Two'), 'delete'), ':::cards cols=3\nstar | One | A\nstar | Three | C\n:::');
  assert.deepStrictEqual(Object.assign({}, S.itemInfo(body, at(body, 'Two'))), { kind: 'cell', up: true, down: true });
});

test('FAQ entries move with their answer lines', () => {
  const body = ':::faq\n? info | Q1?\nA1 line 1\nA1 line 2\n? info | Q2?\nA2\n:::';
  assert.strictEqual(S.itemOp(body, at(body, 'A1 line 2'), 'down'), ':::faq\n? info | Q2?\nA2\n? info | Q1?\nA1 line 1\nA1 line 2\n:::');
  assert.strictEqual(S.itemOp(body, at(body, 'Q2'), 'delete'), ':::faq\n? info | Q1?\nA1 line 1\nA1 line 2\n:::');
});

test('table rows move but the header row is not an item', () => {
  const body = '| H1 | H2 |\n| --- | --- |\n| a | 1 |\n| b | 2 |';
  assert.strictEqual(S.itemOp(body, at(body, 'H1'), 'down'), null);
  assert.strictEqual(S.itemOp(body, at(body, '| a'), 'down'), '| H1 | H2 |\n| --- | --- |\n| b | 2 |\n| a | 1 |');
  assert.strictEqual(S.itemOp(body, at(body, '| b'), 'up'), '| H1 | H2 |\n| --- | --- |\n| b | 2 |\n| a | 1 |');
});

test('numbered lists renumber after a move or delete', () => {
  const body = '1. One\n2. Two\n3. Three';
  assert.strictEqual(S.itemOp(body, at(body, 'Three'), 'up'), '1. One\n2. Three\n3. Two');
  assert.strictEqual(S.itemOp(body, at(body, 'One'), 'delete'), '1. Two\n2. Three');
});

test('sections: blocks and headed text move as whole sections', () => {
  const body = ':::heading Title\nIntro\n:::\n\n:::notice tone=info\nNote\n:::\n\nLast para.';
  assert.strictEqual(S.sectionOp(body, at(body, 'Note'), 'up'), ':::notice tone=info\nNote\n:::\n\n:::heading Title\nIntro\n:::\n\nLast para.');
  assert.strictEqual(S.sectionOp(body, at(body, 'Note'), 'delete'), ':::heading Title\nIntro\n:::\n\nLast para.');
  assert.strictEqual(S.sectionOp(body, at(body, 'Title'), 'up'), null);
  assert.strictEqual(Object.assign({}, S.sectionInfo(body, at(body, 'Note'))).count, 3);
});

test('rich pages: a heading section runs to the next heading of the same level', () => {
  const body = '## A\nText A\n\n### A1\nSub text\n\n## B\nText B';
  const out = S.sectionOp(body, at(body, 'Text B'), 'up');
  assert.strictEqual(out, '## B\nText B\n\n## A\nText A\n\n### A1\nSub text');
});

test('insertSection adds after the current section or at the end', () => {
  const body = ':::heading T\nI\n:::\n\nPara.';
  assert.strictEqual(S.insertSection(body, at(body, 'I'), 'NEW'), ':::heading T\nI\n:::\n\nNEW\n\nPara.');
  assert.strictEqual(S.insertSection(body, -1, 'NEW'), ':::heading T\nI\n:::\n\nPara.\n\nNEW');
  assert.strictEqual(S.insertSection('', -1, 'NEW'), 'NEW');
});

test('every block template parses as one section', () => {
  for (const t of S.TEMPLATES_BLOCKS) assert.strictEqual(S.sections(S.lines(t.text)).length, 1, t.id);
});

test('linkAddr turns what was typed into an address', () => {
  assert.strictEqual(S.linkAddr('admin@example.com'), 'mailto:admin@example.com');
  assert.strictEqual(S.linkAddr('0417 452 365'), 'tel:0417452365');
  assert.strictEqual(S.linkAddr('example.com.au'), 'https://example.com.au');
  assert.strictEqual(S.linkAddr('https://x.com/a'), 'https://x.com/a');
  assert.strictEqual(S.linkAddr('Fees and Payment'), '/fees-and-payment');
  assert.strictEqual(S.linkAddr('/contact'), '/contact');
  assert.strictEqual(S.linkAddr(''), '');
});

test('lp-layouts marks editable text only in edit mode', () => {
  const lay = fs.readFileSync(path.join(ROOT, 'assets/lp-layouts.js'), 'utf8');
  assert.match(lay, /function lpbMapFind\(/);
  assert.match(lay, /window\.__lpbEdit === true/);
  assert.match(lay, /lpb:edit-render/);
  assert.match(lay, /LPB_MAP \? lpbMapWrap\(s, ?out\) : out/);
});

test('manage.html wires the editor and the super-admin level switch', () => {
  const html = fs.readFileSync(path.join(ROOT, 'manage.html'), 'utf8');
  assert.match(html, /<script src="\/assets\/lp-visual-editor\.js\?v=\d+"><\/script>/);
  assert.match(html, /id="lpv-level"/);
  assert.match(html, /window\.LPVisualHost\s*=/);
  assert.match(html, /currentRole\s*===\s*'super'\) return 'advanced'/);
  assert.match(html, /LPVisual\.pageOpened\(\)/);
  assert.match(html, /LPVisual\.frameReady\(\)/);
});

test('in-panel surface: the Page content box shows the page itself (not just the side preview)', () => {
  const html = fs.readFileSync(path.join(ROOT, 'manage.html'), 'utf8');
  assert.match(html, /id="lpv-surface-wrap" hidden><iframe id="lpv-surface"/);
  assert.match(html, /surfaceUrl:function\(\)\{ return '\/'\+previewTarget\(\)\+'\?preview='\+Date\.now\(\)\+previewPageQuery\(\)/);
  assert.match(html, /applyTo:function\(w\)\{[^}]*__applyTradeConfig\(data\)/);
  assert.match(html, /lp-visual-editor\.js\?v=3/);
  assert.match(SRC, /var sw = \$\('lpv-surface-wrap'\); if \(sw\) sw\.hidden = !vis;/);
  assert.match(SRC, /main#top>\*:not\(section\.lp-page\)\{display:none!important\}/);
  assert.match(SRC, /sib\.style\.setProperty\('display', 'none', 'important'\)/);
});

test('lp-layouts finds the page from ?page= (how the editor preview opens a page)', () => {
  const lay = fs.readFileSync(path.join(ROOT, 'assets/lp-layouts.js'), 'utf8');
  assert.match(lay, /new URLSearchParams\(location\.search\)\.get\('page'\)/);
});

test('Enter splits a paragraph or adds a list item instead of leaving the text', () => {
  assert.match(SRC, /if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\); onEnter\(el\); \}/);
  assert.match(SRC, /e\.inputType !== 'insertParagraph' && e\.inputType !== 'insertLineBreak'/);
  assert.match(SRC, /return \{ kind: 'p', sep: '\\n\\n', line: i \};/);
  assert.match(SRC, /return \{ kind: 'li', sep: '\\n' \+ lead, line: i \};/);
});
