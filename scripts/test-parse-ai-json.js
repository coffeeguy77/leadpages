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

assert('smart quotes', () => {
  const messy = '{“slug”:“diesel-mechanic”,“category”:“Auto”,“pack”:{“label”:“Diesel Mechanic”,“tradeType”:“Diesel Mechanic”,“theme”:{“pipe”:“#1a1a1a”,“hivis”:“#c5e13f”,“steel”:“#0b0b0b”,“safety”:“#f4f1ea”},“services”:[{"on":true,"icon":"🛠","title":"Service","body":"Body."},{"on":true,"icon":"✓","title":"A","body":"B."},{"on":true,"icon":"✓","title":"C","body":"D."},{"on":true,"icon":"✓","title":"E","body":"F."}],“sections”:{“hero”:{},“reviews”:{},“quote”:{}}}}';
  const p = parseAiJson(messy);
  if (p.slug !== 'diesel-mechanic') throw new Error('smart quotes not normalised');
});

assert('truncated mid-object recovers', () => {
  const truncated = '{"slug":"diesel-mechanic","category":"Auto","pack":{"label":"Diesel Mechanic","tradeType":"Diesel Mechanic","theme":{"pipe":"#3D4F5F","hivis":"#E87722","steel":"#1A1A1A","safety":"#F5F0E8"},"services":[{"on":true,"icon":"🔧","title":"Engine rebuilds","body":"Full rebuilds for heavy vehicles."},{"on":true,"icon":"🚚","title":"Fleet servicing","body":"Scheduled care for commercial fleets."},{"on":true,"icon":"⚡","title":"Diagnostics","body":"Computer diagnostics that find faults fast."},{"on":true,"icon":"🛡","title":"Warranty work","body":"Trusted repairs with clear timelines."}],"sections":{"hero":{"eyebrow":"Diesel · {location}","title":"Heavy duty","titleHl":"done right","sub":"Local diesel help across {location}.","badges":[{"icon":"✓","text":"Licensed"},{"icon":"★","text":"Local"},{"icon":"$","text":"Fair"},{"icon":"⚡","text":"Fast"}]},"reviews":{"eyebrow":"Neighbours","heading":"Local proof","items":[{"who":"Sam — {location}","text":"\\"{business} fixed our truck fast.\\""}]},"quote":{"eyebrow":"Fast quote","sub":"Tell us the job.","button":"Send","formTitle":"Quote","lblName":"Name","lblPhone":"Phone","lblSuburb":"Suburb","lblDetail":"Detail","successTitle":"Got it","heading":"Quote","lblJob":"Need?","points":[{"text":"Fast"}],"jobOptions":[{"text":"Repair"}]},"faq":{"eyebrow":"FAQ","heading":"Answers","items":[{"q":"Cover {location}?","a":"Yes."}]';
  const p = parseAiJson(truncated);
  if (p.slug !== 'diesel-mechanic') throw new Error('truncated slug lost');
  if (!p.pack || p.pack.label !== 'Diesel Mechanic') throw new Error('truncated label lost');
  if (!Array.isArray(p.pack.services) || p.pack.services.length < 4) throw new Error('truncated services lost');
});

assert('hydrateSparsePack fills gaps', () => {
  const { hydrateSparsePack } = require('../lib/trade-pack-utils');
  const sparse = {
    slug: 'diesel-mechanic',
    category: 'Auto',
    pack: {
      label: 'Diesel Mechanic',
      tradeType: 'Diesel Mechanic',
      theme: { pipe: '#111' },
      services: [
        { on: true, icon: '✓', title: 'A', body: 'a' },
        { on: true, icon: '✓', title: 'B', body: 'b' },
        { on: true, icon: '✓', title: 'C', body: 'c' },
        { on: true, icon: '✓', title: 'D', body: 'd' },
      ],
      sections: {},
    },
  };
  const h = hydrateSparsePack(sparse, 'Diesel Mechanic', 'Auto');
  const err = validatePack(h);
  if (err) throw new Error(err);
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
