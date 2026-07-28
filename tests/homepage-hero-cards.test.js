'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'home.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/marketing-home.css'), 'utf8');

test('hero uses Bean Culture mockups without Harbour overlay', function () {
  assert.match(home, /hero-bean-culture-desktop\.jpg/);
  assert.match(home, /hero-bean-culture-mobile\.jpg/);
  assert.doesNotMatch(home, /hero-harbour-plumbing/);
  assert.doesNotMatch(home, /Reliable plumbing/);
  assert.doesNotMatch(home, /mock-cap/);
  assert.ok(fs.existsSync(path.join(root, 'assets/marketing-home/hero-bean-culture-desktop.jpg')));
  assert.ok(fs.existsSync(path.join(root, 'assets/marketing-home/hero-bean-culture-mobile.jpg')));
});

test('hero metric cards are equal, compact, and coloured', function () {
  assert.match(css, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.metric-calls/);
  assert.match(css, /\.metric-ads/);
  assert.match(css, /\.hero-dock/);
  assert.match(home, /si-gads/);
  assert.match(home, /140\+ reviews/);
  assert.match(home, /aria-label="5 stars"/);
  assert.match(home, />4\.8</);
});

test('phone bottom aligns with metric cards dock', function () {
  assert.match(css, /\.hero-dock[\s\S]*\.phone[\s\S]*bottom:\s*0/);
  assert.match(home, /class="hero-dock"/);
  const dock = home.split('class="hero-dock"')[1].split('</section>')[0];
  assert.match(dock, /class="metrics"/);
  assert.match(dock, /class="phone"/);
});
