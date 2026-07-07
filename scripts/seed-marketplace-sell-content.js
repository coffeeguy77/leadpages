#!/usr/bin/env node
/**
 * Print sell-template summary for marketplace catalog seeding.
 *
 * Source of truth for marketing copy: marketplace/app-content.json
 * Regenerate outputs: node scripts/build-marketplace-content.js
 * Seed catalog + apps to DB: node scripts/seed-marketplace-catalog.js
 *   (or Marketplace Admin → "Set up all apps")
 *
 * Apply to one feature: Marketplace Admin → feature → Page → "Apply sell template".
 *
 * Usage: node scripts/seed-marketplace-sell-content.js
 */
const fs = require('fs');
const path = require('path');

const templates = JSON.parse(fs.readFileSync(path.join(__dirname, '../marketplace/sell-templates.json'), 'utf8'));
const demos = fs.readdirSync(path.join(__dirname, '../marketplace/demos'))
  .filter((f) => f.startsWith('demo-') && f.endsWith('.html'))
  .map((f) => f.replace('demo-', '').replace('.html', ''));

console.log('Marketplace sell templates:', Object.keys(templates).length);
console.log('Demo HTML shells:', demos.length);
console.log('');
Object.keys(templates).sort().forEach((key) => {
  const t = templates[key];
  const hasDemo = demos.includes(key) ? 'demo ✓' : 'no demo';
  console.log('-', key, '→', t.name, '(' + hasDemo + ', ' + t.blocks.length + ' blocks)');
});
