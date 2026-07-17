'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  slugify,
  composeBodyMarkdown,
  normalizeLandingDraft,
  LANDING_DRAFT_SCHEMA,
  stripDecorativeIcons
} = require('../lib/brain/landing-compose');
const { validateAgainstSchema } = require('../lib/brain/schema');

describe('landing-compose', () => {
  it('slugifies primary keywords', () => {
    assert.equal(
      slugify('Earthmoving Equipment Repairs Canberra'),
      'earthmoving-equipment-repairs-canberra'
    );
  });

  it('appends FAQ markers and CTA when missing from body', () => {
    const body = composeBodyMarkdown({
      bodyMarkdown: '## Heavy diesel machinery repairs\n\nWe fix plant on site.',
      faqs: [
        { question: 'Do you service excavators?', answer: 'Yes, excavators and loaders.' }
      ],
      ctaHeadline: 'Contact RTT Truck and Track',
      ctaBody: 'Call us to discuss your machine.'
    });
    assert.match(body, /## Frequently Asked Questions/);
    assert.match(body, /\?\?\? Do you service excavators\?/);
    assert.match(body, /## Contact RTT Truck and Track/);
    assert.match(body, /Call us to discuss/);
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
    assert.match(draft.bodyMarkdown, /\?\?\? What machines do you repair\?/);
    assert.match(draft.bodyMarkdown, /## Get in touch/);
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
});
