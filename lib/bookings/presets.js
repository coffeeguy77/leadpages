'use strict';

/**
 * Booking-type presets: one click sets up services, opening hours and booking
 * rules for a kind of business. Applying a preset only ADDS what is missing —
 * existing services, hours and settings are never overwritten.
 *
 * kind:
 *   'hire'  — vehicles / equipment booked by the day (fleet + hire bar)
 *   'slots' — appointments in time slots (barber, beauty, trades…)
 *   'class' — sessions with seats (courses, classes, workshops)
 */

const WEEK_9_5 = { 1: [['09:00', '17:00']], 2: [['09:00', '17:00']], 3: [['09:00', '17:00']], 4: [['09:00', '17:00']], 5: [['09:00', '17:00']] };
const WEEK_SAT = Object.assign({}, WEEK_9_5, { 6: [['09:00', '13:00']] });
const SALON = { 2: [['09:00', '17:30']], 3: [['09:00', '17:30']], 4: [['09:00', '20:00']], 5: [['09:00', '17:30']], 6: [['08:30', '15:00']] };
const TRADES = { 1: [['07:00', '16:00']], 2: [['07:00', '16:00']], 3: [['07:00', '16:00']], 4: [['07:00', '16:00']], 5: [['07:00', '16:00']] };

/** Presets set names and lengths only; prices start blank ("price on request") for the business to fill in. */
function s(name, minutes, _dollars, extra) {
  return Object.assign({ name: name, duration_minutes: minutes, price_cents: 0, price_model: 'quote_required' }, extra || {});
}

