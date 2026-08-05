'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const js = fs.readFileSync(path.join(__dirname, '../marketplace/demos/demo-shared.js'), 'utf8');
assert.ok(js.includes('_cropY='), 'demo-shared computes cropY');
assert.ok(js.includes('L.cropY'), 'demo-shared reads logo.cropY');
assert.ok(js.includes("object-fit:'+(_cropY?'cover':'contain')"), 'crop switches object-fit');
assert.ok(js.includes("overflow:hidden"), 'crop uses overflow hidden on wrap');

const manage = fs.readFileSync(path.join(__dirname, '../manage.html'), 'utf8');
assert.ok(manage.includes('id="lg-crop"'), 'editor has crop slider');
assert.ok(manage.includes('L.cropY=v'), 'editor persists cropY');
assert.ok(manage.includes('L.cropFocus='), 'editor persists cropFocus');

const trade = fs.readFileSync(path.join(__dirname, '../trade.template.json'), 'utf8');
assert.ok(trade.includes('_cropY='), 'trade template synced crop CSS');
assert.ok(trade.includes('overflow-x:auto;-webkit-overflow-scrolling:touch'), 'customHtml mount scrolls on narrow');

const tm = fs.readFileSync(path.join(__dirname, '../assets/apps/transfer-matcher/app.css'), 'utf8');
assert.ok(!/^\.bar\{/m.test(tm), 'TM .bar must not be unscoped');
assert.ok(!/^\.wrap\{/m.test(tm), 'TM .wrap must not be unscoped');
assert.ok(tm.includes('#tm-root .shot{'), 'TM shot scoped');
assert.ok(tm.includes('@media(max-width:720px)'), 'TM has mobile breakpoints');
assert.ok(tm.includes('grid-template-columns:1fr'), 'TM shot stacks on mobile');

console.log('logo-crop-customhtml: ok');
