/**
 * Travel zones render as equipment-style cards with map image zoom.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '../..');
const display = fs.readFileSync(path.join(root, 'assets/lp-quote-display.js'), 'utf8');
const planning = fs.readFileSync(path.join(root, 'assets/lp-quote-planning.js'), 'utf8');
const online = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
const serializers = fs.readFileSync(path.join(root, 'lib/quote-system/serializers.js'), 'utf8');
const normalize = fs.readFileSync(path.join(root, 'lib/quote-system/normalize-quote-config.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');

assert.ok(planning.includes('renderTravelZoneRows'), 'planning renders travel zone rows');
assert.ok(planning.includes('wireTravelZoneRows'), 'planning wires travel picks');
assert.ok(planning.includes('data-travel-pick'), 'travel cards use data-travel-pick');
assert.ok(planning.includes('lp-oq-fp-grid'), 'travel uses equipment grid class');
assert.ok(planning.includes("zoomable: true"), 'travel cards enable image zoom');

assert.ok(online.includes('renderTravelZoneRows'), 'live widget uses travel cards');
assert.ok(online.includes('wireTravelZoneRows'), 'live widget wires travel cards');

assert.ok(builder.includes('renderTravelZoneRows'), 'preview uses travel cards');
assert.ok(builder.includes('Travel zone card styling'), 'builder travel card colour section');
assert.ok(builder.includes('wizard.travelCards'), 'travelCards colour paths');
assert.ok(builder.includes("uploadKind === 'travel'"), 'travel gets card image fit controls');
assert.ok(builder.includes('travel.zones.') && builder.includes('.badge'), 'travel badge field');
assert.ok(builder.includes('travel.zones.') && builder.includes('.subtitle'), 'travel subtitle field');

assert.ok(display.includes('data-oq-zoom-src'), 'zoom button in card HTML');
assert.ok(display.includes('openLightbox'), 'lightbox open helper');
assert.ok(display.includes('lp-oq-lightbox'), 'lightbox markup/CSS');
assert.ok(display.includes('wireImageZoom'), 'zoom click wiring');

assert.ok(serializers.includes('travelCards'), 'public shell exposes travelCards');
assert.ok(/travelZones:[\s\S]*badge:/.test(serializers), 'travel zones serialize badge');
assert.ok(/travelZones:[\s\S]*imageFit:/.test(serializers), 'travel zones serialize imageFit');

assert.ok(normalize.includes('travelCards'), 'normalize ensures travelCards');
assert.ok(/zones\.forEach[\s\S]*imageFit/.test(normalize), 'normalize defaults zone imageFit');

assert.ok(manage.includes('oq-portal-access-1'), 'manage cache-bust');
assert.ok(render.includes('oq-portal-access-1'), 'render cache-bust');

console.log('quote-travel-zone-cards.test.js: ok');
