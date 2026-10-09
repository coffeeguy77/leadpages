'use strict';

/**
 * Prompts + response schemas for AI Composer's two Brain tasks:
 *   composer.design_plan — design tiles → apps, colours, photos, business details
 *   composer.app_fill    — one or more section images → field values per app
 *
 * Schemas use the Brain validator subset (type / required / properties / items).
 * Nullable values are avoided on purpose: the prompts ask for '' instead.
 */

const { catalogueForPlanPrompt } = require('./catalogue');

const PLAN_SCHEMA = {
  type: 'object',
  required: ['businessName', 'theme', 'sections', 'photos', 'gaps'],
  properties: {
    businessName: { type: 'string' },
    tagline: { type: 'string' },
    phone: { type: 'string' },
    email: { type: 'string' },
    seoTitle: { type: 'string' },
    seoDescription: { type: 'string' },
    theme: {
      type: 'object',
      properties: {
        pipe: { type: 'string' },
        hivis: { type: 'string' },
        steel: { type: 'string' },
        safety: { type: 'string' },
        lightBg: { type: 'string' }
      }
    },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'appKey', 'startTile', 'startPct', 'endTile', 'endPct'],
        properties: {
          id: { type: 'string' },
          appKey: { type: 'string' },
          label: { type: 'string' },
          reason: { type: 'string' },
          startTile: { type: 'number' },
          startPct: { type: 'number' },
          endTile: { type: 'number' },
          endPct: { type: 'number' },
          background: { type: 'string' }
        }
      }
    },
    photos: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'tile', 'x', 'y', 'w', 'h'],
        properties: {
          id: { type: 'string' },
          sectionId: { type: 'string' },
          tile: { type: 'number' },
          x: { type: 'number' },
          y: { type: 'number' },
          w: { type: 'number' },
          h: { type: 'number' },
          description: { type: 'string' },
          role: { type: 'string' }
        }
      }
    },
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        required: ['what'],
        properties: {
          what: { type: 'string' },
          tile: { type: 'number' },
          suggestion: { type: 'string' }
        }
      }
    }
  }
};

const FILL_SCHEMA = {
  type: 'object',
  required: ['apps'],
  properties: {
    apps: {
      type: 'array',
      items: {
        type: 'object',
        required: ['appKey', 'fields', 'lists'],
        properties: {
          appKey: { type: 'string' },
          fields: { type: 'object' },
          lists: { type: 'object' }
        }
      }
    }
  }
};

