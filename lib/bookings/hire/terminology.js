'use strict';

/**
 * Configurable terminology for hire resources (Truck/Trucks by default for this customer).
 */

const PRESETS = {
  truck: { singular: 'Truck', plural: 'Trucks' },
  vehicle: { singular: 'Vehicle', plural: 'Vehicles' },
  trailer: { singular: 'Trailer', plural: 'Trailers' },
  machine: { singular: 'Machine', plural: 'Machines' },
  equipment: { singular: 'Equipment', plural: 'Equipment' },
  asset: { singular: 'Asset', plural: 'Assets' },
  venue: { singular: 'Venue', plural: 'Venues' },
  resource: { singular: 'Resource', plural: 'Resources' },
  room: { singular: 'Room', plural: 'Rooms' },
  cart: { singular: 'Cart', plural: 'Carts' }
};

function resolveTerminology(system) {
  const hire = (system && system.settings && system.settings.hire) || {};
  const t = hire.terminology || {};
  const preset = PRESETS[String(t.preset || hire.resource_label_preset || 'truck').toLowerCase()] || PRESETS.truck;
  return {
    singular: String(t.singular || preset.singular),
    plural: String(t.plural || preset.plural),
    booking: String(t.booking || 'Hire Booking'),
    customer: String(t.customer || 'Hirer'),
    calendar: String(t.calendar || (String(t.singular || preset.singular) + ' Calendar')),
    fleet_calendar: String(t.fleet_calendar || 'Fleet Calendar')
  };
}

function label(system, key, fallback) {
  const terms = resolveTerminology(system);
  return terms[key] || fallback || key;
}

function applyTemplate(template, vars) {
  return String(template || '').replace(/\{([a-z0-9_]+)\}/gi, function (_, k) {
    return vars[k] != null ? String(vars[k]) : '';
  });
}

function defaultEventTitleTemplate(system) {
  const hire = (system && system.settings && system.settings.hire) || {};
  return (
    hire.event_title_template ||
    '{resource_name} — {customer_name} — {booking_reference}'
  );
}

module.exports = {
  PRESETS,
  resolveTerminology,
  label,
  applyTemplate,
  defaultEventTitleTemplate
};
