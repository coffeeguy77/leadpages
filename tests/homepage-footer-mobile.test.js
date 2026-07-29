/**
 * Homepage / shared marketing footer: premium support banner, compact menus, single-line contacts.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(ROOT, 'home.html'), 'utf8');
const homeCss = fs.readFileSync(path.join(ROOT, 'assets/marketing-home.css'), 'utf8');
const footCss = fs.readFileSync(path.join(ROOT, 'assets/marketing-site-footer.css'), 'utf8');
const footJs = fs.readFileSync(path.join(ROOT, 'assets/marketing-site-footer.js'), 'utf8');

function loadFooterApi() {
  const sandbox = {
    window: {},
    document: {
      readyState: 'complete',
      querySelectorAll: function () { return []; },
      addEventListener: function () {}
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(footJs, sandbox);
  return sandbox.window.__mktSiteFooter;
}

test('shared footer module ships CSS + JS and homepage mounts it', () => {
  assert.match(home, /data-mkt-site-footer/);
  assert.match(home, /marketing-site-footer\.js/);
  assert.match(homeCss, /marketing-site-footer\.css/);
  assert.match(footCss, /\.mkt-site-footer/);
  assert.match(footJs, /data-mkt-site-footer/);
});

test('support block uses FreeSVG Australia outline + phone + email icons', () => {
  const api = loadFooterApi();
  const html = api.html;
  assert.match(html, /f-ico-au/);
  assert.match(html, /freesvg\.org\/australia-map-outline-vector-illustration/);
  assert.match(html, /class="f-support support"/);
  assert.match(html, /href="tel:\+61262232200"/);
  assert.match(html, /02 6223 2200/);
  assert.match(html, /href="mailto:hello@leadpages\.com\.au"/);
  assert.doesNotMatch(html, /1300 532 114/);
  assert.doesNotMatch(html, /📞/);
  assert.doesNotMatch(html, /✉/);
  assert.match(html, /viewBox="0 0 674\.71 628\.37"/);
  assert.equal(
    fs.existsSync(path.join(ROOT, 'assets/marketing-home/australia-outline.svg')),
    true
  );
});

test('support icons are stroke SVGs sized for readability', () => {
  const html = loadFooterApi().html;
  assert.match(html, /f-ico-au[\s\S]*stroke="currentColor"/);
  assert.match(html, /vector-effect="non-scaling-stroke"/);
  assert.match(html, /class="fphone"[\s\S]*stroke-width="2"/);
  assert.match(html, /class="email"[\s\S]*stroke-width="2"/);
  assert.match(footCss, /\.mkt-site-footer\s+\.f-support\s+\.f-ico[\s\S]*width:\s*22px/);
});

test('desktop support banner keeps heading, help, phone and email on single lines', () => {
  const html = loadFooterApi().html;
  assert.match(html, /<h4>Australian support<\/h4>/);
  assert.match(html, /We're here to help\./);
  assert.match(html, /f-support-lead/);
  assert.match(html, /f-support-contacts/);
  assert.match(footCss, /\.mkt-site-footer\s+\.f-support\s+h4[\s\S]*white-space:\s*nowrap/);
  assert.match(footCss, /\.mkt-site-footer\s+\.f-support\s+\.help[\s\S]*white-space:\s*nowrap/);
  assert.match(footCss, /\.mkt-site-footer\s+\.f-support\s+\.fphone[\s\S]*white-space:\s*nowrap/);
  assert.match(footCss, /\.mkt-site-footer\s+\.f-support\s+\.email[\s\S]*white-space:\s*nowrap/);
});

test('Australian support sits inline with footer menus in a wide premium column', () => {
  const html = loadFooterApi().html;
  assert.match(html, /footer-top/);
  assert.match(html, /class="f-nav"/);
  assert.match(html, /f-support-copy/);
  assert.match(html, /f-support-map/);
  /* Support is a sibling of nav inside footer-top — not below it */
  const top = html.slice(html.indexOf('footer-top'), html.indexOf('footer-bottom'));
  assert.match(top, /<nav class="f-nav"/);
  assert.match(top, /class="f-support support"/);
  assert.ok(top.indexOf('f-nav') < top.indexOf('f-support'), 'support after menus in the same row');
  assert.match(
    footCss,
    /\.mkt-site-footer\s+\.footer-top\s*\{[\s\S]*grid-template-columns:\s*minmax\(150px,\s*200px\)\s+minmax\(0,\s*1\.05fr\)\s+minmax\(320px,\s*2\.1fr\)/
  );
  assert.match(footCss, /\.mkt-site-footer\s+\.f-nav\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(96px,\s*max-content\)\)/);
  assert.match(footCss, /\.mkt-site-footer\s+\.f-support\s*\{[\s\S]*border-radius:\s*18px/);
  assert.doesNotMatch(footCss, /\.mkt-site-footer\s+\.f-support\s*\{[^}]*margin-top:\s*28px/);
});

