/**
 * Bean Culture Coffee Cart Hire — private superuser quote config.
 * Seeded only onto slug=beanculture; never exposed via public APIs.
 * Editable in admin — use Provision button only to reset to this template.
 */

const { normalizeQuoteConfig } = require('./normalize-quote-config');

const BEAN_CULTURE_QUOTE_CONFIG = normalizeQuoteConfig({
  business: {
    name: 'Bean Culture Coffee Cart Hire',
    tagline: 'Premium mobile coffee for events across Sydney',
    gstRegistered: true,
    abn: '33 600 754 676'
  },
  wizard: {
    steps: ['event', 'equipment', 'beverages', 'travel', 'addons', 'contact'],
    layout: 'cards',
    stepLabels: {
      event: 'Event details',
      equipment: 'Equipment',
      beverages: 'Packages',
      travel: 'Travel zone',
      addons: 'Add-ons',
      contact: 'Your details'
    },
    conditions: []
  },
  products: [
    {
      id: 'coffee-cart',
      label: 'Coffee Cart',
      description: 'Compact cart setup — ideal for foyers, offices and boutique events.',
      type: 'equipment',
      baseCents: 45000,
      baristasIncluded: 1,
      allowExtraBarista: true,
      allowQuantity: false,
      icon: 'coffee',
      displayMode: 'icon'
    },
    {
      id: 'coffee-van',
      label: 'Coffee Van',
      description: 'Full mobile van with dual-group machine and onboard power.',
      type: 'equipment',
      baseCents: 75000,
      baristasIncluded: 1,
      allowExtraBarista: true,
      allowQuantity: false,
      icon: 'truck',
      displayMode: 'icon'
    },
    {
      id: 'coffee-caravan',
      label: 'Coffee Caravan',
      description: 'Large-format caravan bar — festivals, weddings and corporate days.',
      type: 'equipment',
      baseCents: 120000,
      baristasIncluded: 1,
      allowExtraBarista: true,
      allowQuantity: false,
      icon: 'package',
      displayMode: 'icon'
    }
  ],
  labour: {
    label: 'Barista & setup labour',
    hourlyCents: 7500,
    minimumHours: 3,
    allowShiftPlanner: true,
    minimumHoursPerShift: 3,
    extraBarista: {
      enabled: true,
      label: 'Additional barista',
      hourlyCents: 7500
    }
  },
  beverages: [
    {
      id: 'espresso-package',
      label: 'Espresso-based drinks package',
      description: 'Cappuccino, latte, flat white, long black.',
      pricingMode: 'per_head',
      perHeadCents: 350,
      includedHeads: 50,
      icon: 'coffee',
      displayMode: 'icon'
    },
    {
      id: 'premium-package',
      label: 'Premium drinks package',
      description: 'Espresso drinks plus cold brew and iced options.',
      pricingMode: 'per_head',
      perHeadCents: 450,
      includedHeads: 50,
      icon: 'star',
      displayMode: 'icon'
    }
  ],
  addons: [
    {
      id: 'cup-branding',
      label: 'Custom cup branding',
      description: 'Your logo on compostable cups (artwork supplied 14 days prior).',
      fixedCents: 15000,
      icon: 'gift',
      displayMode: 'icon'
    },
    {
      id: 'extra-barista',
      label: 'Additional barista',
      description: 'Second barista for high-volume events (3 hr minimum).',
      fixedCents: 22500,
      icon: 'users',
      displayMode: 'icon'
    },
    {
      id: 'nitro-cold-brew',
      label: 'Nitro cold brew station',
      fixedCents: 18000,
      icon: 'cup-soda',
      displayMode: 'icon'
    },
    {
      id: 'decaf-option',
      label: 'Decaf bean upgrade',
      fixedCents: 3500,
      icon: 'coffee',
      displayMode: 'icon'
    }
  ],
  travel: {
    zones: [
      { id: 'inner-sydney', label: 'Inner Sydney (0–15 km)', feeCents: 0, icon: 'map-pin', displayMode: 'icon' },
      { id: 'greater-sydney', label: 'Greater Sydney (15–40 km)', feeCents: 8500, icon: 'map-pin', displayMode: 'icon' },
      { id: 'regional', label: 'Regional NSW (40+ km)', feeCents: 18000, icon: 'map-pin', displayMode: 'icon' }
    ]
  },
  rules: {
    gstRate: 0.1,
    quoteValidityDays: 14,
    minimumNoticeDays: 7
  }
});

module.exports = { BEAN_CULTURE_QUOTE_CONFIG };
