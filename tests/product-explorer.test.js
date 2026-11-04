'use strict';

/**
 * Product Explorer app (sections.productExplorer): assets/lp-product-explorer.{js,css},
 * trade.template.json, lib/section-order.js, manage.html, api/api-apps.js, marketplace,
 * plus the Jost Architectural font set.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const js = read('assets/lp-product-explorer.js');
const css = read('assets/lp-product-explorer.css');

test('template has the section, shows/hides it like other apps and loads the assets', () => {
  const html = JSON.parse(read('trade.template.json')).html;
  assert.match(html, /<section data-sec="productExplorer" class="section" id="productExplorer" style="display:none"><\/section>/);
  assert.equal((html.match(/'productExplorer','customHtml','storyTimeline','storyRows','mapHours','ctaBanner'\]/g) || []).length, 2);
  assert.match(html, /productExplorer:'Product Explorer',storyTimeline:'Timeline'/);
  assert.match(html, /<script src="\/assets\/lp-product-explorer\.js\?v=\d+" defer><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="\/assets\/lp-product-explorer\.css\?v=\d+">/);
});

test('section order: optional and off by default', () => {
  const so = require('../lib/section-order.js');
  assert.ok(so.OFF_BY_DEFAULT.includes('productExplorer'));
  assert.ok(so.OPTIONAL_SECTIONS.includes('productExplorer'));
  assert.ok(!so.resolveSectionOrder({ sections: { productExplorer: { on: false } } }).includes('productExplorer'));
});

test('explorer never borrows another model’s images and falls back to a placeholder', () => {
  assert.match(js, /function imagesOf\(it\)/);
  assert.match(js, /pick\(\['elev1', 'elev2', 'elev3', 'elev4'\]\)/);
  assert.match(js, /pick\(\['floorPlan', 'floorPlan2'\]\)/);
  assert.match(js, /Official floor plan coming soon/);
  assert.doesNotMatch(js, /items\[0\]\.floorPlan|firstPlan/);
});

test('filters, address state, enquiry preselect, viewer and phone layout', () => {
  assert.match(js, /u\.searchParams\.set\('pe-cat', STATE\.cat\)/);
  assert.match(js, /u\.searchParams\.set\('pe-model', STATE\.model\)/);
  assert.match(js, /sessionStorage\.setItem\('lp_pe_enquiry', label\)/);
  assert.match(js, /var want = \[txt\(M\.notSureLabel\) \|\| 'Not sure yet'\]\.concat\(R\.list\.map\(labelFor\)\);/);
  assert.match(js, /data-lb="zoom"/);
  assert.match(js, /if \(M\.on !== true\) \{ if \(old\) old\.parentNode\.removeChild\(old\); return; \}/);
  assert.match(css, /@media \(max-width:860px\)\{[\s\S]*\.pe-models\{flex-direction:row;[^}]*overflow-x:auto/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('editor: defaults, lists with upload slots, settings card, menu and app entry', () => {
  const m = read('manage.html');
  assert.match(m, /productExplorer:\{on:false,eyebrow:'Explorer'/);
  assert.match(m, /productExplorerItems:\{secId:'productExplorer',key:'items',addLabel:'Add model'/);
  for (const k of ['floorPlan', 'floorPlan2', 'elev1', 'elev2', 'elev3', 'elev4', 'photo1', 'photo2', 'photo3', 'photo4', 'photo5', 'photo6', 'photo7', 'photo8']) {
    assert.match(m, new RegExp("\\{k:'" + k + "',type:'image'"));
  }
  assert.match(m, /productExplorerCats:\{secId:'productExplorer',key:'categories'/);
  assert.match(m, /productExplorer:\{title:'Explorer settings'/);
  assert.match(m, /\} else if\(sub==='productExplorer'\)\{/);
  assert.match(m, /\['productExplorer','Product Explorer'\],\['storyTimeline'/);
  assert.match(m, /section_key:'productExplorer',/);
});

test('marketplace registration and Jost font set', () => {
  assert.match(read('api/api-apps.js'), /await ensureNewApp\(PRODUCT_EXPLORER_APP\);/);
  assert.equal(JSON.parse(read('marketplace/app-content.json')).productExplorer.name, 'Product Explorer');
  assert.equal(require('../lib/marketplace-categories.js').categoryForSection('productExplorer'), 'core-content');
  const F = require('../assets/lp-fonts.js');
  assert.ok(F.ORDER.includes('jost'));
  assert.match(F.css('jost'), /--lp-font-head:"Jost"/);
});

test('enlarge only from the pill, swipe between images, brochure button', () => {
  // The picture itself is not a button any more; only the pill opens the full-screen viewer.
  assert.match(js, /<div class="pe-stage-img"><img /);
  assert.match(js, /<button type="button" class="pe-stage-tools" data-pe-full /);
  assert.doesNotMatch(js, /class="pe-stage-img" data-pe-full/);
  assert.match(js, /Click to enlarge<\/span><span class="pe-say-tap">Tap to enlarge/);
  assert.match(css, /@media \(hover:none\),\(pointer:coarse\)\{\.pe-say-click\{display:none\}\.pe-say-tap\{display:inline\}\}/);
  // Swipe on the page stage and in the full-screen viewer (not while zoomed), sideways only.
  assert.match(js, /function swipe\(el, onStep\)/);
  assert.match(js, /Math\.abs\(dx\) < Math\.abs\(dy\) \* 1\.5/);
  assert.match(js, /swipe\(box, function \(d\) \{ if \(!box\.classList\.contains\('is-zoom'\)\) go\(d\); \}\);/);
  assert.match(js, /swipe\(node, function \(d\) \{ if \(inStage\) stepMain\(d\); \}\);/);
  assert.match(css, /\.pe-stage\{[^}]*touch-action:pan-y pinch-zoom/);
  // Brochure button sits between Enquire and full details, only when the model has one.
  const enq = js.indexOf('data-pe-enquire>'), bro = js.indexOf('data-pe-brochure>'), det = js.indexOf("'<a class=\"lpl-btn pe-btn pe-out\"");
  assert.ok(enq > 0 && bro > enq && det > bro);
  assert.match(js, /\(pdf \? '<a class="lpl-btn pe-btn pe-bro"/);
  assert.match(js, /txt\(M\.brochureLabel\) \|\| 'Download brochure'/);
});

test('editor: brochure PDF upload to the site’s Cloudinary folder; PDFs stay out of the image library', () => {
  const m = read('manage.html');
  assert.match(m, /\{k:'brochure',type:'pdf',label:'Brochure \(PDF\)'/);
  assert.match(m, /\{t:'text',k:'brochureLabel',/);
  assert.match(m, /if\(f\.type==='pdf'\) return .*cwPdfHTML\('data-k="'\+f\.k\+'"'/);
  assert.match(m, /<input type="file" class="cw-pdf-in" accept="application\/pdf,\.pdf"/);
  assert.match(m, /async function cwUploadPdf\(file,parts\)\{/);
  assert.match(m, /var _folder='leadpages\/'\+cwSiteSeg\(\)\+'\/'\+parts\.map\(cwSeg\)\.join\('\/'\);\n    var _base=/);
  assert.match(m, /var CW_PDF_MAX=20\*1024\*1024;/);
  // Paste a link to a PDF elsewhere → Cloudinary copies it into the client's folder; non-PDFs are removed again.
  assert.match(m, /class="btn ghost cw-pdf-copy"/);
  assert.match(m, /if\(isLink\) fd\.append\('file',file\.link\);/);
  assert.match(m, /if\(String\(uj\.format\|\|''\)\.toLowerCase\(\)!=='pdf'\)\{ cwDelete\(uj\.public_id\);/);
  assert.match(read('api/cloudinary/library.js'), /String\(x\.format \|\| ''\)\.toLowerCase\(\) === 'pdf'\) return;/);
});
