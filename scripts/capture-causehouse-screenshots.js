#!/usr/bin/env node
/**
 * Capture Cause House partner theme screenshots at common breakpoints.
 */
const fs = require('fs');
const path = require('path');
const { build } = require('../lib/partner-templates/causehouse');
const { resolvePartnerThemeContent } = require('../lib/partner-website/resolver');
const { buildWebCultureWebsiteProfile } = require('../lib/partner-website/web-culture-profile');
const { validateWebsiteProfile } = require('../lib/partner-website/validate');

const OUT_DIR = path.join(__dirname, '..', 'design-handoff', 'causehouse-screenshots');
const WIDTHS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-320', width: 320, height: 568 }
];

const demos = [
  { slug: 'demo-tradie', business_name: 'Tradie Pro', config: { trade: 'Trades', scope: { description: 'A clear services website for local trade businesses.', items: [{ text: 'Quote forms' }, { text: 'Service areas' }] }, showcase: { image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80' } } },
  { slug: 'demo-cafe', business_name: 'Cafe Demo', config: { trade: 'Hospitality', scope: { description: 'Menus, bookings and atmosphere for hospitality venues.', items: [{ text: 'Bookings' }, { text: 'Menus' }] }, showcase: { image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80' } } },
  { slug: 'demo-legal', business_name: 'Legal Practice', config: { trade: 'Professional services', scope: { description: 'Credibility-first website for professional service firms.', items: [{ text: 'Contact forms' }, { text: 'Team profiles' }] }, showcase: { image: 'https://images.unsplash.com/photo-1486406146926-c627a92fd1b2?w=1200&q=80' } } }
];

function buildHtml() {
  const wp = validateWebsiteProfile(buildWebCultureWebsiteProfile());
  const prof = {
    partner_id: 'wc',
    showcase_headline: wp.positioning.heroHeadline,
    showcase_config: { templateKey: 'causehouse', websiteProfile: wp }
  };
  const partner = {
    id: 'wc',
    display_name: 'Shaun Matthews',
    email: 'hello@webculture.example',
    phone: '02 6100 0000'
  };
  const content = resolvePartnerThemeContent({ prof, partner, directory: null, demos, base: 'leadpages.com.au' });
  return build(prof, partner, demos, 'leadpages.com.au', { themeContent: content });
}

async function capture() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const html = buildHtml();
  const htmlPath = path.join(OUT_DIR, 'preview.html');
  fs.writeFileSync(htmlPath, html, 'utf8');

  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    for (const spec of WIDTHS) {
      const page = await browser.newPage();
      await page.setViewport({ width: spec.width, height: spec.height, deviceScaleFactor: 1 });
      await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      const outPath = path.join(OUT_DIR, spec.name + '.png');
      await page.screenshot({ path: outPath, fullPage: true });
      await page.close();
      console.log('Wrote', outPath);
    }
  } finally {
    await browser.close();
  }
}

capture().catch(function(err) {
  console.error(err);
  process.exit(1);
});