function planSystemPrompt() {
  return [
    'You rebuild website designs inside LeadPages, an Australian website platform.',
    'LeadPages pages are a vertical stack of pre-built "apps". You cannot write HTML or CSS.',
    'Your job: look at a design (sent as numbered tiles, top to bottom, with a small overlap between tiles) and choose the LeadPages app that best recreates each visual section, in order.',
    '',
    'RULES',
    '1. One app per visual section, top to bottom. Never list the same section twice because it appears in two overlapping tiles.',
    '2. Use only appKey values from the catalogue. If no app fits a section, do NOT force one: add it to "gaps" with a short suggestion.',
    '3. Skip the navigation/header bar — LeadPages has its own header. Read the logo, business name and phone from it instead.',
    '4. At most one app marked [HERO], and it must be the first section (an "emerg" top strip may sit above it). Pick heroSlider when the hero has a large photo behind or beside the headline; pick hero when it is text-led.',
    '5. trustBar is always shown directly under the hero by the platform. Only use it for a strip of short badges, credentials or logos near the top.',
    '6. Use "footer" for the bottom section of the page.',
    '7. Each appKey can be used only once per page (a platform limit). If the design repeats a kind of section, use a different suitable app for the repeat (e.g. textBox, then aboutUs, then seoText for text-and-photo blocks) or record it in "gaps".',
    '8. Prefer apps whose content matches what is in the design:',
    '   - cards that each have their own photo → services (one photo per card); use featureStrip only for icon/text cards with no photos',
    '   - a booking / availability bar with date, time or duration inputs and a "check availability" style button (often straight under the hero, sometimes with price cards beside it) → bookingStorefront, as ONE section including its price cards and ticks. Place it directly after the hero.',
    '   - a compact row of specs or figures, each with an icon (e.g. "4.5 Tonne", "850kg payload") → activityCounter; a row of figures or prices that is not part of a booking bar → projectStats',
    '   - cards that show an included item (photo + short title + tick mark) → services',
    '   - a location / contact block with an address, opening hours, a map or a photo of the premises → aboutUs (it has a location layout with address, hours, map and photo); use area only for a list of suburbs served',
    '   - numbered steps → serviceProcess; customer quotes → reviews; questions → faq; a block of text with one photo → textBox or aboutUs',
    '   - a closing call-to-action banner (big headline + button, no input fields, often over a photo) → specialOffer, never quote',
    '   - a contact / enquiry form (name, phone, email, message) → quote. The quote app always collects name, phone, email, job type and suburb.',
    '9. Before recording a gap, check whether an app you have not used yet could hold that content (projectStats, activityCounter, certifications, specialOffer, textBox, seoText). A close fit beats a gap.',
    '',
    'POSITIONS',
    '- startTile / endTile are tile numbers exactly as labelled (Tile 1 is the top).',
    '- startPct / endPct are how far down that tile (0–100) the section starts and ends.',
    '',
    'PHOTOS',
    '- List real photographs and illustrations that should become images on the site (hero backgrounds, card photos, team photos, gallery images, before/after shots). Do not list icons, text, buttons or decorative shapes.',
    '- For each photo give the tile number and a tight box in percent of that tile: x and w as % of tile width, y and h as % of tile height. Keep the box inside the photo edges.',
    '- Give each photo an id ("p1", "p2", …), the id of the section it belongs to, a short description, and a role: hero, card, team, gallery, before, after, background or other.',
    '- Also list photos used as section backgrounds (e.g. behind a closing banner or a reviews band) and a photo standing beside a list of steps.',
    '- If the logo is an image, add it as a photo with role "logo".',
    '',
    'COLOURS (hex like #1a2b3c, or "" if unclear)',
    '- theme.pipe: main brand colour. theme.hivis: call-to-action button colour. theme.steel: dark colour used for header/footer or dark sections. theme.safety: badge/highlight colour. theme.lightBg: the light page background.',
    '- Each section may give its own background hex.',
    '',
    'BUSINESS DETAILS',
    '- businessName, tagline, phone and email exactly as shown in the design. Never invent them; use "" if not visible.',
    '- seoTitle (max 60 characters) and seoDescription (max 155 characters) written from the visible content in Australian English.',
    '',
    'Section ids: "s1", "s2", … in page order. Use "" instead of null. Return JSON only.'
  ].join('\n');
}

/**
 * @param {{ tiles: {index:number,y:number,h:number}[], tileUrls: string[], width: number, height: number, notes?: string }} args
 */
function planMessages(args) {
  const blocks = [];
  blocks.push({
    type: 'text',
    text: 'The design is ' + args.width + 'px wide and ' + args.height + 'px tall, sent as ' +
      args.tiles.length + ' tile' + (args.tiles.length === 1 ? '' : 's') + '.'
  });
  args.tiles.forEach(function (t, i) {
    blocks.push({
      type: 'text',
      text: 'Tile ' + (i + 1) + ' of ' + args.tiles.length + ' — page rows ' + t.y + 'px to ' + (t.y + t.h) + 'px:'
    });
    blocks.push({ type: 'image', url: args.tileUrls[i] });
  });
  blocks.push({
    type: 'text',
    text: 'APP CATALOGUE (appKey: purpose | what it holds)\n' + catalogueForPlanPrompt()
  });
  if (args.notes) {
    blocks.push({ type: 'text', text: 'Notes from the person building the site:\n' + String(args.notes).slice(0, 1500) });
  }
  blocks.push({ type: 'text', text: 'Now return the plan as JSON.' });
  return [
    { role: 'system', content: planSystemPrompt() },
    { role: 'user', content: blocks }
  ];
}

