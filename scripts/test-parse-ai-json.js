const { parseAiJson, buildPrompt, validatePack } = require('../lib/trade-pack-utils');

const sample = {
  slug: 'coffee-cart-hire',
  category: 'Hire & Events',
  pack: {
    label: 'Coffee Cart Hire',
    tradeType: 'Mobile Barista',
    theme: { pipe: '#6B4226', hivis: '#D99A4E', steel: '#1C1510', safety: '#F6ECDD' },
    services: Array(6).fill({ on: true, icon: '☕', title: 'Service', body: 'Body text.' }),
    sections: {
      header: { cta: 'Speak to a Mobile Barista', button: 'Call now' },
      emerg: { text: '⚠ Peak dates book out fast.' },
      hero: {
        eyebrow: 'Coffee cart · Canberra',
        title: 'Real coffee,',
        titleHl: 'wheeled to you',
        sub: 'A proper barista.',
        badges: [
          { icon: '★', text: 'Trained' },
          { icon: '✓', text: 'Mobile' },
          { icon: '$', text: 'Fixed' },
          { icon: '⚡', text: 'Quick' },
        ],
      },
      services: { eyebrow: 'What we do', heading: 'Coffee for any crowd', intro: 'We cover the lot.' },
      why: {
        eyebrow: 'Why {business}',
        heading: 'Local crew',
        items: [
          { n: '01', title: 'Local', body: 'On time.' },
          { n: '★', title: 'Quality', body: 'Skilled.' },
          { n: '⌂', title: 'Turn-key', body: 'We bring gear.' },
          { n: '24/7', title: 'Flexible', body: 'Your schedule.' },
        ],
      },
      area: {
        eyebrow: 'Where',
        heading: 'Across {location}',
        intro: 'Anywhere.',
        suburbs: Array(10).fill('{location}'),
      },
      reviews: {
        eyebrow: 'Neighbours',
        heading: 'What locals say',
        items: [
          { who: 'Sarah M.', text: '"{{businessName}} was great."' },
          { who: 'James T.', text: '"Smooth setup."' },
          { who: 'Priya K.', text: '"Recommend."' },
        ],
      },
      quote: {
        eyebrow: 'Fast quote',
        sub: 'Tell us your date.',
        button: 'Send',
        formTitle: 'Quote',
        lblName: 'Name',
        lblPhone: 'Phone',
        lblSuburb: 'Suburb',
        lblDetail: 'Detail',
        successTitle: 'Got it',
        heading: 'Get a quote',
        lblJob: 'Event?',
        points: [{ text: 'No obligation' }, { text: 'Fast' }, { text: 'Clear' }],
        jobOptions: [
          { text: 'Wedding' },
          { text: 'Corporate' },
          { text: 'Party' },
          { text: 'Market' },
          { text: 'Office' },
        ],
      },
      faq: {
        eyebrow: 'FAQ',
        heading: 'Answers',
        items: [
          { q: 'Power?', a: 'Yes.' },
          { q: 'How many?', a: 'Plenty.' },
        ],
      },
      footer: {
        blurb: 'Summary',
        legal: 'Legal',
        services: [
          { label: 'Weddings', href: '#quote' },
          { label: 'Corp', href: '#quote' },
          { label: 'Parties', href: '#quote' },
          { label: 'Markets', href: '#quote' },
        ],
      },
    },
  },
};

const json = JSON.stringify(sample, null, 2);

function assert(name, fn) {
  try {
    fn();
    console.log('OK:', name);
  } catch (e) {
    console.error('FAIL:', name, e.message);
    process.exitCode = 1;
  }
}

assert('direct parse', () => {
  const p = parseAiJson(json);
  if (p.slug !== 'coffee-cart-hire') throw new Error('bad slug');
});

assert('markdown fence', () => {
  const p = parseAiJson('Here is the pack:\n```json\n' + json + '\n```\nDone.');
  if (!p.pack) throw new Error('missing pack');
});

assert('preamble + suffix', () => {
  const p = parseAiJson('Sure! ' + json + ' Hope that helps.');
  if (!p.pack.label) throw new Error('missing label');
});

assert('trailing commas', () => {
  const messy = '{"slug":"test","pack":{"label":"X","tradeType":"Y","theme":{"pipe":"#000"},"services":[{"on":true},{"on":true},{"on":true},{"on":true}],"sections":{"hero":{},"reviews":{},"quote":{}}},}';
  const p = parseAiJson(messy);
  if (p.slug !== 'test') throw new Error('bad slug after comma fix');
});

assert('validatePack', () => {
  const err = validatePack(sample);
  if (err) throw new Error(err);
});

assert('buildPrompt shape', () => {
  const prompt = buildPrompt('Coffee Cart Hire', 'Hire & Events');
  if (!prompt.includes('EXACTLY 6 of')) throw new Error('missing count wording');
  if (!prompt.includes('{business}')) throw new Error('missing business token');
  if (!prompt.includes('{location}')) throw new Error('missing location token');
  if (prompt.includes('items of')) throw new Error('old broken wording still present');
});

console.log('All parseAiJson tests passed.');
