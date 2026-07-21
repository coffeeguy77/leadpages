/**
 * Online Quote must appear in Page editor → Position (section order)
 * when the section is enabled.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');

test('onlineQuote is an optional component for Position ordering', function() {
  assert.match(manage, /OPTIONAL_COMPONENTS\s*=\s*\[[^\]]*onlineQuote/);
});

test('_orderList inserts onlineQuote before quote when enabled', function() {
  // Extract and eval the minimal helpers needed from manage.html.
  const layoutsMatch = manage.match(/const LAYOUTS\s*=\s*(\{[\s\S]*?\});\s*\n\s*function getLayout/);
  assert.ok(layoutsMatch, 'LAYOUTS present');
  const optMatch = manage.match(/const OPTIONAL_COMPONENTS\s*=\s*(\[[^\]]+\])/);
  assert.ok(optMatch, 'OPTIONAL_COMPONENTS present');
  const offMatch = manage.match(/const OFF_BY_DEFAULT_SECTIONS\s*=\s*(\[[^\]]+\])/);
  assert.ok(offMatch, 'OFF_BY_DEFAULT_SECTIONS present');

  const startEnsure = manage.indexOf('function _orderEnsure(base, id, afterIds)');
  const startList = manage.indexOf('function _orderList(c)');
  const endList = manage.indexOf('function wireOrder(c)');
  assert.ok(startEnsure > 0 && startList > 0 && endList > startList);

  const sandbox = {
    LAYOUTS: null,
    OPTIONAL_COMPONENTS: null,
    OFF_BY_DEFAULT_SECTIONS: null,
    getLayout: null,
    _secOn: null,
    _orderEnsure: null,
    _orderList: null
  };
  vm.createContext(sandbox);
  vm.runInContext(
    'LAYOUTS = ' + layoutsMatch[1] + ';\n' +
    'OPTIONAL_COMPONENTS = ' + optMatch[1] + ';\n' +
    'OFF_BY_DEFAULT_SECTIONS = ' + offMatch[1] + ';\n' +
    'function getLayout(layoutId){ return (layoutId && LAYOUTS[layoutId]) ? LAYOUTS[layoutId] : LAYOUTS.classic; }\n' +
    'function _secOn(c,id){ var s=(c&&c.sections&&c.sections[id])||{}; return (OFF_BY_DEFAULT_SECTIONS.indexOf(id)>=0)?(s.on===true):(s.on!==false); }\n' +
    manage.slice(startEnsure, endList),
    sandbox
  );

  const off = sandbox._orderList({
    layout: 'classic',
    sections: { onlineQuote: { on: false }, quote: {} }
  });
  assert.ok(off.indexOf('onlineQuote') < 0, 'hidden when off');

  const on = sandbox._orderList({
    layout: 'classic',
    sections: { onlineQuote: { on: true }, quote: {} }
  });
  assert.ok(on.indexOf('onlineQuote') >= 0, 'shown when on');
  assert.ok(on.indexOf('onlineQuote') < on.indexOf('quote'), 'defaults before quote');

  const custom = sandbox._orderList({
    layout: 'classic',
    sections: { onlineQuote: { on: true }, quote: {}, hero: {} },
    sectionOrder: ['hero', 'quote', 'onlineQuote', 'services']
  });
  assert.equal(custom.indexOf('onlineQuote'), custom.indexOf('quote') + 1);
});
