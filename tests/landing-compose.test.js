'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  slugify,
  composeBodyMarkdown,
  normalizeLandingDraft,
  LANDING_DRAFT_SCHEMA,
  stripDecorativeIcons,
  faqsToPageItems,
  stripFaqBlocks,
  normalizeHeroSlides,
  normalizeJobOptions
} = require('../lib/brain/landing-compose');
const { validateAgainstSchema } = require('../lib/brain/schema');

describe('landing-compose', () => {
  it('slugifies primary keywords', () => {
    assert.equal(
      slugify('Earthmoving Equipment Repairs Canberra'),
      'earthmoving-equipment-repairs-canberra'
    );
  });

  it('keeps FAQs out of body and appends CTA only', () => {
    const body = composeBodyMarkdown({
      bodyMarkdown: '## Heavy diesel machinery repairs\n\nWe fix plant on site.',
      faqs: [
        { question: 'Do you service excavators?', answer: 'Yes, excavators and loaders.' }
      ],
      ctaHeadline: 'Contact RTT Truck and Track',
      ctaBody: 'Call us to discuss your machine.'
    });
    assert.equal(/Frequently Asked Questions|\?\?\?/.test(body), false);
    assert.match(body, /## Contact RTT Truck and Track/);
    assert.match(body, /Call us to discuss/);
  });

  it('strips model-written FAQ sections from body (Marketplace FAQ owns Q&As)', () => {
    const body = composeBodyMarkdown({
      bodyMarkdown:
        'Intro about coffee cart hire.\n\n' +
        '## Frequently Asked Questions\n\n' +
        '??? How much does coffee cart hire cost?\n' +
        'Pricing depends on the event.\n\n' +
        '## Book Your Coffee Cart in Canberra Today\n\n' +
        'Get in touch for a quote.',
      faqs: [
        {
          question: 'How much does coffee cart hire in Canberra cost?',
          answer: 'Pricing depends on duration and guest numbers.'
        }
      ],
      ctaHeadline: 'Book Your Coffee Cart in Canberra Today',
      ctaBody: 'Get in touch with Bean Culture for a fast quote.'
    });
    assert.equal(/Frequently Asked Questions|\?\?\?|How much does coffee cart hire cost/.test(body), false);
    assert.match(body, /Intro about coffee cart hire/);
    assert.match(body, /## Book Your Coffee Cart in Canberra Today/);
    assert.match(body, /Get in touch with Bean Culture/);
  });

  it('maps faqs[] to Marketplace page items (q/a)', () => {
    assert.deepEqual(
      faqsToPageItems([
        { question: 'How much?', answer: 'It depends.' },
        { q: 'Do you travel?', a: 'Yes.' }
      ]),
      [
        { q: 'How much?', a: 'It depends.', on: true },
        { q: 'Do you travel?', a: 'Yes.', on: true }
      ]
    );
  });

  it('stripFaqBlocks removes FAQ heading and ??? markers', () => {
    const stripped = stripFaqBlocks(
      'Body copy.\n\n## Frequently Asked Questions\n\n??? Q?\nA.\n'
    );
    assert.equal(stripped, 'Body copy.');
  });

  it('strips leading H1 from body (H1 is a separate field)', () => {
    const body = composeBodyMarkdown({
      bodyMarkdown: '# Earthmoving Equipment Repairs Canberra\n\nIntro paragraph.',
      faqs: [],
      ctaHeadline: '',
      ctaBody: ''
    });
    assert.equal(body.startsWith('#'), false);
    assert.match(body, /Intro paragraph/);
  });

  it('normalizes a full draft with business name fallbacks', () => {
    const draft = normalizeLandingDraft(
      {
        primaryKeyword: 'Earthmoving Equipment Repairs Canberra',
        secondaryKeywords: ['Excavator repairs Canberra', 'Plant mechanic Canberra'],
        title: 'Earthmoving Equipment Repairs Canberra | RTT Truck and Track',
        slug: 'Earthmoving Equipment Repairs Canberra',
        meta: 'RTT Truck and Track provides earthmoving equipment repairs in Canberra.',
        h1: 'Earthmoving Equipment Repairs Canberra',
        bodyMarkdown:
          'When your earthmoving equipment breaks down, downtime costs money.\n\n' +
          '## Earthmoving equipment servicing\n\nRegular maintenance reduces breakdowns.',
        faqs: [
          {
            question: 'What machines do you repair?',
            answer: 'Excavators, loaders, skid steers and similar plant.'
          }
        ],
        ctaHeadline: 'Get in touch',
        ctaBody: 'Contact RTT Truck and Track to discuss your equipment.'
      },
      { businessName: 'RTT Truck and Track' }
    );

    assert.equal(draft.slug, 'earthmoving-equipment-repairs-canberra');
    assert.equal(draft.h1, 'Earthmoving Equipment Repairs Canberra');
    assert.match(draft.title, /Earthmoving Equipment Repairs Canberra/);
    assert.ok(draft.meta.length > 40 && draft.meta.length <= 160);
    assert.equal(/\?\?\?|Frequently Asked Questions/.test(draft.bodyMarkdown), false);
    assert.match(draft.bodyMarkdown, /## Get in touch/);
    assert.equal(draft.faqs.length, 1);
    assert.equal(draft.faqs[0].question, 'What machines do you repair?');
    assert.deepEqual(draft.secondaryKeywords[0], 'Excavator repairs Canberra');
  });

  it('strips decorative icons from copy', () => {
    assert.equal(stripDecorativeIcons('✅ Reliable service'), 'Reliable service');
  });

  it('LANDING_DRAFT_SCHEMA accepts a complete v3 payload', () => {
    const sample = {
      primaryKeyword: 'Earthmoving Equipment Repairs Canberra',
      secondaryKeywords: ['Heavy equipment repairs Canberra'],
      title: 'Earthmoving Equipment Repairs Canberra | RTT',
      slug: 'earthmoving-equipment-repairs-canberra',
      meta: 'Earthmoving equipment repairs and servicing in Canberra for excavators and loaders.',
      h1: 'Earthmoving Equipment Repairs Canberra',
      bodyMarkdown: 'Intro copy about earthmoving equipment repairs in Canberra.',
      faqs: [{ question: 'Q?', answer: 'A.' }],
      ctaHeadline: 'Get in touch',
      ctaBody: 'Call today.'
    };
    assert.equal(validateAgainstSchema(LANDING_DRAFT_SCHEMA, sample).ok, true);
  });

  it('falls back to keyword-matched hero slides and quote job options', () => {
    const draft = normalizeLandingDraft(
      {
        primaryKeyword: 'Blocked drain clearing Canberra',
        title: 'Blocked drain clearing Canberra',
        slug: 'blocked-drain-clearing-canberra',
        meta: 'Fast blocked drain clearing in Canberra.',
        h1: 'Blocked drain clearing Canberra',
        bodyMarkdown: 'We clear blocked drains across Canberra.',
        faqs: [],
        ctaHeadline: 'Get in touch',
        ctaBody: 'Call today.'
      },
      { businessName: 'Pipe Pros', location: 'Canberra' }
    );
    assert.ok(draft.heroSlides.length >= 2);
    assert.match(draft.heroSlides[0].heading, /Blocked drain/i);
    assert.ok(draft.jobOptions.length >= 3);
    assert.equal(draft.jobOptions[0].text, 'Blocked drain clearing Canberra');
    assert.match(draft.quoteHeading, /Blocked drain/i);
    assert.match(draft.quoteSub, /Canberra/);
  });

  it('normalizes model heroSlides and jobOptions when provided', () => {
    const slides = normalizeHeroSlides(
      [{ eyebrow: 'Local', heading: 'Hot water repairs', highlightText: 'same day', subText: 'Book today.' }],
      { primaryKeyword: 'Hot water repairs' }
    );
    assert.equal(slides.length, 1);
    assert.equal(slides[0].highlightText, 'same day');
    const jobs = normalizeJobOptions(['Hot water system', { label: 'Leaking tap' }], {
      primaryKeyword: 'Plumbing'
    });
    assert.deepEqual(
      jobs.map((j) => j.text),
      ['Hot water system', 'Leaking tap']
    );
  });

  it('LANDING_DRAFT_SCHEMA accepts heroSlides and jobOptions', () => {
    const sample = {
      primaryKeyword: 'Coffee cart hire Canberra',
      title: 'Coffee cart hire Canberra',
      slug: 'coffee-cart-hire-canberra',
      meta: 'Coffee cart hire for events in Canberra.',
      h1: 'Coffee cart hire Canberra',
      bodyMarkdown: 'Hire a coffee cart for your next event.',
      faqs: [{ question: 'Q?', answer: 'A.' }],
      ctaHeadline: 'Get a quote',
      ctaBody: 'Tell us about your event.',
      heroSlides: [
        {
          eyebrow: 'Events',
          heading: 'Coffee cart hire Canberra',
          highlightText: 'for your event',
          subText: 'Baristas, machine and setup included.'
        }
      ],
      jobOptions: ['Wedding coffee cart', { text: 'Corporate event' }],
      quoteHeading: 'Get a quote for coffee cart hire',
      quoteSub: 'Serving Canberra and nearby areas'
    };
    assert.equal(validateAgainstSchema(LANDING_DRAFT_SCHEMA, sample).ok, true);
  });
});
