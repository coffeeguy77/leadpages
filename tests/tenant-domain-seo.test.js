'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const {
  isTenantCustomDomain,
  isPlatformOnlyPath,
  tenantRobotsTxt,
  platformRobotsTxt,
} = require('../lib/tenant-domain-seo');

describe('tenant custom domain SEO', () => {
  it('classifies primary vs custom hosts', () => {
    assert.equal(isTenantCustomDomain('www.leadpages.com.au'), false);
    assert.equal(isTenantCustomDomain('app.leadpages.com.au'), false);
    assert.equal(isTenantCustomDomain('yassvalleylandscaping.com.au'), true);
    assert.equal(isTenantCustomDomain('www.yassvalleylandscaping.com.au'), true);
  });

  it('blocks platform-only paths on custom domains', () => {
    assert.equal(isPlatformOnlyPath('/orders'), true);
    assert.equal(isPlatformOnlyPath('/manage'), true);
    assert.equal(isPlatformOnlyPath('/seo-sitemap.xml'), true);
    assert.equal(isPlatformOnlyPath('/demo/sitemap.xml'), true);
    assert.equal(isPlatformOnlyPath('/water-tanks-yass'), false);
    assert.equal(isPlatformOnlyPath('/order-portal'), false);
    assert.equal(isPlatformOnlyPath('/sitemap.xml'), false);
  });

  it('tenant robots.txt points at tenant sitemap only', () => {
    const txt = tenantRobotsTxt('https://www.yassvalleylandscaping.com.au');
    assert.match(txt, /Sitemap: https:\/\/www\.yassvalleylandscaping\.com\.au\/sitemap\.xml/);
    assert.match(txt, /Disallow: \/orders/);
    assert.match(txt, /Disallow: \/seo-sitemap\.xml/);
    assert.match(txt, /Disallow: \/order-portal/);
    assert.doesNotMatch(txt, /leadpages\.com\.au\/seo-sitemap/);
  });

  it('platform robots.txt unchanged for marketing host', () => {
    const txt = platformRobotsTxt();
    assert.match(txt, /marketing-sitemap\.xml/);
    assert.match(txt, /seo-sitemap\.xml/);
  });
});

describe('orders embed layout', () => {
  it('uses 25/75 split and flex cart in embed mode', () => {
    const html = fs.readFileSync(path.join(ROOT, 'orders.html'), 'utf8');
    assert.match(html, /body\.embed \.side\{[^}]*flex:0 0 25%/);
    assert.match(html, /body\.embed \.main\{[^}]*flex:1 1 75%/);
    assert.match(html, /\.side-order-cart\{[^}]*flex:1 1 auto/);
    assert.match(html, /\.side-nav-wrap\{flex:0 1 auto/);
    assert.doesNotMatch(html, /body\.embed \.side\{[^}]*flex:0 0 200px/);
  });
});
