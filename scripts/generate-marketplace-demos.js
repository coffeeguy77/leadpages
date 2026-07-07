#!/usr/bin/env node
/**
 * Generate marketplace/demos/demo-{section_key}.html shells from trade.template.json.
 * Skips files that already exist. Run: node scripts/generate-marketplace-demos.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = JSON.parse(fs.readFileSync(path.join(ROOT, 'trade.template.json'), 'utf8')).html;
const mg = fs.readFileSync(path.join(ROOT, 'manage.html'), 'utf8');
const m = mg.match(/const DEFAULT_TRADE_SECTIONS=(\{[\s\S]*?\n  \});\n  const TRADE_PRESETS/);
if (!m) {
  console.error('Could not parse DEFAULT_TRADE_SECTIONS from manage.html');
  process.exit(1);
}
const DEFAULT_TRADE_SECTIONS = eval('(' + m[1] + ')');

const re = /<section[^>]*data-sec="([a-zA-Z][a-zA-Z0-9]*)"[^>]*>([\s\S]*?)<\/section>/g;
const sections = {};
let match;
while ((match = re.exec(html))) sections[match[1]] = match[2].trim();

const demosDir = path.join(ROOT, 'marketplace', 'demos');
const existing = new Set(
  fs.readdirSync(demosDir)
    .filter((f) => f.startsWith('demo-') && f.endsWith('.html'))
    .map((f) => f.replace('demo-', '').replace('.html', ''))
);

const extras = {
  featuredProjects:
    '<div id="fp-lightbox" class="fp-lb"><div class="fp-lb-back"></div><div class="fp-lb-stage"><button type="button" class="fp-lb-close" aria-label="Close">×</button><button type="button" class="fp-lb-nav fp-lb-prev" aria-label="Previous">‹</button><img class="fp-lb-img" src="" alt="Project photo"><button type="button" class="fp-lb-nav fp-lb-next" aria-label="Next">›</button><div class="fp-lb-count"></div></div></div>',
  projectFeed: `<div id="pf-lightbox" role="dialog" aria-modal="true" aria-hidden="true">
  <div class="pf-lb-backdrop"></div>
  <div class="pf-lb-panel">
    <button type="button" class="pf-lb-close" aria-label="Close">×</button>
    <div class="pf-lb-media"></div>
    <div class="pf-lb-side"><div class="pf-lb-body"></div><div class="pf-lb-actions"></div></div>
  </div>
</div>`
};

const skip = new Set(['promotions-hero', 'promotions-inline', 'emerg', 'footer', 'header', 'seoTokens']);
const marketplaceSections = Object.keys(sections).filter((k) => !skip.has(k));

let created = 0;
let skipped = 0;
for (const key of marketplaceSections) {
  if (existing.has(key)) {
    skipped++;
    continue;
  }
  const inner = sections[key];
  const secCfg = DEFAULT_TRADE_SECTIONS[key];
  const siteConfig = { sections: {} };
  if (secCfg) siteConfig.sections[key] = Object.assign({ on: true }, secCfg);
  if (key === 'hero' || key === 'quote' || key === 'projectFeed') siteConfig.phone = '0261000000';

  const file = `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="./demo-shared.css">
<script src="https://www.leadpages.com.au/icons.js"></script>
</head>
<body>
<main id="top">
<section data-sec="${key}" class="section">
${inner}
</section>
</main>
${extras[key] || ''}
<script>
var SITE_CONFIG=${JSON.stringify(siteConfig)};
</script>
<script src="./demo-shared.js"></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(demosDir, 'demo-' + key + '.html'), file);
  created++;
  console.log('created demo-' + key + '.html');
}
console.log('Done: created', created, 'skipped existing', skipped, 'of', marketplaceSections.length, 'sections');