function fillSystemPrompt(opts) {
  opts = opts || {};
  const faqRule = opts.draftFaq
    ? [
      '',
      'FAQ ANSWERS (allowed for this run): for the faq app, when the design shows a question without its answer, write a short answer (1–3 sentences).',
      'Use ONLY facts visible somewhere in the whole design (the overview images are provided). If the design does not contain the facts, write a brief neutral answer that invites the visitor to get in touch — never invent prices, rules, distances or policies.'
    ]
    : [];
  return [
    'You copy the content of a website design into LeadPages app fields.',
    'You are given one or more sections of the design as images, and for each section the LeadPages app chosen for it with the exact fields it accepts.',
    '',
    'RULES',
    '1. Use the wording from the design, exactly. If the design uses ALL CAPS purely as styling, write it in normal sentence or title case.',
    '2. Never invent facts: no made-up reviews, names, numbers, years, licence numbers, prices, suburbs or awards. If the design shows nothing for a field, return "".',
    '3. Exception: functional labels the app needs to work (form labels, placeholder text, button text) may use short neutral wording such as "Name", "Phone", "Send enquiry" when the design does not show them.',
    '3b. A list of features or bullet points inside a text block goes into the app\'s features list when it has one (with an icon each); otherwise into its body/content field, one item per line, after any paragraph.',
    '3e. An address and opening hours go into the address / hours fields when the app has them (not into intro).',
    '3c. Never cram text into a field it does not belong in. Headlines and sub-headlines hold only the text that is that headline/sub-headline in the design. Supporting details of the section (an address, opening hours, short feature lists) go into the app\'s intro/body/content field when it has one. Only text with no sensible home at all (badges, tiny labels) is left out — it is reported to the user separately.',
    '3d. Only fill this app with content from its own section. If a section image also shows content that another app handles (listed as "Also in this image, handled elsewhere"), ignore that content completely.',
    '4. Lists: one item per repeated card/row in the design, in the same order, up to the stated maxItems. Fill item fields by name. Do not pad lists with empty items.',
    '5. Image fields (kind "image"): use a photo id from the list given for that section (e.g. "p3"), matched to the right card, or "". Never write a URL.',
    '6. Colour fields (kind "color"): a hex value only when clearly visible in that section; otherwise leave the field out.',
    '7. Layout fields (kind "choice"): pick the option that best matches the design (e.g. photo on the left of the text → imageSide "left", large card photos → mediaSize "hero" and imageFit "cover", product cut-outs on white → imageFit "contain"). Only use listed option values.',
    '7b. Extra layouts — set them when the design looks like this (otherwise leave the field out):',
    '    heroSlider.textCase "normal" when the headline is not in all capitals; heroSlider badges for a row of icon + title + small text under the sub-headline;',
    '    services.mode "tick" for included-item cards (photo, short title, tick) with services.tickTheme "dark" on a dark band or "light" on a light one;',
    '    activityCounter.style "strip" for a compact row of icon + figure + label; textBox.eyebrowStyle "tag" when the small label above the heading is a filled coloured tag;',
    '    reviews.theme "dark" when reviews sit on a dark band, reviews.badge "google" when each card shows a Google logo, and the summary rating / text / button when shown beside the heading;',
    '    aboutUs.layout "location" for an address / hours / map / premises photo block; specialOffer.layout "banner" for a wide call-to-action band over a photo (bgImage = that photo);',
    '    serviceProcess sideImage + callout fields for a photo beside the steps with a small card over it; faq.columns "2" when the questions are in two columns, ctaLabel for a "view all" button.',
    '7c. Icon fields (kind "icon"): the LeadPages icon name closest in meaning to the icon in the design (e.g. truck, calendar, clock, map-pin, circle-check, dollar-sign, receipt, snowflake, camera, gauge, cog, box, package, route, car). Use "" if nothing is close.',
    '7d. bookingStorefront: hireHeading = the bar heading, the field labels exactly as shown, hireCtaLabel = the button text, points = the ticks under the form, rates = one item per price card (label e.g. "Mon – Thu", price e.g. "$150", unit e.g. "per 24 hours", note e.g. "200km included").',
    '8. Text fields: if a heading has a highlighted/coloured phrase and the app has a highlight field (e.g. titleHl, highlightText), put that phrase there and the rest in the main field.',
    '9. Australian English for any functional wording you write.',
  ].concat(faqRule, [
    '',
    'Return JSON: {"apps":[{"appKey": "...", "fields": {"<field path>": "<value>"}, "lists": {"<list path>": [{"<item field name>": "<value>"}]}}]}',
    'Use the exact field paths and list paths given. Return JSON only.'
  ]).join('\n');
}

/**
 * @param {{ businessName: string, items: { sectionId: string, appKey: string, label: string, sheet: object, photos: {id:string,description:string}[], imageUrls: string[] }[] }} args
 */
/**
 * Other plan sections whose rows overlap this one (they appear in its image).
 * @param {object} plan @param {object} section
 */
