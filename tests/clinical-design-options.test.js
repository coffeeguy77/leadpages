'use strict';

/**
 * Clinical / professional-practice design options (Nov 2026, first used by Pam Connor &
 * Associates): rich landing-page text, header contact items, menu-bar button and current page,
 * photo-banner hero with name card, compact feature band, services heading column, notice
 * banner, footer contact + decoration, sub-page header band, site width, Source Serif font set.
 * Every option is off unless set, so existing sites render as before.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = JSON.parse(read('trade.template.json')).html;
const js = read('assets/lp-layouts.js');
const css = read('assets/lp-layouts.css');
const manage = read('manage.html');

function fnSrc(name) {
  const i = html.indexOf('function ' + name + '(');
  assert.ok(i > 0, name + ' missing');
  let depth = 0, j = html.indexOf('{', i);
  for (let k = j; k < html.length; k++) {
    if (html[k] === '{') depth++;
    else if (html[k] === '}') { depth--; if (depth === 0) return html.slice(i, k + 1); }
  }
  throw new Error('unterminated ' + name);
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const plain = new Function('esc', '_siteBase', fnSrc('_lpMd') + ';return _lpMd;')(esc, () => '/acme');
const rich = new Function('esc', '_siteBase', fnSrc('_lpMdRich') + ';return _lpMdRich;')(esc, () => '/acme');

test('plain page text renderer is unchanged (numbered lines and *x* stay as typed)', () => {
  const out = plain('Steps:\n1. **One**: first\n2. Two\n\n- a\n- b\n\n"Great" - *Jo*');
  assert.match(out, /\n1\. <strong>One<\/strong>: first\n2\. Two/);
  assert.match(out, /- \*Jo\*/);
  assert.doesNotMatch(out, /<ol>|<em>|<a /);
  assert.match(html, /\(p\.rich===true\?_lpMdRich\(p\.blocks===true\?String\(p\.body\|\|''\)\.replace\(\/\^ \*:::\.\*\$\/gm,''\):\(p\.body\|\|''\)\):_lpMd\(p\.body\|\|''\)\)/);
});

