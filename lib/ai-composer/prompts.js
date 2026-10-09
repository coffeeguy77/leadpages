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
    '8. Prefer apps whose content matches what is in the design (e.g. cards of services → services; numbered steps → serviceProcess; quotes from customers → reviews; questions → faq; a contact/quote form → quote; a block of text with one photo → textBox or aboutUs).',
    '',
    'POSITIONS',
    '- startTile / endTile are tile numbers exactly as labelled (Tile 1 is the top).',
    '- startPct / endPct are how far down that tile (0–100) the section starts and ends.',
    '',
    'PHOTOS',
    '- List real photographs and illustrations that should become images on the site (hero backgrounds, card photos, team photos, gallery images, before/after shots). Do not list icons, text, buttons or decorative shapes.',
    '- For each photo give the tile number and a tight box in percent of that tile: x and w as % of tile width, y and h as % of tile height. Keep the box inside the photo edges.',
    '- Give each photo an id ("p1", "p2", …), the id of the section it belongs to, a short description, and a role: hero, card, team, gallery, before, after, background or other.',
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

function fillSystemPrompt() {
  return [
    'You copy the content of a website design into LeadPages app fields.',
    'You are given one or more sections of the design as images, and for each section the LeadPages app chosen for it with the exact fields it accepts.',
    '',
    'RULES',
    '1. Use the wording from the design, exactly. If the design uses ALL CAPS purely as styling, write it in normal sentence or title case.',
    '2. Never invent facts: no made-up reviews, names, numbers, years, licence numbers, prices, suburbs or awards. If the design shows nothing for a field, return "".',
    '3. Exception: functional labels the app needs to work (form labels, placeholder text, button text) may use short neutral wording such as "Name", "Phone", "Send enquiry" when the design does not show them.',
    '4. Lists: one item per repeated card/row in the design, in the same order, up to the stated maxItems. Fill item fields by name. Do not pad lists with empty items.',
    '5. Image fields (kind "image"): use a photo id from the list given for that section (e.g. "p3"), matched to the right card, or "". Never write a URL.',
    '6. Colour fields (kind "color"): a hex value only when clearly visible in that section; otherwise leave the field out.',
    '7. Text fields: if a heading has a highlighted/coloured phrase and the app has a highlight field (e.g. titleHl, highlightText), put that phrase there and the rest in the main field.',
    '8. Australian English for any functional wording you write.',
    '',
    'Return JSON: {"apps":[{"appKey": "...", "fields": {"<field path>": "<value>"}, "lists": {"<list path>": [{"<item field name>": "<value>"}]}}]}',
    'Use the exact field paths and list paths given. Return JSON only.'
  ].join('\n');
}

/**
 * @param {{ businessName: string, items: { sectionId: string, appKey: string, label: string, sheet: object, photos: {id:string,description:string}[], imageUrls: string[] }[] }} args
 */
function fillMessages(args) {
  const blocks = [];
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
    { role: 'system', content: fillSystemPrompt() },
    { role: 'user', content: blocks }
  ];
}

module.exports = {
  PLAN_SCHEMA,
  FILL_SCHEMA,
  planSystemPrompt,
  planMessages,
  fillSystemPrompt,
  fillMessages
};
