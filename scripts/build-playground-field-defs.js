#!/usr/bin/env node
/**
 * Normalize playground-field-defs.json paths to v1 site_config keys.
 * Usage: node scripts/build-playground-field-defs.js
 */
const fs = require('fs');
const path = require('path');
const pfp = require('../lib/playground-field-paths');

const ROOT = path.join(__dirname, '..');
const DEFS = path.join(ROOT, 'marketplace', 'playground-field-defs.json');

const raw = JSON.parse(fs.readFileSync(DEFS, 'utf8'));
const fixed = pfp.fixAllFieldDefs(raw);
fs.writeFileSync(DEFS, JSON.stringify(fixed, null, 2) + '\n');
console.log('Normalized field defs →', path.relative(ROOT, DEFS));
