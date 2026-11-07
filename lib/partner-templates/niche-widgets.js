'use strict';

/**
 * The interactive "example experience" for each industry page (Nov 2026). Every widget really
 * works (filters, tabs, choices, quantities, uploads) using generic data-nz-* behaviours in
 * /assets/partner-templates/niche.js. The final button opens the partner's enquiry form with a
 * note of what the prospect tried.
 *
 * Elements marked data-nz-q="Label" are summarised into that note.
 */

const { IMG } = require('./niche-family');

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}

const I = {
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  calc: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h2M16 15v3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  scales: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7zM19 7l-3 7a3 3 0 0 0 6 0l-3-7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  bars: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20v-5M10 20v-9M15 20v-12M20 20V4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 10h17M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.4 3.4 0 0 1 0 6.8M18 14a6 6 0 0 1 3.5 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m3.5 6 8.5 7 8.5-7" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  clip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.4 8.4a1.7 1.7 0 0 1-2.4-2.4L15 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  photo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="10" r="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m21 16-5-5-8 8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  scissors: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="6" cy="18" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 7.5 20 18M8 16.5 20 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  house: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  unit: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  town: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20V10l5-4 5 4v10M13 20v-8l4-3 4 3v8M3 20h18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 1 1 13 0C18.5 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="9.8" r="2.3" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  brain: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  run: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="14" cy="4.5" r="2" fill="currentColor"/><path d="m8 21 3-6 3 2v5M6 11l4-3 4 1 2 3h3M11 15l-1-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  hands: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13V8a1.5 1.5 0 0 1 3 0v4M7 11V6a1.5 1.5 0 0 1 3 0v5M10 11V7a1.5 1.5 0 0 1 3 0v6l2-2a1.6 1.6 0 0 1 2.3 2.2L13 18a5 5 0 0 1-9-3v-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

function send(label, cls) {
  return '<button type="button" class="nz-send ' + (cls || '') + '" data-nz-send data-st-open="contact">' + esc(label) + ' ' + I.arrow + '</button>';
}
function select(q, options, attrs) {
  return '<select data-nz-q="' + esc(q) + '"' + (attrs || '') + '>' + options.map(function(o) {
    return Array.isArray(o) ? '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>' : '<option>' + esc(o) + '</option>';
  }).join('') + '</select>';
}
function card(kicker, inner, cls) {
  return '<div class="nz-w ' + (cls || '') + '" data-nz-w>' + (kicker ? '<p class="nz-w-kicker">' + esc(kicker) + '</p>' : '') + inner + '</div>';
}

/* ---------------------------------------------------------------- per industry */
const W = {
  'professional-services': function(h) {
    const opts = [['Accounting and tax', 'Accounting', I.calc], ['Legal advice', 'Legal', I.scales], ['Business advisory', 'Advisory', I.bars]];
    return card('Example experience',
      '<div class="nz-pro">'
      + '<div class="nz-pro-left"><h3>How can we help?</h3><div class="nz-list" data-nz-q="Help needed">'
      + opts.map(function(o, i) {
        return '<label class="nz-opt nz-opt-row' + (i === 0 ? ' is-on' : '') + '"><span class="nz-ico">' + o[2] + '</span><span>' + esc(o[0]) + '</span>'
          + '<input type="radio" name="nz-help" value="' + esc(o[0]) + '" data-team="' + esc(o[1]) + '"' + (i === 0 ? ' checked' : '') + '><i class="nz-radio" aria-hidden="true"></i></label>';
      }).join('') + '</div></div>'
      + '<span class="nz-pro-arrow" aria-hidden="true">' + I.arrow + '</span>'
      + '<div class="nz-pro-right"><img class="nz-avatar" src="' + IMG + 'professional-avatar.webp" alt="" loading="lazy">'
      + '<p>You’ll be connected with our <span data-nz-team>Accounting</span> team.</p>'
      + send('Continue enquiry') + '</div>'
      + '</div>');
  },

  tourism: function(h) {
    const ex = [['Nature & wildlife', true], ['Food & drink', false], ['Adventure', false], ['Relax & unwind', false]];
    return card('', '<h3>Plan your stay</h3>'
      + '<div class="nz-row2">'
      + '<label class="nz-field nz-field-ico">' + I.cal + '<span><small>Arrive</small><input type="date" data-nz-q="Arrive"></span></label>'
      + '<label class="nz-field nz-field-ico">' + I.cal + '<span><small>Leave</small><input type="date" data-nz-q="Leave"></span></label>'
      + '</div>'
      + '<label class="nz-field nz-field-ico">' + I.user + '<span><small>Guests</small>' + select('Guests', ['2 adults', '1 adult', '2 adults, 1 child', '2 adults, 2 children', 'Group (5+)']) + '</span></label>'
      + '<h4>Explore local experiences</h4><p class="nz-hint">Help guests make the most of your destination.</p>'
      + '<div class="nz-checks" data-nz-q="Interests">' + ex.map(function(e) {
        return '<label class="nz-check"><input type="checkbox" value="' + esc(e[0]) + '"' + (e[1] ? ' checked' : '') + '><span>' + esc(e[0]) + '</span></label>';
      }).join('') + '</div>'
      + '<div class="nz-exp-card"><img src="' + IMG + 'tourism-exp.webp" alt="" loading="lazy"><div><p class="nz-w-kicker">Example experience</p><strong>Coastal eco-walk</strong>'
      + '<p>A scenic guided walk through coastal bushland with local insights.</p>'
      + '<label class="nz-check" data-nz-q="Added experience"><input type="checkbox" value="Coastal eco-walk" checked><span>Add to my stay</span></label></div></div>'
      + send('Send a direct booking enquiry', 'nz-send-block'), 'nz-w-tourism');
  },

  childcare: function(h) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    return card('', '<div class="nz-tabs" data-nz-tabs>'
      + '<button type="button" class="nz-tab is-on" data-nz-tab="find">' + I.search + ' Find a centre</button>'
      + '<button type="button" class="nz-tab" data-nz-tab="tour">' + I.cal + ' Request a tour</button></div>'
      + '<div class="nz-cc">'
      + '<img class="nz-cc-art" src="' + IMG + 'childcare-art.webp" alt="" loading="lazy">'
      + '<div class="nz-cc-form">'
      + '<div data-nz-panel="find"><h3>Find a centre near you</h3>'
      + '<div class="nz-frow"><span>' + I.users + ' Age group</span>' + select('Age group', ['0–2 years (nursery)', '2–3 years (toddlers)', '3–5 years (preschool)', 'School age (OSHC)']) + '</div>'
      + '<div class="nz-frow"><span>' + I.cal + ' Preferred days</span><div class="nz-days" data-nz-q="Days">' + days.map(function(d) { return '<label class="nz-check nz-pill"><input type="checkbox" value="' + d + '"><span>' + d + '</span></label>'; }).join('') + '</div></div>'
      + '<div class="nz-frow"><span>' + I.cal + ' Start month</span>' + select('Start month', ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']) + '</div>'
      + '<button type="button" class="nz-btn2" data-nz-reveal="[data-nz-result]">Search centres ' + I.arrow + '</button>'
      + '<div class="nz-result" data-nz-result hidden><strong>Little Learners {region}</strong><span>Places available for your age group · 4 km away</span>'
      + '<button type="button" class="nz-link" data-nz-tab="tour">Request a tour ' + I.arrow + '</button></div>'
      + '</div>'
      + '<div data-nz-panel="tour" hidden><h3>Request a tour</h3>'
      + '<div class="nz-frow"><span>' + I.cal + ' Preferred time</span>' + select('Tour time', ['Weekday morning', 'Weekday afternoon', 'Saturday morning']) + '</div>'
      + '<p class="nz-hint">We’ll include your child’s age group, preferred days and start month.</p>'
      + send('Request a tour', 'nz-send-block') + '</div>'
      + '</div></div>', 'nz-w-childcare');
  },

  manufacturing: function(h) {
    const parts = [
      ['MF-240 Flange', 'Ø240 × 12 mm – 316 SS', 'Flanges', 4, true, 'part1'],
      ['BR-110 Bracket', '110 × 75 × 8 mm – Steel', 'Brackets', 10, true, 'part2'],
      ['SH-032 Shaft', 'Ø32 × 300 mm – 4140', 'Shafts', 2, false, 'part3']
    ];
    const types = [['Flanges', 24], ['Brackets', 18], ['Shafts', 12], ['Housings', 9]];
    return card('', '<div class="nz-search"><label>' + I.search + '<input type="search" data-nz-search data-nz-q="Searched for" placeholder="Search products, part numbers or specifications…"></label><button type="button" class="nz-btn-dark">Search</button></div>'
      + '<div class="nz-mf">'
      + '<div class="nz-mf-filters"><h4>Filter by</h4><p class="nz-mf-sub">Product type</p>'
      + types.map(function(t, i) { return '<label class="nz-check"><input type="checkbox" data-nz-type value="' + t[0] + '"' + (i === 0 ? ' checked' : '') + '><span>' + t[0] + ' (' + t[1] + ')</span></label>'; }).join('')
      + '<p class="nz-mf-sub nz-mf-more">Material</p><p class="nz-mf-sub nz-mf-more">Size / Range</p></div>'
      + '<div class="nz-mf-list">' + parts.map(function(p) {
        return '<div class="nz-part" data-nz-row data-type="' + p[2] + '"><img src="' + IMG + 'manufacturing-' + p[5] + '.webp" alt="" loading="lazy">'
          + '<div class="nz-part-txt"><strong>' + esc(p[0]) + '</strong><small>' + esc(p[1]) + '</small></div>'
          + '<label class="nz-qty"><small>Qty</small><input type="number" min="1" value="' + p[3] + '" data-nz-qtyfor="' + esc(p[0]) + '"></label>'
          + '<button type="button" class="nz-short' + (p[4] ? ' is-on' : '') + '" data-nz-toggle data-item="' + esc(p[0]) + '" data-on="✓ Shortlisted" data-off="+ Shortlist">' + (p[4] ? '✓ Shortlisted' : '+ Shortlist') + '</button></div>';
      }).join('') + '</div></div>'
      + '<div class="nz-mf-foot"><span>' + I.mail + ' Request a quote (RFQ) · <b data-nz-count>2</b> items shortlisted</span>'
      + '<label class="nz-file">' + I.clip + ' <span data-nz-filename>Upload drawing / files</span><input type="file" data-nz-file></label>'
      + send('Request quote') + '</div>', 'nz-w-mf');
  },

  retail: function(h) {
    return card('', '<div class="nz-shop">'
      + '<img class="nz-shop-img" src="' + IMG + 'retail-product.webp" alt="" loading="lazy">'
      + '<div class="nz-shop-mid"><h3 data-nz-q-text>Arc Mug</h3><p class="nz-price">$29.00</p>'
      + '<p class="nz-mini">Colour</p><div class="nz-swatches" data-nz-q="Colour">'
      + [['Red', '#D6372B', true], ['Cream', '#EDE4D6', false], ['Lilac', '#C9A9EE', false]].map(function(s) {
        return '<label class="nz-swatch" title="' + s[0] + '"><input type="radio" name="nz-colour" value="' + s[0] + '"' + (s[2] ? ' checked' : '') + '><i style="background:' + s[1] + '"></i></label>';
      }).join('') + '</div>'
      + '<p class="nz-mini">Quantity</p><div class="nz-stepper"><button type="button" data-nz-dec aria-label="Less">−</button><input type="number" min="1" value="1" data-nz-q="Quantity"><button type="button" data-nz-inc aria-label="More">+</button></div>'
      + '<button type="button" class="nz-btn2 nz-cart" data-nz-flash="Added ✓">Add to cart</button></div>'
      + '<div class="nz-shop-right"><span class="nz-ico-lg">' + I.bag + '</span><h4>Click-and-collect</h4><p class="nz-hint">Pick up from your store</p>'
      + '<div data-nz-q="Pickup">'
      + '<label class="nz-opt nz-opt-plain is-on"><input type="radio" name="nz-pickup" value="Click-and-collect (free)" checked><i class="nz-radio"></i><span>Click-and-collect (Free)</span></label>'
      + '<label class="nz-opt nz-opt-plain"><input type="radio" name="nz-pickup" value="Delivery"><i class="nz-radio"></i><span>Delivery</span></label></div>'
      + send('Continue') + '</div>'
      + '</div>', 'nz-w-retail');
  },

  automotive: function(h) {
    const makes = { Toyota: ['RAV4', 'Corolla', 'HiLux', 'LandCruiser', 'Camry'], Ford: ['Ranger', 'Everest', 'Focus', 'Mustang'], Mazda: ['CX-5', 'CX-3', 'Mazda3', 'BT-50'], Hyundai: ['i30', 'Tucson', 'Kona', 'Santa Fe'], Mitsubishi: ['Triton', 'Outlander', 'ASX', 'Pajero Sport'], Other: ['Other model'] };
    return card('Example experience', '<h3>Request a vehicle service</h3><p class="nz-hint">A simple online request that gives your team the key details upfront.</p>'
      + '<div class="nz-row2"><label class="nz-field"><small>Make *</small><select data-nz-q="Make" data-nz-make>' + Object.keys(makes).map(function(m) { return '<option>' + m + '</option>'; }).join('') + '</select></label>'
      + '<label class="nz-field"><small>Model *</small><select data-nz-q="Model" data-nz-models=\'' + esc(JSON.stringify(makes)) + '\'>' + makes.Toyota.map(function(m) { return '<option>' + m + '</option>'; }).join('') + '</select></label></div>'
      + '<div class="nz-row2"><label class="nz-field"><small>Odometer (km) *</small><input type="number" inputmode="numeric" value="87430" data-nz-q="Odometer (km)"></label>'
      + '<label class="nz-field"><small>Preferred service date *</small><input type="date" data-nz-q="Preferred date"></label></div>'
      + '<p class="nz-mini">Add photos (optional)</p>'
      + '<label class="nz-drop">' + I.photo + '<span><b data-nz-filename>Upload photos</b> (e.g. issue, damage or part)<small>JPG, PNG or HEIC (max 10 MB)</small></span><input type="file" accept="image/*" multiple data-nz-file></label>'
      + send('Request service', 'nz-send-block'), 'nz-w-auto');
  },

  beauty: function(h) {
    const looks = [['beauty-look1', 'Soft Brunette Blowout', 'Cut & Blowdry', 'Amelia'], ['beauty-look2', 'Textured Bridal Updo', 'Bridal styling', 'Sophie'], ['beauty-look3', 'Natural Gel Manicure', 'Gel manicure', 'Mia']];
    return card('Example experience', '<div class="nz-look">'
      + '<div class="nz-look-thumbs">' + looks.map(function(l, i) {
        return '<button type="button" class="nz-thumb' + (i === 0 ? ' is-on' : '') + '" data-nz-look data-title="' + esc(l[1]) + '" data-service="' + esc(l[2]) + '" data-stylist="' + esc(l[3]) + '"><img src="' + IMG + l[0] + '.webp" alt="' + esc(l[1]) + '" loading="lazy"></button>';
      }).join('') + '</div>'
      + '<div class="nz-look-main"><div class="nz-look-head"><h3 data-nz-main-title data-nz-q="Look" data-nz-text>Soft Brunette Blowout</h3><button type="button" class="nz-heart" data-nz-toggle data-on="♥" data-off="♡" aria-label="Save look">♡</button></div>'
      + '<div class="nz-look-rows">'
      + '<div class="nz-lrow">' + I.scissors + '<span>Service</span><b data-nz-service data-nz-q="Service" data-nz-text>Cut &amp; Blowdry</b></div>'
      + '<div class="nz-lrow">' + I.user + '<span>Stylist</span><b data-nz-stylist data-nz-q="Stylist" data-nz-text>Amelia</b></div>'
      + '<div class="nz-lrow">' + I.cal + '<span>Booking enquiry</span><b>›</b></div></div>'
      + send('Enquire to book', 'nz-send-block') + '</div>'
      + '</div>', 'nz-w-beauty');
  },

  'allied-health': function(h) {
    const svc = [['Psychology', I.brain], ['Physiotherapy', I.run], ['Occupational therapy', I.hands]];
    return '<div class="nz-allied">'
      + card('', '<h3>Find a practitioner</h3><div class="nz-row3">'
        + '<label class="nz-field"><small>Service</small>' + select('Service', ['Psychology', 'Physiotherapy', 'Occupational therapy', 'Speech pathology']) + '</label>'
        + '<label class="nz-field"><small>Location</small>' + select('Location', ['{region}', 'North side', 'South side', 'Telehealth']) + '</label>'
        + '<label class="nz-field"><small>Age group</small>' + select('Age group', ['Adults (18+)', 'Teens (12–17)', 'Children (under 12)']) + '</label></div>'
        + '<button type="button" class="nz-btn2 nz-btn-block" data-nz-reveal="[data-nz-result]">' + I.search + ' Find practitioners</button>'
        + '<div class="nz-result" data-nz-result hidden><strong>3 practitioners available</strong><span>Next appointment: this Thursday · bulk-billing options</span></div>', 'nz-w-finder')
      + card('Example experience', '<div data-nz-steps>'
        + '<ol class="nz-dots"><li class="is-on" data-nz-dot>Service</li><li data-nz-dot>Details</li><li data-nz-dot>Enquiry</li></ol>'
        + '<div data-nz-step><p class="nz-q">What would you like to enquire about?</p><div data-nz-q="Enquiry about">' + svc.map(function(s, i) {
          return '<label class="nz-opt nz-opt-row' + (i === 0 ? ' is-on' : '') + '"><span class="nz-ico">' + s[1] + '</span><span>' + esc(s[0]) + '</span><input type="radio" name="nz-svc" value="' + esc(s[0]) + '"' + (i === 0 ? ' checked' : '') + '><i class="nz-radio"></i></label>';
        }).join('') + '</div><div class="nz-step-foot"><button type="button" class="nz-btn2" data-nz-next>Next ' + I.arrow + '</button></div></div>'
        + '<div data-nz-step hidden><p class="nz-q">When suits you?</p>'
        + '<label class="nz-field"><small>Preferred time</small>' + select('Preferred time', ['Weekday mornings', 'Weekday afternoons', 'After 5pm', 'Saturday']) + '</label>'
        + '<label class="nz-field"><small>Is this for you or someone else?</small>' + select('For', ['Myself', 'My child', 'Someone I care for']) + '</label>'
        + '<div class="nz-step-foot"><button type="button" class="nz-link" data-nz-prev>Back</button><button type="button" class="nz-btn2" data-nz-next>Next ' + I.arrow + '</button></div></div>'
        + '<div data-nz-step hidden><p class="nz-q">Ready to send your enquiry</p><p class="nz-hint">We’ll include your service, preferred time and who it’s for.</p>'
        + '<div class="nz-step-foot"><button type="button" class="nz-link" data-nz-prev>Back</button>' + send('Send enquiry') + '</div></div>'
        + '</div>', 'nz-w-steps')
      + '</div>';
  },

  fitness: function(h) {
    const rows = [['Mon', '6:00 am', 'Strength'], ['Mon', '9:30 am', 'Pilates'], ['Tue', '6:00 pm', 'HIIT'], ['Wed', '7:00 am', 'Mobility'], ['Thu', '6:00 pm', 'Strength']];
    const types = ['Strength', 'Pilates', 'HIIT', 'Mobility'];
    return '<div class="nz-fit">'
      + card('', '<div class="nz-fit-head"><h3>Class timetable</h3><div class="nz-chips"><button type="button" class="nz-chip is-on" data-nz-filter="">All classes</button>'
        + types.map(function(t) { return '<button type="button" class="nz-chip" data-nz-filter="' + t + '">' + t + '</button>'; }).join('') + '</div></div>'
        + '<div class="nz-table" role="table"><div class="nz-tr nz-th" role="row"><span>Day</span><span>Time</span><span>Class</span><span>Spaces</span><span></span></div>'
        + rows.map(function(r) {
          return '<button type="button" class="nz-tr" data-nz-row data-type="' + r[2] + '" data-class="' + esc(r[2] + ' · ' + r[0] + ' ' + r[1]) + '"><span>' + r[0] + '</span><span>' + r[1] + '</span>'
            + '<span><i class="nz-tag nz-tag-' + r[2].toLowerCase() + '">' + r[2] + '</i></span><span><i class="nz-open">✓ Open</i></span><span aria-hidden="true">›</span></button>';
        }).join('') + '</div>', 'nz-w-table')
      + card('', '<h3>Request a first session trial</h3><p class="nz-hint">Try a class, meet the team and see if it’s the right fit.</p>'
        + '<label class="nz-field"><small>Class</small><select data-nz-q="Class" data-nz-class><option value="">Choose a class</option>' + rows.map(function(r) { return '<option>' + esc(r[2] + ' · ' + r[0] + ' ' + r[1]) + '</option>'; }).join('') + '</select></label>'
        + '<label class="nz-field"><small>Preferred day</small><input type="date" data-nz-q="Preferred day"></label>'
        + send('Request trial', 'nz-send-block'), 'nz-w-trial')
      + '</div>';
  },

  'real-estate': function(h) {
    return '<div class="nz-re">'
      + '<div class="nz-re-suburb"><div class="nz-re-hero"><img src="' + IMG + 'realestate-suburb.webp" alt="" loading="lazy"></div>'
      + '<div class="nz-tabs nz-tabs-line" data-nz-tabs><button type="button" class="nz-tab is-on" data-nz-tab="ov">Overview</button><button type="button" class="nz-tab" data-nz-tab="sa">Sales</button><button type="button" class="nz-tab" data-nz-tab="re">Rentals</button><button type="button" class="nz-tab" data-nz-tab="mi">Market insights</button></div>'
      + '<div class="nz-re-body"><div data-nz-panel="ov"><h4>Campbell property market</h4><p>A local snapshot of sales, rental demand and property trends in Campbell.</p></div>'
      + '<div data-nz-panel="sa" hidden><h4>Recent sales</h4><p>14 homes sold in the last 90 days · median $1.42m · 21 days on market.</p></div>'
      + '<div data-nz-panel="re" hidden><h4>Rental demand</h4><p>Strong demand for 3–4 bedroom homes · median $780/week · vacancy under 1%.</p></div>'
      + '<div data-nz-panel="mi" hidden><h4>Market insights</h4><p>Buyer enquiry up 12% this quarter, led by families relocating within {region}.</p></div></div></div>'
      + '<div class="nz-re-form"><h3>Request a property appraisal</h3><p class="nz-hint">Get a no-obligation appraisal from our local team.</p>'
      + '<label class="nz-field"><small>Property address *</small><span class="nz-input-ico">' + I.search + '<input type="text" placeholder="e.g. 12 Stirling Avenue, Campbell" data-nz-q="Address"></span></label>'
      + '<p class="nz-mini">Property type *</p><div class="nz-types" data-nz-q="Property type">'
      + [['House', I.house, true], ['Unit', I.unit, false], ['Townhouse', I.town, false]].map(function(t) {
        return '<label class="nz-opt nz-type' + (t[2] ? ' is-on' : '') + '"><input type="radio" name="nz-ptype" value="' + t[0] + '"' + (t[2] ? ' checked' : '') + '>' + t[1] + '<span>' + t[0] + '</span></label>';
      }).join('') + '</div>'
      + '<p class="nz-mini">Preferred contact *</p><div class="nz-inline" data-nz-q="Preferred contact">'
      + '<label class="nz-opt nz-opt-plain is-on"><input type="radio" name="nz-pc" value="Email" checked><i class="nz-radio"></i><span>Email</span></label>'
      + '<label class="nz-opt nz-opt-plain"><input type="radio" name="nz-pc" value="Phone"><i class="nz-radio"></i><span>Phone</span></label></div>'
      + send('Request appraisal', 'nz-send-block nz-send-dark') + '</div>'
      + '</div>';
  }
};

/** Widget HTML for an industry; {region} is replaced with the partner's area. */
function widgetHtml(id, vars) {
  const fn = W[id];
  if (!fn) return '';
  const region = esc((vars && vars.region) || 'your area');
  return fn(vars || {}).replace(/\{region\}/g, region);
}

module.exports = { widgetHtml, NZ_ICONS: I };
