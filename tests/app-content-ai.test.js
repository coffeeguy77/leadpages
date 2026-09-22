'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const appAi = require('../assets/js/app-content-ai');
const { defaultBrainConfig } = require('../lib/brain/config');
const { DEFAULT_PROMPTS } = require('../lib/brain/prompts/defaults');
const { createBrain } = require('../lib/brain');
const { resetPlatformBrain, isAppContentEnabled } = require('../lib/brain/platform');

const CONTENT_APPS = [
  'hero', 'trustBar', 'services', 'serviceProcess', 'featureStrip', 'why', 'area',
  'serviceAreas', 'serviceAreaMap', 'reviews', 'reviewHighlights', 'customerReactions',
  'beforeAfter', 'beforeAfterFeed', 'responseCards', 'projectStats', 'activityCounter',
  'featuredProjects', 'projectFeed', 'jobsFeed', 'specialOffer', 'promotions', 'proofStream',
  'crew', 'certifications', 'estimateBuilder', 'quote', 'onlineQuote', 'finance', 'textBox',
  'aboutUs',
  'seoText', 'videoReels', 'activityTimeline', 'footer', 'emerg', 'searchCanvas',
  'emergencyAvailability', 'instaGallery', 'igProjectFeed', 'orderStorefront', 'bookingStorefront',
  'premiumGallery', 'scrollingSponsorBanner', 'mobileBar', 'lpFooter'
];

