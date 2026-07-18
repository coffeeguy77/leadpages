'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

describe('Website Studio Phase 7 — UX assets', () => {
  it('ships wizard HTML with required steps and sticky bar', () => {
    const html = fs.readFileSync(path.join(ROOT, 'theme-studio-v2.html'), 'utf8');
    assert.match(html, /website-studio\.css/);
    assert.match(html, /website-studio\.js/);
    assert.match(html, /lp-ai-icons\.(js|css)/);
    assert.match(html, /lp-logo\.(js|css)/);
    assert.match(html, /id="ws-step-1"/);
    assert.match(html, /id="ws-step-2"/);
    assert.match(html, /id="ws-step-3"/);
    assert.match(html, /id="ws-step-4"/);
    assert.match(html, /id="ws-step-5"/);
    assert.match(html, /Generate 3 Website Concepts/);
    assert.match(html, /id="ws-actionbar"/);
    assert.match(html, /id="ws-gen-overlay"/);
    assert.match(html, /id="ws-device-toggle"/);
    // Brief field IDs preserved for API collectBrief
    for (const id of [
      'businessName',
      'industry',
      'specialisation',
      'location',
      'audience',
      'desiredStyle',
      'conversionGoal',
      'mainServices',
      'differentiators',
      'notes'
    ]) {
      assert.match(html, new RegExp('id="' + id + '"'));
    }
  });

  it('AI icon library exposes monochrome stroke icons', () => {
    const js = fs.readFileSync(path.join(ROOT, 'assets/lp-ai-icons.js'), 'utf8');
    const css = fs.readFileSync(path.join(ROOT, 'assets/lp-ai-icons.css'), 'utf8');
    for (const name of ['brain', 'wand', 'brush', 'layout', 'image', 'sparkles', 'rocket', 'website', 'search', 'typography']) {
      assert.match(js, new RegExp(name + '\\s*:'));
    }
    assert.match(js, /LPAiIcons/);
    assert.match(css, /currentColor/);
    assert.match(css, /stroke-dashoffset/);
    assert.match(css, /prefers-reduced-motion/);
    assert.doesNotMatch(css, /lottie/i);
  });

  it('optional Built with LeadPages component is reusable and opt-in', () => {
    const js = fs.readFileSync(path.join(ROOT, 'assets/lp-built-with.js'), 'utf8');
    const css = fs.readFileSync(path.join(ROOT, 'assets/lp-built-with.css'), 'utf8');
    assert.match(js, /LPBuiltWith/);
    assert.match(js, /Built with LeadPages/);
    assert.match(css, /\.lp-built-with/);
  });

  it('studio JS maps apps to human labels and does not import composer libs', () => {
    const js = fs.readFileSync(path.join(ROOT, 'assets/website-studio.js'), 'utf8');
    assert.match(js, /Product Showcase|Appointment Booking|Client Reviews/);
    assert.match(js, /Luxury Editorial|Premium Conversion|Boutique Experience/);
    assert.match(js, /Understanding your business/);
    assert.doesNotMatch(js, /require\(['\"]\.\.\/lib\/website-composer/);
    assert.doesNotMatch(js, /require\(['\"]\.\.\/lib\/theme-studio\/generate/);
  });
});