test('rich text: links, numbered lists, sub-bullets, italics, tables; raw HTML still escaped', () => {
  const out = rich([
    'See [the fees](/fees), [APS](https://psychology.org.au) or [email](mailto:a@b.com).',
    '',
    '1. First',
    '2. Second',
    '',
    '- Top',
    '  - Sub item',
    '',
    'An *important* note and _another_ one.',
    '',
    '| Stage | Time |',
    '|---|---|',
    '| **Interview** | 3 hours |',
    '| Report ([details](/report)) | Many hours |',
    '',
    '<script>alert(1)</script> [bad](javascript:alert(1))'
  ].join('\n'));
  assert.match(out, /<a href="\/acme\/fees">the fees<\/a>/);
  assert.match(out, /<a href="https:\/\/psychology\.org\.au" target="_blank" rel="noopener">APS<\/a>/);
  assert.match(out, /<a href="mailto:a@b\.com">email<\/a>/);
  assert.match(out, /<ol><li class="lp-oli" value="1">First<\/li>\n<li class="lp-oli" value="2">Second<\/li>\n?<\/ol>/);
  assert.match(out, /<ul class="lp-subl"><li class="lp-sub">Sub item<\/li>/);
  assert.match(out, /An <em>important<\/em> note and <em>another<\/em> one\./);
  assert.match(out, /<div class="lp-table"><table><thead><tr><th>Stage<\/th><th>Time<\/th><\/tr><\/thead><tbody><tr><td><strong>Interview<\/strong><\/td><td>3 hours<\/td><\/tr>/);
  assert.match(out, /<td>Report \(<a href="\/acme\/report">details<\/a>\)<\/td>/);
  assert.match(out, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(out, /href="javascript/);
});

test('rich text: platform files are not prefixed with the site address', () => {
  const out = rich('[Form](/assets/sites/acme/docs/form.pdf)');
  assert.match(out, /href="\/assets\/sites\/acme\/docs\/form\.pdf"/);
});

test('page CSS for tables, numbered and nested lists', () => {
  assert.match(html, /\.lp-body \.lp-table\{overflow-x:auto/);
  assert.match(html, /\.lp-body ol\{padding-left:22px/);
  assert.match(html, /\.lp-body ul\.lp-subl\{/);
});

test('lp-layouts: every new option is registered and opt-in', () => {
  assert.match(js, /siteWidth, headerItems, navActive, subPageNav, heroPortrait, featureBand, footerContact, footerDecor, pageBanner, pageBlocks, headerStack, textScale, logoThemed, darkSections, footerTextCols, editorialLooks, subPageAnchors\];/);
  assert.match(js, /if \(w >= 960 && w <= 1600\) de\.style\.setProperty\('--maxw', w \+ 'px'\); else de\.style\.removeProperty\('--maxw'\);/);
  assert.match(js, /var on = H\.ctaPlace === 'menu' && NM\.on === true && NM\.placement === 'bar'/);
  assert.match(js, /var on = NM\.activeStyle === 'fill';/);
  assert.match(js, /NM\.barMobile === 'hamburger'/);
  assert.match(js, /var cover = HS\.layout === 'cover';/);
  assert.match(js, /node\.classList\.toggle\('fstr-band', FS\.layout === 'band'\);/);
  assert.match(js, /var side = SV\.photoHeadSide === true;/);
  assert.match(js, /var noticeOn = M\.layout === 'notice';/);
  assert.match(js, /live\(F\.brandContact\)/);
  assert.match(js, /var on = C\.pageStyle === 'banner';/);
  assert.match(js, /node\.classList\.toggle\('tbl-feats-side', TB\.featuresSide === true\);/);
  // Sub-pages: menu bar first and keeps its background.
  assert.match(js, /node\.style\.setProperty\('order', '-1', 'important'\);/);
});

test('lp-layouts CSS: header items hidden on small screens; banner and band stack on phones', () => {
  assert.match(css, /@media\(max-width:1099px\)\{\.lpl-hitems\{display:none\}/);
  assert.match(css, /@media\(max-width:899px\)\{html\.lpl-bar-ham \[data-sec="navMenu"\]\{height:0!important/);
  assert.match(css, /@media\(max-width:760px\)\{\n  section\[data-sec="ctaBanner"\]\.cb-notice \.cbn\{grid-template-columns:1fr/);
  assert.match(css, /\.hsc\{position:relative;aspect-ratio:var\(--hsc-ratio,16\/6\)/);
  assert.match(css, /@media\(max-width:860px\)\{\n  \.hsc\{aspect-ratio:auto/);
});

test('editor: option rows, header card from the menu editor, lists, Branding card, rich switch', () => {
  assert.match(manage, /if\(spec\.sec\) sub=spec\.sec;/);
  assert.match(manage, /\['cover','Photo banner \\u2014 photo across the band, text over its left'\]/);
  for (const k of ['splitFit', 'splitBg', 'accentRule', 'nameCardTitle', 'nameCardText', 'nameCardX', 'nameCardY', 'coverRatio', 'coverFocus',
    'photoHeadSide', 'photoIconBadge', 'photoMore', 'photoLinkStyle', 'featuresSide', 'decorImage', 'activeStyle', 'barMobile', 'btnIcon', 'ctaPlace', 'itemsColor', 'itemsIconColor']) {
    assert.match(manage, new RegExp("k:'" + k + "'"), k);
  }
  assert.match(manage, /\['notice','Notice \\u2014 icon \+ heading \| text, full width'\]/);
  assert.match(manage, /featureStrip:\{title:'Strip layout'/);
  assert.match(manage, /\{sec:'header',title:'Header contact items & button'/);
  assert.match(manage, /headerItems:\{secId:'header',key:'items'/);
  assert.match(manage, /footerBrandContact:\{secId:'footer',key:'brandContact'/);
  assert.match(manage, /function lpMountSiteLayoutCard\(body,c\)\{/);
  assert.match(manage, /<input type="checkbox" id="lp-rich">/);
  assert.match(manage, /menu:'top',status:'draft',rich:true,/);
});

test('Source Serif Clinical font set: menu and buttons as typed', () => {
  const F = require('../assets/lp-fonts.js');
  assert.ok(F.ORDER.includes('clinical'));
  const c = F.css('clinical');
  assert.match(c, /--lp-font-head:"Source Serif 4"/);
  assert.match(c, /\.btn,\.hn-link,\.hn-txt,\.lpl-link,\.lpl-btn,\.hn-sub a\{text-transform:none!important\}/);
  assert.match(c, /\.nm-link,\.nm-sub-link/);
  // Other sets don't get the new rules.
  assert.doesNotMatch(F.css('jost'), /\.nm-link/);
  assert.match(read('manage.html'), /lp-fonts\.js\?v=6/);
});

test('About profile layout, quote banner, hero tagline: opt-in and editable', () => {
  // Layout code only runs for the new values.
  assert.match(js, /function aboutProfile\(node, ?C, ?AU\)/);
  assert.match(js, /classList\.toggle\('au-is-profile'/);
  assert.match(js, /hsp-tagline/);
  assert.match(js, /classList\.toggle\('hsp-eb-rule', on && HS\.eyebrowRule === true\)/);
  assert.match(js, /cbq/);
  // Pages built only from apps still get the sub-page menu bar.
  assert.match(js, /C\.pages\.some\(function \(pg\) \{ return pg && pg\.slug === seg; \}\)/);
  for (const c of ['.au-is-profile', '.aup-focus', '.aup-exp', '.aup-num', '.cb-quote', '.hsp-tagline', '.hsp-eb-rule']) {
    assert.ok(css.includes(c), c);
  }
  // Editor controls.
  assert.match(manage, /\['profile','Profile — background, focus card, expertise cards \+ side card'\]/);
  assert.match(manage, /\['quote','Quote \\u2014 large quote, divider, button'\]/);
  for (const k of ['tagline', 'eyebrowRule', 'focusTitle', 'focusIcon', 'focusIntro', 'expertiseTitle', 'qualsTitle',
    'summaryTitle', 'summaryIcon', 'summaryText', 'membershipsTitle', 'membershipsIcon', 'membershipsImage', 'btn1Icon']) {
    assert.match(manage, new RegExp("k:'" + k + "'"), k);
  }
  for (const l of ['aboutUsFocus', 'aboutUsExpertise', 'aboutUsMemberships']) assert.match(manage, new RegExp(l + ':\\{secId:\'aboutUs\''), l);
  // The AI composer never picks them.
  const L = read('lib/ai-composer/layouts.js');
  assert.match(L, /ctaBanner: \['', 'boxes', 'notice', 'quote'(, '[a-z]+')*\]/);
  assert.match(L, /aboutUs: \['profile'\]/);
});
