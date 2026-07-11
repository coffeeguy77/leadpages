/**
 * Starter config for tenant-built online quote systems (classification: public).
 */

function blankQuoteConfig(businessName) {
  return {
    business: {
      name: businessName || 'Your business',
      tagline: 'Get a verified online quote',
      gstRegistered: true
    },
    wizard: {
      steps: ['equipment', 'beverages', 'travel', 'addons', 'contact'],
      layout: 'cards',
      stepLabels: {
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
        id: 'service-1',
        label: 'Standard service',
        description: 'Describe your main service or product line.',
        type: 'equipment',
        baseCents: 0
      }
    ],
    labour: {
      label: 'Labour',
      hourlyCents: 7500,
      minimumHours: 1
    },
    beverages: [],
    addons: [],
    travel: {
      zones: [
        { id: 'local', label: 'Local area', feeCents: 0 }
      ]
    },
    rules: {
      gstRate: 0.1,
      quoteValidityDays: 14,
      minimumNoticeDays: 3
    }
  };
}

module.exports = { blankQuoteConfig };
