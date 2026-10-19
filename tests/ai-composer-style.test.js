'use strict';

/**
 * AI Composer — site style (fonts, buttons, header, nav, light/dark bands), photo
 * clean-up and the logo check. lib/ai-composer/{plan,build-config}.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePlan, sanitizeClientPlan, cleanStyle, photoCheckItems, applyPhotoCheck } = require('../lib/ai-composer/plan');
const { normalizeFill, buildSiteConfig } = require('../lib/ai-composer/build-config');

const DESIGN_URL = 'https://res.cloudinary.com/dzx6x1hou/image/upload/v1790000000/leadpages/ai-composer/202610/design-abc.png';
const DESIGN = { url: DESIGN_URL, width: 1440, height: 3000 };

test.describe('AI Composer — site style', () => {
  test('cleanStyle keeps only supported fonts, shapes and tones; nav needs real section ids', () => {
    const secs = [{ id: 's1' }, { id: 's2' }];
    const st = cleanStyle({ fontSet: 'Montserrat', buttonShape: 'SQUARE', headerTone: 'light', headerButton: 'Book a consultation', quoteTone: 'grey', footerTone: 'dark',
      nav: [{ label: 'Kitchens', sectionId: 's2' }, { label: 'Blog', sectionId: 's9' }, { label: '' }] }, secs);
    assert.deepEqual(st, { fontSet: 'montserrat', buttonShape: 'square', headerTone: 'light', headerButton: 'Book a consultation', quoteTone: '', footerTone: 'dark',
      nav: [{ label: 'Kitchens', sectionId: 's2' }, { label: 'Blog', sectionId: '' }] });
    assert.equal(cleanStyle({ fontSet: 'comic-sans', buttonShape: 'blob' }, []).fontSet, '');
    assert.equal(cleanStyle(null, []).buttonShape, '');
  });

  function build(style, extra) {
    const plan = sanitizeClientPlan(Object.assign({
      design: DESIGN, businessName: 'Joinery Co', theme: { pipe: '#e3061b', hivis: '#e3061b', steel: '#1a1a1a' }, style,
      photos: [{ id: 'p1', sectionId: 's1', px: { x: 700, y: 0, w: 700, h: 600 } }],
      sections: [
        { id: 's1', appKey: 'heroSlider', layout: 'split', rows: { y0: 0, y1: 700 } },
        { id: 's2', appKey: 'specialOffer', layout: 'banner', rows: { y0: 700, y1: 1000 } },
        { id: 's3', appKey: 'featuredProjects', layout: 'cards', rows: { y0: 1000, y1: 1500 } },
        { id: 's4', appKey: 'quote', rows: { y0: 1500, y1: 2500 } },
        { id: 's5', appKey: 'footer', rows: { y0: 2500, y1: 3000 } }
      ]
    }, extra || {}));
    const fills = normalizeFill({ apps: [
      { appKey: 'heroSlider', fields: {}, lists: { 'sections.heroSlider.slides': [{ heading: 'Kitchens', imageUrl: 'p1', primaryCtaText: 'Start your project', secondaryCtaText: 'Explore our work' }] } },
      { appKey: 'specialOffer', fields: { 'sections.specialOffer.heading': 'Red Hill Residence' }, lists: {} },
      { appKey: 'featuredProjects', fields: { 'sections.featuredProjects.heading': 'Recent work' }, lists: { 'sections.featuredProjects.projects': [{ title: 'Oak', location: 'Contemporary' }] } },
      { appKey: 'quote', fields: { 'sections.quote.heading': 'Talk to us' }, lists: {} },
      { appKey: 'footer', fields: { 'sections.footer.blurb': 'Made locally.' }, lists: {} }
    ] }, plan.sections, plan);
    return buildSiteConfig(plan, fills, {});
  }

  test('style becomes editor settings: font, buttons, light header, nav, hero buttons, light bands', () => {
    const cfg = build({ fontSet: 'montserrat', buttonShape: 'square', headerTone: 'light', headerButton: 'Book a consultation', quoteTone: 'light', footerTone: 'light',
      nav: [{ label: 'Projects', sectionId: 's3' }, { label: 'Contact', sectionId: 's4' }, { label: 'Blog', sectionId: '' }] });
    assert.equal(cfg.fontSet, 'montserrat');
    assert.equal(cfg.buttonShape, 'square');
    assert.equal(cfg.sections.header.button, 'Book a consultation');
    assert.equal(cfg.sections.header.btnBg, '#e3061b');
    assert.equal(cfg.logo.headerBg, '#FFFFFF');
    const nav = cfg.sections.navMenu;
    assert.equal(nav.on, true);
    assert.equal(nav.style, 'links');
    assert.equal(nav.fg, '#1A1A1A', 'dark links on a light header');
    assert.deepEqual(nav.items.map((i) => i.label + ' ' + i.url), ['Projects #featuredProjects', 'Contact #quote'], 'links with no section are left out');
    const s0 = cfg.sections.heroSlider.slides[0];
    assert.equal(s0.primaryCtaBg, '#e3061b', 'split hero main button gets the brand colour');
    assert.equal(s0.secondaryCtaAction, 'scroll');
    assert.equal(s0.secondaryCtaTarget, 'featuredProjects');
    assert.equal(cfg.sections.quote.appearance.containerBg, '#FFFFFF');
    assert.equal(cfg.sections.footer.bg, '#FFFFFF');
    assert.deepEqual(cfg.sections.specialOffer.points, [{ on: false, text: '' }], 'no sample offer points');
    assert.equal(cfg.sections.featuredProjects.projects[0].location, 'Contemporary');
  });

  test('without a style the site keeps the template look (no font, header or nav changes)', () => {
    const cfg = build(undefined);
    assert.ok(!('fontSet' in cfg));
    assert.ok(!cfg.sections.navMenu || cfg.sections.navMenu.on !== true);
    assert.ok(!cfg.logo || !cfg.logo.headerBg);
    assert.ok(!cfg.sections.quote.appearance);
    assert.equal(cfg.sections.header.on, true);
  });

  test('a dark header gets white nav links; a single nav link is not worth a menu', () => {
    const dark = build({ headerTone: 'dark', nav: [{ label: 'Projects', sectionId: 's3' }, { label: 'Contact', sectionId: 's4' }] });
    assert.equal(dark.sections.navMenu.fg, '#FFFFFF');
    const one = build({ nav: [{ label: 'Projects', sectionId: 's3' }] });
    assert.ok(!one.sections.navMenu || one.sections.navMenu.on !== true);
  });
});

test.describe('AI Composer — photo clean-up and logo', () => {
  test('thin strips and crops mostly inside a bigger crop are dropped', () => {
    const plan = normalizePlan({
      businessName: 'Co', theme: {}, gaps: [],
      sections: [{ id: 's1', appKey: 'textBox', startTile: 1, startPct: 0, endTile: 1, endPct: 100 }],
      photos: [
        { id: 'a', sectionId: 's1', tile: 1, x: 50, y: 10, w: 45, h: 60, role: 'team' },
        { id: 'b', sectionId: 's1', tile: 1, x: 55, y: 12, w: 35, h: 20, role: 'team' },
        { id: 'c', sectionId: 's1', tile: 1, x: 0, y: 80, w: 95, h: 4, role: 'card' },
        { id: 'd', sectionId: 's1', tile: 1, x: 0, y: 85, w: 95, h: 6, role: 'background' }
      ]
    }, { url: DESIGN_URL, width: 1440, height: 1200 });
    assert.equal(plan.photos.length, 2, JSON.stringify(plan.photos.map((p) => [p.description, p.px])));
    assert.ok(plan.photos.some((p) => p.px.w > 500 && p.px.h > 500), 'the big portrait is kept');
  });

  test('the logo is checked with a wide window and its new box replaces the old one', () => {
    const plan = sanitizeClientPlan({ design: DESIGN, businessName: 'Co', sections: [], photos: [], logo: { px: { x: 20, y: 10, w: 100, h: 40 } } });
    const items = photoCheckItems(plan, ['logo']);
    assert.equal(items.length, 1);
    assert.ok(items[0].logo);
    assert.ok(items[0].ctx.w >= 160, 'context window is much wider than the first box');
    const res = applyPhotoCheck(plan, items, { photos: [{ id: 'logo', keep: true, x: 0, y: 0, w: 100, h: 100 }] });
    assert.ok(res.logo.px.w > 100, 'wider logo box');
    assert.match(res.logo.url, /c_crop/);
  });
});
