const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const resolve = require('../lib/marketplace-catalog-resolve');

const root = path.join(__dirname, '..');

describe('marketplace catalog resolve', () => {
  it('maps marketing hub slugs to section demos', () => {
    const reviews = resolve.resolveFromStatic('reviews-trust');
    assert.equal(reviews.feature.section_key, 'reviews');
    assert.ok(resolve.hasPlayground(reviews.blocks));

    const promo = resolve.resolveFromStatic('promotions');
    assert.equal(promo.feature.section_key, 'promotions');
    assert.ok(resolve.hasPlayground(promo.blocks));
    const pg = promo.blocks.find((b) => b.block_type === 'playground');
    assert.ok(pg.payload.presets && pg.payload.presets.includes('weekly'));
    assert.ok(pg.payload.presets.includes('mystery'));

    const promoHero = resolve.resolveFromStatic('promotions-hero');
    assert.equal(promoHero.feature.section_key, 'promotions');
    assert.equal(promoHero.feature.name, 'Promotions Hero');
    assert.ok(promoHero.feature.hero_image_url);
    assert.ok(resolve.hasPlayground(promoHero.blocks));
    const pgHero = promoHero.blocks.find((b) => b.block_type === 'playground');
    assert.equal(pgHero.payload.section_key, 'promotions');
    assert.ok(pgHero.payload.presets.includes('weekly'));
  });

  it('emergency-cta remaps to emerg demo + editor presets', () => {
    const emerg = resolve.resolveFromStatic('emergency-cta');
    assert.ok(emerg);
    assert.equal(emerg.feature.section_key, 'emerg');
    assert.equal(emerg.feature.name, 'Emergency CTA');
    assert.ok(emerg.feature.hero_image_url);
    assert.ok(resolve.hasPlayground(emerg.blocks));
    const pg = emerg.blocks.find((b) => b.block_type === 'playground');
    assert.equal(pg.payload.section_key, 'emerg');
    assert.ok(pg.payload.presets.includes('urgent'));
    assert.ok(pg.payload.presets.includes('transparent'));

    const stale = resolve.enrichCatalogPayload(
      {
        id: '4',
        slug: 'emergency-cta',
        name: 'Emergency CTA',
        tagline: '24/7 urgent call-to-action bar',
        status: 'live',
        section_key: 'emergency-cta',
        hero_image_url: null
      },
      [{ block_type: 'playground', payload: { section_key: 'emergencyCta', presets: ['default'] } }],
      'emergency-cta'
    );
    assert.equal(stale.feature.section_key, 'emerg');
    assert.ok(stale.feature.hero_image_url);
    const pg2 = stale.blocks.find((b) => b.block_type === 'playground');
    assert.equal(pg2.payload.section_key, 'emerg');

    assert.ok(fs.existsSync(path.join(root, 'marketplace/demos/demo-emerg.html')));
    assert.ok(fs.existsSync(path.join(root, 'marketplace/demos/demo-emergencyCta.html')));
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-emerg.html'), 'utf8');
    assert.match(demo, /data-sec="emerg"/);
    assert.match(demo, /24\/7 emergency plumber/);
    assert.match(demo, /"sticky"\s*:\s*true/);

    const presets = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/emerg-type-presets.json'), 'utf8'));
    assert.equal(presets.length, 6);
    ['urgent', 'afterHours', 'burstPipe', 'stickyBrand', 'messageOnly', 'transparent']
      .forEach((t) => assert.ok(presets.some((p) => p.slug === t), 'missing emerg preset ' + t));

    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.emerg.some((f) => f.key === 'sections.emerg.text'));
    assert.ok(defs.emerg.some((f) => f.key === 'sections.emerg.callOn' && f.type === 'checkbox'));
    assert.ok(defs.emerg.some((f) => f.key === 'sections.emerg.sticky'));

    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /'emergency-cta'\s*:\s*\{/);
    assert.match(feat, /loadEmergTypePresets/);
    assert.match(feat, /demoFile = 'emerg'/);
    assert.match(feat, /secKey === 'emergencyCta'/);

    const compact = fs.readFileSync(path.join(root, 'assets/js/marketplace/marketplace-compact-editor.js'), 'utf8');
    assert.match(compact, /sectionKey === 'emerg'/);
  });

  it('promotions-hero remaps stale DB section_key to promotions demo', () => {
    const stale = resolve.enrichCatalogPayload(
      {
        id: '2',
        slug: 'promotions-hero',
        name: 'Promotions Hero',
        tagline: 'Full-width promotional hero band',
        status: 'live',
        section_key: 'promotions-hero',
        hero_image_url: null
      },
      [{ block_type: 'playground', payload: { section_key: 'promotions-hero', presets: ['default'] } }],
      'promotions-hero'
    );
    assert.equal(stale.feature.section_key, 'promotions');
    assert.equal(stale.feature.name, 'Promotions Hero');
    assert.ok(stale.feature.hero_image_url);
    const pg = stale.blocks.find((b) => b.block_type === 'playground');
    assert.equal(pg.payload.section_key, 'promotions');
    assert.ok(pg.payload.presets.includes('mystery'));
    assert.ok(fs.existsSync(path.join(root, 'marketplace/demos/demo-promotions.html')));
    assert.ok(fs.existsSync(path.join(root, 'marketplace/demos/demo-promotionsHero.html')));
    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /'promotions-hero'\s*:\s*\{/);
    assert.match(feat, /secKey === 'promotions-hero'/);
    assert.match(feat, /demoFile = 'promotions'/);
  });

  it('quote-lead-capture is a premium Bean Culture showcase (no playground)', () => {
    const quote = resolve.resolveFromStatic('quote-lead-capture');
    assert.equal(quote.feature.section_key, null);
    assert.equal(quote.feature.badge, 'Premium');
    assert.equal(quote.feature.access_type, 'premium_subscription');
    assert.ok(quote.feature.hero_image_url);
    assert.equal(resolve.hasPlayground(quote.blocks), false);
    const embed = quote.blocks.find((b) => b.block_type === 'demo_embed');
    assert.ok(embed);
    assert.equal(embed.payload.url, '/marketplace/demos/demo-beanCultureQuote.html');
    assert.ok(quote.blocks.some((b) => b.block_type === 'cta'));

    const stale = resolve.enrichCatalogPayload(
      { id: '1', slug: 'quote-lead-capture', name: 'Quote', status: 'live', section_key: 'onlineQuote' },
      [{ block_type: 'playground', payload: { section_key: 'onlineQuote', presets: ['default'] } }],
      'quote-lead-capture'
    );
    assert.equal(stale.feature.section_key, null);
    assert.equal(resolve.hasPlayground(stale.blocks), false);
    assert.ok(stale.blocks.some((b) => b.block_type === 'demo_embed'));

    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /premiumShowcase\s*:\s*true/);
    assert.match(feat, /demo-beanCultureQuote/);
    assert.match(feat, /Talk to LeadPages/);
    /* Relative /marketplace/demos/… URLs must pass safeUrl or the iframe never renders */
    assert.match(feat, /u\.charAt\(0\)==='\/'/);
    assert.match(feat, /case 'demo_embed':[\s\S]*?safeUrl\(p\.url\)/);
    assert.ok(fs.existsSync(path.join(root, 'marketplace/demos/demo-beanCultureQuote.html')));
    assert.ok(fs.existsSync(path.join(root, 'marketplace/bean-culture-quote-shell.json')));
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-beanCultureQuote.html'), 'utf8');
    assert.match(demo, /data-showcase="1"/);
    assert.match(demo, /bean-culture-quote-shell\.json/);
    const oq = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
    assert.match(oq, /blockSpend/);
    assert.match(oq, /loadShowcaseShell/);

    /* Simulate the client safeUrl used by demo_embed rendering */
    function safeUrl(u) {
      u = String(u || '').trim();
      if (!u) return '';
      if (/^https?:\/\//i.test(u)) return u;
      if (u.charAt(0) === '/' && u.charAt(1) !== '/' && u.indexOf('\\') < 0) return u;
      return '';
    }
    assert.equal(safeUrl('/marketplace/demos/demo-beanCultureQuote.html'), '/marketplace/demos/demo-beanCultureQuote.html');
    assert.equal(safeUrl('https://images.unsplash.com/x.jpg'), 'https://images.unsplash.com/x.jpg');
    assert.equal(safeUrl('//evil.example/x'), '');
    assert.equal(safeUrl('javascript:alert(1)'), '');
  });

  it('email-campaigns is a platform explainer with interactive demo embed', () => {
    const email = resolve.resolveFromStatic('email-campaigns');
    assert.equal(email.feature.section_key, null);
    assert.equal(resolve.hasPlayground(email.blocks), false);
    assert.ok(!email.blocks.some((b) => b.block_type === 'benefits'), 'no How it works cards');
    const embed = email.blocks.find((b) => b.block_type === 'demo_embed');
    assert.ok(embed);
    assert.match(embed.payload.url, /demo-emailCampaigns\.html/);
    assert.ok(email.blocks.some((b) => b.block_type === 'cta'));
    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.doesNotMatch(feat, /heading:'How it works'/);
    assert.doesNotMatch(feat, /heading:"How it works"/);
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-emailCampaigns.html'), 'utf8');
    assert.match(demo, /Demo only/);
    assert.match(demo, /Unsubscribed/);
    assert.match(demo, /SAMPLE_IMAGES|sample — no upload/i);
    assert.match(demo, /marcus\.t@example\.com/i);
    assert.doesNotMatch(demo, /type="file"/);
    assert.doesNotMatch(demo, /\/api\/send-campaign/);
  });

  it('enriches thin DB rows with playground + section_key', () => {
    const thin = resolve.enrichCatalogPayload(
      { id: '1', slug: 'activity-counter', name: 'Activity Counter', status: 'live', section_key: null },
      [{ block_type: 'rich_text', payload: { heading: 'x', text: 'y' } }],
      'activity-counter'
    );
    assert.equal(thin.feature.section_key, 'activityCounter');
    assert.ok(resolve.hasPlayground(thin.blocks));
  });

  it('feature page client falls back for hub slugs and keeps hero as image', () => {
    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /quote-lead-capture/);
    assert.match(feat, /reviews-trust/);
    assert.match(feat, /email-campaigns/);
    assert.match(feat, /demo-emailCampaigns\.html/);
    assert.match(feat, /loadFeature/);
    assert.match(feat, /ensurePlaygroundBlock/);
    assert.match(feat, /sell-templates\.json/);
    assert.match(feat, /fillHeroFromSell/);
    assert.match(feat, /Green hero media is always a still image/);
    assert.doesNotMatch(feat, /himg-demo-frame/);
    assert.match(feat, /special-offer-editor\.js/);
    assert.match(feat, /LPSpecialOfferEditor\.mount/);
  });

  it('fills missing hero_image_url from sell-templates', () => {
    const thin = resolve.enrichCatalogPayload(
      { id: '9', slug: 'promotions', name: 'Promotions', status: 'live', section_key: null, hero_image_url: null },
      [],
      'promotions'
    );
    assert.equal(thin.feature.section_key, 'promotions');
    assert.ok(thin.feature.hero_image_url);
    assert.match(thin.feature.hero_image_url, /^https:\/\//);
  });

  it('promotions ships type demos + manage-parity editor wiring', () => {
    const presets = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/promotions-type-presets.json'), 'utf8'));
    assert.equal(presets.length, 10);
    const types = presets.map((p) => p.slug);
    ['weekly', 'deadline', 'spots', 'seasonal', 'suburb', 'finance', 'firstTime', 'priority', 'socialProof', 'mystery']
      .forEach((t) => assert.ok(types.includes(t), 'missing type demo ' + t));
    assert.ok(fs.existsSync(path.join(root, 'marketplace/demos/demo-promotions.html')));
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-promotions.html'), 'utf8');
    assert.match(demo, /promotions-hero/);
    assert.match(demo, /"type"\s*:\s*"seasonal"/);
    assert.match(demo, /Winter hot water special/);
    assert.match(demo, /spotsRemaining/);
    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /promotions-editor\.js/);
    assert.match(feat, /LPPromotionsEditor\.mount/);
    assert.match(feat, /loadPromotionsTypePresets/);
    const ed = fs.readFileSync(path.join(root, 'assets/js/marketplace/promotions-editor.js'), 'utf8');
    assert.match(ed, /Weekly booking window/);
    assert.match(ed, /Mystery offer/);
    assert.match(ed, /Placement/);
  });

  it('activityCounter demo forces sections.on and shows stats', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-activityCounter.html'), 'utf8');
    assert.match(demo, /"activityCounter"\s*:\s*\{/);
    assert.match(demo, /"on"\s*:\s*true/);
    assert.match(demo, /"stats"\s*:\s*\[/);
  });

  it('catalog API uses resolve helper', () => {
    const api = fs.readFileSync(path.join(root, 'api/catalog.js'), 'utf8');
    assert.match(api, /marketplace-catalog-resolve/);
    assert.match(api, /enrichCatalogPayload/);
  });
});