describe('app content AI', () => {
  beforeEach(() => {
    resetPlatformBrain();
  });
  afterEach(() => {
    delete process.env.BRAIN_APP_CONTENT;
    resetPlatformBrain();
  });

  it('covers content apps and skips title, FAQ, and sliders', () => {
    CONTENT_APPS.forEach((key) => {
      assert.ok(appAi.spec(key), key);
      assert.ok(appAi.writingBrief(key).length > 40, key);
    });
    assert.equal(appAi.spec('faq'), null);
    assert.equal(appAi.spec('heroSlider'), null);
    assert.equal(appAi.spec('heroBeforeAfter'), null);
    assert.equal(appAi.spec('splitHero'), null);
    assert.match(appAi.SKIP.faq, /FAQ/);
    assert.match(appAi.writingBrief('searchCanvas'), /Tab/);
    assert.match(appAi.writingBrief('services'), /Card|offer|Service/i);
  });

  it('keeps a long tab intro and bullets separate', () => {
    const d = appAi.normalizeDraft({
      summary: 'Sample',
      items: [{
        title: 'Ridge vents',
        label: 'Ridge vents',
        text: 'A ridge vent lets hot air leave along the peak of a metal roof. It suits long sheds and homes where the ridge is straight and the cladding is fixed, not tiled.',
        body: 'Installers cut the opening to the vent width, turn the edges up, and screw the unit through the recommended ribs.\n\nLeave the lower course of the roof intact so water still sheds past the opening.',
        bullets: ['Matches the roof pitch', 'No moving parts', 'Screws through the ribs', 'Does not replace a whirlybird on a short ridge']
      }]
    });
    assert.equal(d.items[0].bullets.length, 4);
    assert.match(d.items[0].text, /ridge vent/i);
    assert.match(d.items[0].body, /Installers cut/);
  });

  it('applies hero copy without dropping badge icons', () => {
    const cfg = {
      sections: {
        hero: {
          on: true,
          title: 'Old',
          badges: [{ icon: '✓', text: 'Old badge' }, { icon: '★', text: 'Second' }]
        }
      }
    };
    appAi.applyAppContent(cfg, 'hero', {
      heading: 'Metal roof ventilators',
      highlight: 'made in Australia',
      intro: 'Low-profile vents for corrugated metal roofs, supplied to roofers and builders.',
      items: [
        { title: 'Fits corrugated metal' },
        { title: 'Supply only or with flashings' }
      ]
    });
    assert.equal(cfg.sections.hero.title, 'Metal roof ventilators');
    assert.equal(cfg.sections.hero.titleHl, 'made in Australia');
    assert.equal(cfg.sections.hero.badges[0].icon, '✓');
    assert.equal(cfg.sections.hero.badges[0].text, 'Fits corrugated metal');
    assert.equal(cfg.sections.hero.badges.length, 2);
    assert.equal(cfg.sections.hero.badges[1].icon, '★');
  });

  it('replaces text-only service cards and keeps icons', () => {
    const cfg = {
      services: [
        { on: true, icon: '1', title: 'Roof repairs', body: 'Old' },
        { on: true, icon: '2', title: 'Guttering', body: 'Old' },
        { on: true, icon: '3', title: 'Leak detection', body: 'Old' }
      ],
      sections: {}
    };
    appAi.applyAppContent(cfg, 'services', {
      heading: 'Roof ventilation products',
      intro: 'We make metal roof ventilators for corrugated roofs.',
      items: [
        { title: 'Corrugated roof ventilators', text: 'A low-profile vent that lets heat out of a metal roof without a bulky turbine. Made for ribbed cladding, not tiles.' },
        { title: 'Custom flashings', text: 'Flashings cut to the rib so the vent sits tight and water keeps moving down the sheet.' }
      ]
    });
    assert.equal(cfg.services.length, 2);
    assert.equal(cfg.services[0].icon, '1');
    assert.equal(cfg.services[0].title, 'Corrugated roof ventilators');
    assert.match(cfg.services[0].body, /low-profile/);
    assert.equal(cfg.sections.services.heading, 'Roof ventilation products');
    assert.doesNotMatch(JSON.stringify(cfg.services), /Guttering|Leak detection/);
  });

  it('writes SearchCanvas header, intro, supporting copy, and bullets', () => {
    const cfg = {
      sections: {
        searchCanvas: {
          tabs: [{ id: 'keep', image: 'https://cdn.example/vent.jpg', label: 'Planning', intro: 'Generate with AI…' }]
        }
      }
    };
    appAi.applyAppContent(cfg, 'searchCanvas', {
      eyebrow: 'Products',
      heading: 'Metal roof ventilation',
      intro: 'What the vents do, and which roof they suit.',
      items: [{
        label: 'Ridge vents',
        title: 'Ridge vents for metal roofs',
        text: 'A ridge vent runs along the peak and lets hot air leave without a spinning head. It suits long sheds where the ridge is continuous.',
        body: 'The opening is turned up so water stays on the sheet. Fixings go through the ribs the cladding already uses.',
        bullets: ['Continuous ridge', 'No moving parts', 'Rib fixings', 'Not for tile roofs']
      }]
    });
    const tab = cfg.sections.searchCanvas.tabs[0];
    assert.equal(tab.id, 'keep');
    assert.equal(tab.image, 'https://cdn.example/vent.jpg');
    assert.equal(tab.label, 'Ridge vents');
    assert.match(tab.intro, /hot air/);
    assert.match(tab.content, /turned up/);
    assert.equal(tab.bullets.length, 4);
    assert.equal(cfg.sections.searchCanvas.header.heading, 'Metal roof ventilation');
    assert.doesNotMatch(tab.intro, /Generate with AI/);
  });

  it('does not wipe sponsor logos or mobile numbers', () => {
    const cfg = {
      sections: {
        scrollingSponsorBanner: {
          instances: [{ logos: [{ src: 'logo.png', name: 'Local club' }], heading: { title: 'Old' } }]
        },
        mobileBar: { buttons: { call: { on: true, label: 'Call', number: '0400000000' } } }
      }
    };
    appAi.applyAppContent(cfg, 'scrollingSponsorBanner', {
      eyebrow: 'With thanks',
      heading: 'Sponsors',
      intro: 'The businesses that keep this event on the road.'
    });
    appAi.applyAppContent(cfg, 'mobileBar', {
      items: [{ label: 'call', title: 'Call us' }]
    });
    assert.equal(cfg.sections.scrollingSponsorBanner.instances[0].logos[0].src, 'logo.png');
    assert.equal(cfg.sections.scrollingSponsorBanner.instances[0].heading.title, 'Sponsors');
    assert.equal(cfg.sections.mobileBar.buttons.call.number, '0400000000');
    assert.equal(cfg.sections.mobileBar.buttons.call.label, 'Call us');
  });

  it('refuses an unknown app', () => {
    assert.throws(() => appAi.applyAppContent({}, 'faq', { heading: 'No' }), /Unknown app/);
  });

  it('registers a Brain route, prompt, and default-on flag', async () => {
    const cfg = defaultBrainConfig();
    assert.equal(cfg.routes['content.app_section'].structured, true);
    assert.equal(cfg.flags.appContent, true);
    const prompt = DEFAULT_PROMPTS.find((p) => p.promptId === 'content.app_section' && p.status === 'active');
    assert.ok(prompt);
    assert.match(prompt.system, /NEGATIVE KEYWORDS/);
    assert.match(prompt.system, /No page title/);
    assert.equal(isAppContentEnabled(), true);
    process.env.BRAIN_APP_CONTENT = '0';
    resetPlatformBrain();
    assert.equal(isAppContentEnabled(), false);

    const brain = createBrain();
    const res = await brain.generateStructured({
      taskId: 'content.app_section',
      promptId: 'content.app_section',
      responseSchema: appAi.SCHEMA,
      input: {
        primaryKeywordHint: 'metal roof ventilators',
        location: 'Australia',
        negativeKeywords: 'roof repairs, guttering',
        extraInfo: 'We manufacture metal roof ventilators.',
        targets: 'Ridge vents, Turbine vents',
        writingBrief: appAi.writingBrief('searchCanvas'),
        brief: 'Primary search term: metal roof ventilators in Australia'
      }
    });
    assert.equal(res.ok, true);
    const draft = appAi.normalizeDraft(res.output);
    assert.ok(draft.items.length >= 1);
    assert.ok(draft.items[0].title);
  });

  it('editor mounts the panel from the shared script', () => {
    const html = fs.readFileSync(path.join(__dirname, '../manage.html'), 'utf8');
    assert.match(html, /\/assets\/js\/app-content-ai\.js/);
    assert.match(html, /LP_APP_AI\.mount/);
    assert.match(html, /\/api\/brain\/app-content/);
    const api = fs.readFileSync(path.join(__dirname, '../api/brain/app-content.js'), 'utf8');
    assert.match(api, /content\.app_section/);
    assert.match(api, /isAppContentEnabled/);
    assert.doesNotMatch(api, /anthropic|openai|gemini/i);
  });
});