const PRESETS = [
  {
    key: 'truck_hire', label: 'Truck hire', group: 'Hire & rental', kind: 'hire', terminology: 'truck',
    blurb: 'Box trucks, utes and vans by the day. Fleet with rego, day rates, bond and repairs blocking.',
    services: [s('Truck hire', 1435, 0, { booking_type: 'resource_hire', price_model: 'per_day', description: 'Pick up, return within 24 hours per day booked.' })],
    hire: { open_time: '07:30', close_time: '17:00', time_step: 30, max_daily_hire_jobs: 50, durations: [{ label: '1 Day (24 hours)', days: 1 }, { label: '2 Days', days: 2 }, { label: '3 Days', days: 3 }, { label: '1 Week (7 days)', days: 7 }] }
  },
  {
    key: 'car_hire', label: 'Car & van hire', group: 'Hire & rental', kind: 'hire', terminology: 'vehicle',
    blurb: 'Cars, vans and people movers by the day.',
    services: [s('Vehicle hire', 1435, 0, { booking_type: 'resource_hire', price_model: 'per_day' })],
    hire: { open_time: '08:00', close_time: '17:00', time_step: 30, max_daily_hire_jobs: 50 }
  },
  {
    key: 'trailer_hire', label: 'Trailer hire', group: 'Hire & rental', kind: 'hire', terminology: 'trailer',
    blurb: 'Box, car and plant trailers by the day.',
    services: [s('Trailer hire', 1435, 0, { booking_type: 'resource_hire', price_model: 'per_day' })],
    hire: { open_time: '07:00', close_time: '17:00', time_step: 30, max_daily_hire_jobs: 50 }
  },
  {
    key: 'equipment_hire', label: 'Equipment & machine hire', group: 'Hire & rental', kind: 'hire', terminology: 'equipment',
    blurb: 'Excavators, tools, party hire, coffee carts — anything hired out by the day.',
    services: [s('Equipment hire', 1435, 0, { booking_type: 'resource_hire', price_model: 'per_day' })],
    hire: { open_time: '07:00', close_time: '16:30', time_step: 30, max_daily_hire_jobs: 50 }
  },
  {
    key: 'barber', label: 'Barber', group: 'Hair & beauty', kind: 'slots', hours: SALON, slot_interval: 15,
    blurb: 'Haircuts, fades and beard trims in 15-minute slots.',
    services: [s('Men’s haircut', 30, 40), s('Skin fade', 45, 50), s('Beard trim', 20, 25), s('Haircut + beard', 50, 60), s('Kids cut (under 12)', 20, 30)]
  },
  {
    key: 'hair_salon', label: 'Hair salon', group: 'Hair & beauty', kind: 'slots', hours: SALON, slot_interval: 15,
    blurb: 'Cuts, colour and styling with buffer time between clients.',
    services: [s('Women’s cut & blow-dry', 60, 85), s('Blow-dry', 45, 55), s('Root colour', 90, 120), s('Full head foils', 150, 220), s('Consultation', 15, 0)]
  },
  {
    key: 'beauty', label: 'Beauty & nails', group: 'Hair & beauty', kind: 'slots', hours: SALON, slot_interval: 15,
    blurb: 'Brows, lashes, nails, waxing and facials.',
    services: [s('Brow shape & tint', 30, 45), s('Lash lift & tint', 60, 95), s('Gel manicure', 45, 55), s('Pedicure', 60, 70), s('Facial', 60, 110)]
  },
  {
    key: 'massage', label: 'Massage & wellness', group: 'Health & wellness', kind: 'slots', hours: WEEK_SAT, slot_interval: 30,
    blurb: 'Remedial and relaxation massage in 30/60/90-minute sessions.',
    services: [s('Remedial massage — 30 min', 30, 75), s('Remedial massage — 60 min', 60, 120), s('Remedial massage — 90 min', 90, 165)]
  },
  {
    key: 'physio', label: 'Physio & allied health', group: 'Health & wellness', kind: 'slots', hours: WEEK_9_5, slot_interval: 15,
    blurb: 'Initial and follow-up consultations.',
    services: [s('Initial consultation', 45, 110), s('Follow-up consultation', 30, 90)]
  },
  {
    key: 'trades', label: 'Trades call-out', group: 'Trades & home services', kind: 'slots', hours: TRADES, slot_interval: 60,
    blurb: 'Plumbers, sparkies and handymen: call-outs and free quotes at the customer’s address.',
    services: [s('Call-out / service visit', 60, 0, { delivery_mode: 'at_customer' }), s('Free quote visit', 45, 0, { delivery_mode: 'at_customer', price_model: 'free' }), s('Emergency call-out', 60, 0, { delivery_mode: 'at_customer' })]
  },
  {
    key: 'cleaning', label: 'Cleaning', group: 'Trades & home services', kind: 'slots', hours: TRADES, slot_interval: 60,
    blurb: 'Regular, end-of-lease and carpet cleans at the customer’s address.',
    services: [s('Regular clean (2 hours)', 120, 140, { delivery_mode: 'at_customer' }), s('End of lease clean', 300, 0, { delivery_mode: 'at_customer' }), s('Carpet steam clean', 120, 0, { delivery_mode: 'at_customer' })]
  },
  {
    key: 'mechanic', label: 'Mechanic & detailing', group: 'Automotive', kind: 'slots', hours: TRADES, slot_interval: 30,
    blurb: 'Car services, inspections and detailing drop-offs.',
    services: [s('Logbook service', 180, 0), s('Basic service', 120, 0), s('Roadworthy inspection', 60, 0), s('Full detail', 240, 0)]
  },
  {
    key: 'dog_grooming', label: 'Dog grooming', group: 'Pets', kind: 'slots', hours: WEEK_SAT, slot_interval: 30,
    blurb: 'Wash, clip and nail trims by dog size.',
    services: [s('Small dog wash & tidy', 60, 70), s('Medium dog full groom', 90, 95), s('Large dog full groom', 120, 120), s('Nail trim', 15, 20)]
  },
  {
    key: 'consultation', label: 'Consultations & professional services', group: 'Professional', kind: 'slots', hours: WEEK_9_5, slot_interval: 30,
    blurb: 'Accountants, brokers, lawyers, coaches — in person, phone or video.',
    services: [s('Initial consultation', 30, 0, { price_model: 'free', booking_type: 'consultation' }), s('Phone consultation', 30, 0, { booking_type: 'consultation', delivery_mode: 'phone' }), s('Video meeting', 45, 0, { booking_type: 'consultation', delivery_mode: 'online' })]
  },
  {
    key: 'photography', label: 'Photography sessions', group: 'Professional', kind: 'slots', hours: WEEK_SAT, slot_interval: 30,
    blurb: 'Portrait, family and headshot sessions.',
    services: [s('Headshot session', 30, 150), s('Family session', 60, 290), s('Portrait session', 60, 250)]
  },
  {
    key: 'classes', label: 'Classes & courses', group: 'Classes & events', kind: 'class', hours: { 6: [['09:00', '17:00']] }, slot_interval: 60,
    blurb: 'Seats per session with “2 spots left” — barista courses, workshops, cooking classes.',
    services: [s('Beginner class', 120, 150, { booking_type: 'class', capacity: 6, price_model: 'per_person' }), s('Advanced class', 240, 280, { booking_type: 'class', capacity: 6, price_model: 'per_person' })]
  },
  {
    key: 'fitness', label: 'Fitness & PT', group: 'Classes & events', kind: 'class', hours: { 1: [['06:00', '19:00']], 2: [['06:00', '19:00']], 3: [['06:00', '19:00']], 4: [['06:00', '19:00']], 5: [['06:00', '18:00']], 6: [['07:00', '12:00']] }, slot_interval: 30,
    blurb: 'Group classes with limited spots and 1-on-1 personal training.',
    services: [s('Group class', 45, 25, { booking_type: 'class', capacity: 12, price_model: 'per_person' }), s('Personal training — 30 min', 30, 60), s('Personal training — 60 min', 60, 95)]
  },
  {
    key: 'venue', label: 'Venue & room hire', group: 'Classes & events', kind: 'hire', terminology: 'venue',
    blurb: 'Function rooms, studios and halls by the day.',
    services: [s('Venue hire', 1435, 0, { booking_type: 'resource_hire', price_model: 'per_day' })],
    hire: { open_time: '08:00', close_time: '18:00', time_step: 60, max_daily_hire_jobs: 20 }
  }
];