test('support icons and map remain in the banner', () => {
  assert.match(footCss, /\.mkt-site-footer\s+\.f-support-map\s*\{/);
  assert.match(footCss, /\.mkt-site-footer\s+\.f-support\s+\.f-ico-au[\s\S]*max-width:\s*120px/);
});

test('mobile footer stacks menus two-up and keeps support readable', () => {
  assert.match(
    footCss,
    /@media \(max-width: 720px\)[\s\S]*\.mkt-site-footer\s+\.f-nav\s*\{[\s\S]*grid-template-columns:\s*1fr 1fr/
  );
  assert.match(
    footCss,
    /\.mkt-site-footer\s+\.f-support-contacts\s*\{[\s\S]*flex-direction:\s*column/
  );
});

test('footer bottom keeps tagline, ABN, and legal links', () => {
  const html = loadFooterApi().html;
  assert.match(html, /class="f-tagline"/);
  assert.match(html, /The One website\./);
  assert.match(html, /Everything/);
  assert.match(html, /connected\./);
  assert.match(html, /class="f-abn"[^>]*>[\s\S]*class="f-abn-label">ABN<\/span>[\s\S]*class="f-abn-num">33&nbsp;600&nbsp;754&nbsp;676/);
  assert.match(html, /class="f-bottom-meta"/);
  assert.match(footCss, /\.mkt-site-footer\s+\.f-tagline\s*\{/);
  assert.match(footCss, /\.mkt-site-footer\s+\.f-bottom-meta\s*\{[\s\S]*justify-content:\s*space-between/);
  assert.match(footCss, /\.mkt-site-footer\s+\.f-links\s*\{[\s\S]*margin-left:\s*auto/);
});

test('key marketing pages mount the shared footer (not partner-website shells)', () => {
  const pages = [
    'marketplace.html',
    'marketplace-feature.html',
    'partners.html',
    'pricing.html',
    'privacy-policy.html',
    'terms-of-use.html',
    'instagram-data-policy.html',
    'showcase.html',
    'find-a-partner.html',
    'resources.html'
  ];
  pages.forEach(function (file) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(src, /data-mkt-site-footer/, file + ' mount');
    assert.match(src, /marketing-site-footer\.js/, file + ' script');
    assert.match(src, /marketing-site-footer\.css/, file + ' css');
  });
  const partnerLanding = fs.readFileSync(path.join(ROOT, 'lib/partner-landing.js'), 'utf8');
  assert.doesNotMatch(partnerLanding, /data-mkt-site-footer/);
  assert.doesNotMatch(partnerLanding, /marketing-site-footer/);
});

test('connected tools stay two-up and elevated on mobile', () => {
  assert.match(homeCss, /\.connected-mobile\s*\{[\s\S]*grid-template-columns:\s*1fr 1fr/);
  assert.doesNotMatch(
    homeCss,
    /\.cap-grid,\s*\.partner-grid,\s*\.reassure,\s*\.connected-mobile/
  );
  assert.match(homeCss, /\.connected-mobile \.cnode\s*\{[\s\S]*border-radius:\s*16px/);
});
