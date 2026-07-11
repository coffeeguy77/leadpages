/**
 * Bean Culture Coffee Cart Hire — private superuser quote config.
 * Seeded only onto slug=beanculture; never exposed via public APIs.
 */

const BEAN_CULTURE_QUOTE_CONFIG = {
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
      baseCents: 45000
    },
    {
      id: 'coffee-van',
      label: 'Coffee Van',
      description: 'Full mobile van with dual-group machine and onboard power.',
      type: 'equipment',
      baseCents: 75000
    },
    {
      id: 'coffee-caravan',
      label: 'Coffee Caravan',
      description: 'Large-format caravan bar — festivals, weddings and corporate days.',
      type: 'equipment',
      baseCents: 120000
    }
  ],
  labour: {
    label: 'Barista & setup labour',
    hourlyCents: 7500,
    minimumHours: 3
  },
  beverages: [
    {
      id: 'espresso-package',
      label: 'Espresso-based drinks package',
      description: 'Cappuccino, latte, flat white, long black.',
      perHeadCents: 350,
      includedHeads: 50
    },
    {
      id: 'premium-package',
      label: 'Premium drinks package',
      description: 'Espresso drinks plus cold brew and iced options.',
      perHeadCents: 450,
      includedHeads: 50
    }
  ],
  addons: [
    {
      id: 'cup-branding',
      label: 'Custom cup branding',
      description: 'Your logo on compostable cups (artwork supplied 14 days prior).',
      fixedCents: 15000
    },
    {
      id: 'extra-barista',
      label: 'Additional barista',
      description: 'Second barista for high-volume events (3 hr minimum).',
      fixedCents: 22500
    },
    {
      id: 'nitro-cold-brew',
      label: 'Nitro cold brew station',
      fixedCents: 18000
    },
    {
      id: 'decaf-option',
      label: 'Decaf bean upgrade',
      fixedCents: 3500
    }
  ],
  travel: {
    zones: [
      { id: 'inner-sydney', label: 'Inner Sydney (0–15 km)', feeCents: 0 },
      { id: 'greater-sydney', label: 'Greater Sydney (15–40 km)', feeCents: 8500 },
      { id: 'regional', label: 'Regional NSW (40+ km)', feeCents: 18000 }
    ]
  },
  rules: {
    gstRate: 0.1,
    quoteValidityDays: 14,
    minimumNoticeDays: 7
  }
};

module.exports = { BEAN_CULTURE_QUOTE_CONFIG };