function overlappingSections(plan, section) {
  return (plan.sections || []).filter(function (o) {
    if (o.id === section.id || o.synthetic) return false;
    const top = Math.max(o.rows.y0, section.rows.y0);
    const bottom = Math.min(o.rows.y1, section.rows.y1);
    return bottom - top > 20;
  }).map(function (o) { return o.label + ' (' + o.appKey + ' app)'; });
}

function fillMessages(args) {
  const blocks = [];
  if (args.draftFaq && Array.isArray(args.overviewUrls) && args.overviewUrls.length) {
    blocks.push({ type: 'text', text: 'Whole design, for FAQ facts only (top to bottom):' });
    args.overviewUrls.forEach(function (u) { blocks.push({ type: 'image', url: u }); });
  }
  blocks.push({
    type: 'text',
    text: 'Business: ' + (args.businessName || '(name not shown in design)') + '. Fill ' + args.items.length +
      ' app' + (args.items.length === 1 ? '' : 's') + '.'
  });
  args.items.forEach(function (it, i) {
    blocks.push({
      type: 'text',
      text: 'SECTION ' + (i + 1) + ' (' + it.sectionId + ') — design section: "' + (it.label || it.appKey) +
        '". App: ' + it.appKey + '. Image' + (it.imageUrls.length > 1 ? 's (top to bottom)' : '') + ':'
    });
    it.imageUrls.forEach(function (u) { blocks.push({ type: 'image', url: u }); });
    if (it.neighbours && it.neighbours.length) {
      blocks.push({ type: 'text', text: 'Also in this image, handled elsewhere (ignore): ' + it.neighbours.join('; ') });
    }
    blocks.push({
      type: 'text',
      text: 'Fields for ' + it.appKey + ':\n' + JSON.stringify(it.sheet) +
        '\nPhotos available in this section: ' +
        (it.photos.length
          ? it.photos.map(function (p) { return p.id + ' = ' + (p.description || 'photo'); }).join('; ')
          : 'none')
    });
  });
  blocks.push({ type: 'text', text: 'Now return the JSON.' });
  return [
    { role: 'system', content: fillSystemPrompt({ draftFaq: !!args.draftFaq }) },
    { role: 'user', content: blocks }
  ];
}

const PHOTO_CHECK_SCHEMA = {
  type: 'object',
  required: ['photos'],
  properties: {
    photos: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'keep'],
        properties: {
          id: { type: 'string' },
          keep: { type: 'boolean' },
          x: { type: 'number' },
          y: { type: 'number' },
          w: { type: 'number' },
          h: { type: 'number' }
        }
      }
    }
  }
};

function photoCheckSystemPrompt() {
  return [
    'You tidy photo crops taken from a website design so they can be reused as clean images on a real website.',
    'Each image you get is a rough crop with some margin around it. For each one, find the largest clean rectangle that contains only the photograph or illustration itself.',
    'The clean rectangle must EXCLUDE: any text or headings, buttons, icons, badges, labels, overlay panels or cards drawn on top of the photo, white card padding, borders, rounded-corner backgrounds, and anything from neighbouring parts of the page.',
    'If the photo has text or a panel drawn over part of it, choose the biggest area of the photo that avoids it (cutting off part of the photo is fine).',
    'Give x, y, w, h as percentages (0–100) of the image you were shown. Set keep to false only if there is no clean photo area at least a third of the image, or the image is really an icon, logo, map screenshot or text.',
    'Return JSON only: {"photos":[{"id":"p1","keep":true,"x":0,"y":0,"w":100,"h":100}]}'
  ].join('\n');
}

/** @param {{ items: { id: string, description: string, url: string }[] }} args */
function photoCheckMessages(args) {
  const blocks = [];
  args.items.forEach(function (it) {
    blocks.push({ type: 'text', text: 'Photo ' + it.id + ' — ' + (it.description || 'photo') + ':' });
    blocks.push({ type: 'image', url: it.url });
  });
  blocks.push({ type: 'text', text: 'Return the JSON for all ' + args.items.length + ' photos.' });
  return [
    { role: 'system', content: photoCheckSystemPrompt() },
    { role: 'user', content: blocks }
  ];
}

module.exports = {
  PHOTO_CHECK_SCHEMA,
  photoCheckSystemPrompt,
  photoCheckMessages,
  PLAN_SCHEMA,
  FILL_SCHEMA,
  planSystemPrompt,
  planMessages,
  fillSystemPrompt,
  fillMessages,
  overlappingSections
};