function list() {
  return PRESETS.map(function (p) { return { key: p.key, label: p.label, group: p.group, kind: p.kind, blurb: p.blurb, services: p.services.map(function (x) { return x.name; }) }; });
}

function get(key) {
  return PRESETS.find(function (p) { return p.key === key; }) || null;
}

function slugify(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'service';
}

/**
 * Apply a preset to a booking system. Adds missing services (by slug), opening
 * hours when the business has none yet, and hire settings that aren't set yet.
 */
async function apply(admin, system, preset, opts) {
  opts = opts || {};
  const created = [];
  const { data: existing } = await admin.from('booking_services').select('id,slug,booking_type').eq('booking_system_id', system.id);
  const have = {};
  (existing || []).forEach(function (r) { have[r.slug] = r; });

  let order = (existing || []).length;
  for (const sv of preset.services) {
    const slug = slugify(sv.name);
    if (have[slug]) continue;
    const row = {
      booking_system_id: system.id,
      site_id: system.site_id,
      name: sv.name,
      slug: slug,
      description: sv.description || '',
      booking_type: sv.booking_type || (preset.kind === 'class' ? 'class' : 'appointment'),
      duration_minutes: sv.duration_minutes,
      price_model: sv.price_model === 'free' || sv.price_model === 'per_day' ? sv.price_model : 'quote_required',
      price_cents: sv.price_cents || 0,
      capacity: Math.max(1, sv.capacity || 1),
      delivery_mode: sv.delivery_mode || 'at_business',
      status: 'active',
      visibility: 'public',
      sort_order: order++
    };
    const { data, error } = await admin.from('booking_services').insert(row).select('id,name').single();
    if (error) return { ok: false, error: error.message, created: created };
    created.push(data);
  }

  // Opening hours (only when the business has none).
  let hoursAdded = 0;
  if (preset.hours) {
    const { count } = await admin.from('booking_availability_rules').select('id', { count: 'exact', head: true }).eq('booking_system_id', system.id).eq('scope', 'business');
    if (!count) {
      const rows = [];
      Object.keys(preset.hours).forEach(function (wd) {
        preset.hours[wd].forEach(function (span) {
          rows.push({ booking_system_id: system.id, site_id: system.site_id, scope: 'business', weekday: Number(wd), start_time: span[0], end_time: span[1] });
        });
      });
      if (rows.length) {
        const { error } = await admin.from('booking_availability_rules').insert(rows);
        if (!error) hoursAdded = rows.length;
      }
    }
  }

  const settings = Object.assign({}, system.settings || {});
  const hire = Object.assign({}, settings.hire || {});
  if (preset.kind === 'hire') {
    Object.keys(preset.hire || {}).forEach(function (k) { if (hire[k] === undefined) hire[k] = preset.hire[k]; });
    if (!hire.terminology && preset.terminology) hire.terminology = { preset: preset.terminology };
    settings.hire = hire;
  }
  settings.preset = settings.preset || preset.key;
  const types = Array.isArray(system.booking_types) ? system.booking_types.slice() : [];
  preset.services.forEach(function (sv) {
    const t = sv.booking_type || (preset.kind === 'class' ? 'class' : 'appointment');
    if (types.indexOf(t) < 0) types.push(t);
  });
  const patch = { settings: settings, booking_types: types, updated_at: new Date().toISOString() };
  // Time-slot spacing: only set on a fresh set-up (no services before), so we never change a business's own choice.
  if (preset.slot_interval && (!system.slot_interval_minutes || !(existing || []).length)) patch.slot_interval_minutes = preset.slot_interval;
  if (opts.enable) { patch.enabled = true; patch.onboarding_step = 'done'; }
  const { data: sys, error } = await admin.from('booking_systems').update(patch).eq('id', system.id).select('*').single();
  if (error) return { ok: false, error: error.message, created: created };
  return { ok: true, preset: preset.key, created: created, hours_added: hoursAdded, system: sys };
}

module.exports = { PRESETS, list, get, apply, slugify };
