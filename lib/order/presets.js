'use strict';

/**
 * Industry presets — seed defaults only; never permanently restrict configuration.
 */

const PRESETS = {
  butcher: {
    label: 'Butcher',
    industry_preset: 'butcher',
    defaults: {
      enabled: true,
      pickup_enabled: true,
      delivery_enabled: false,
      customer_editing_enabled: true,
      change_mode: 'automatic',
      default_cutoff_mode: 'days_before',
      default_cutoff_value: 3,
      default_cutoff_time: '17:00',
      payment_rule: 'fixed_deposit',
      deposit_amount_cents: 5000,
      deposit_scope: 'per_order',
      balance_settlement: 'at_pickup',
      default_stock_method: 'made_to_order',
      abandoned_cart_enabled: true,
      abandoned_cart_delay_minutes: 60,
      abandoned_cart_channels: ['email', 'sms'],
      storefront_display_mode: 'compact_cards',
      cross_sell_heading: "Don't Forget",
      order_prefix: 'ORD'
    },
    sample_categories: [
      { name: 'Steaks', slug: 'steaks' },
      { name: 'Sausages', slug: 'sausages' },
      { name: 'Roasts & Whole', slug: 'roasts' },
      { name: 'Sauces & Extras', slug: 'extras' }
    ],
    sample_products: [
      {
        name: 'Rib Eye Steak',
        slug: 'rib-eye-steak',
        category_slug: 'steaks',
        pricing_method: 'per_weight',
        price_per_kg_cents: 5499,
        weight_required: true,
        stock_method: 'made_to_order',
        cutoff_mode: 'days_before',
        cutoff_value: 1,
        lead_time_mode: 'days',
        lead_time_value: 1,
        unit_label: 'steak',
        short_description: 'Price finalised after preparation and weighing.'
      },
      {
        name: 'Sausages',
        slug: 'sausages',
        category_slug: 'sausages',
        pricing_method: 'per_weight',
        price_per_kg_cents: 1899,
        weight_required: true,
        stock_method: 'made_to_order',
        cutoff_mode: 'hours_before',
        cutoff_value: 12,
        lead_time_mode: 'hours',
        lead_time_value: 12,
        unit_label: 'kg'
      },
      {
        name: 'Whole Lamb',
        slug: 'whole-lamb',
        category_slug: 'roasts',
        pricing_method: 'price_tbc',
        stock_method: 'made_to_order',
        cutoff_mode: 'days_before',
        cutoff_value: 5,
        lead_time_mode: 'days',
        lead_time_value: 5,
        unit_label: 'each',
        short_description: 'Final price TBC after preparation.'
      },
      {
        name: 'BBQ Sauce',
        slug: 'bbq-sauce',
        category_slug: 'extras',
        pricing_method: 'fixed',
        price_cents: 1200,
        stock_method: 'unlimited',
        cutoff_mode: 'none',
        lead_time_mode: 'none',
        unit_label: 'bottle'
      }
    ],
    sample_templates: [
      {
        category: 'abandoned_cart',
        name: 'Default abandoned cart',
        channel: 'sms',
        body:
          "Don't leave your steaks hanging, {{first_name}}. Your butcher order is still waiting: {{checkout_link}}"
      },
      {
        category: 'deposit_required',
        name: 'Deposit link',
        channel: 'sms',
        body:
          'Hi {{first_name}}, pay your ${{deposit_amount}} deposit for order {{order_number}}: {{deposit_link}}'
      },
      {
        category: 'order_locked',
        name: 'Order locked',
        channel: 'sms',
        body:
          'Order {{order_number}} is now locked and being prepared. Pickup {{pickup_date}}. Contact us if you need help.'
      }
    ]
  },
  bakery: {
    label: 'Bakery',
    industry_preset: 'bakery',
    defaults: {
      enabled: true,
      payment_rule: 'full_payment',
      deposit_amount_cents: 0,
      balance_settlement: 'online_before_pickup',
      default_cutoff_mode: 'hours_before',
      default_cutoff_value: 24,
      default_stock_method: 'made_to_order',
      storefront_display_mode: 'image_cards',
      cross_sell_heading: 'You Might Also Like',
      order_prefix: 'BKE'
    }
  },
  florist: {
    label: 'Florist',
    industry_preset: 'florist',
    defaults: {
      enabled: true,
      payment_rule: 'full_payment',
      delivery_enabled: true,
      pickup_enabled: true,
      default_cutoff_mode: 'hours_before',
      default_cutoff_value: 6,
      order_prefix: 'FLR'
    }
  },
  beer_supplies: {
    label: 'Beer / brewing supplies',
    industry_preset: 'beer_supplies',
    defaults: {
      enabled: true,
      payment_rule: 'full_payment',
      default_stock_method: 'stock_controlled',
      storefront_display_mode: 'catalogue_grid',
      abandoned_cart_enabled: true,
      order_prefix: 'BRW'
    }
  },
  printing: {
    label: 'Printing',
    industry_preset: 'printing',
    defaults: {
      enabled: true,
      payment_rule: 'percentage_deposit',
      deposit_percent_bps: 5000,
      balance_settlement: 'online_before_pickup',
      default_stock_method: 'made_to_order',
      order_prefix: 'PRT'
    }
  },
  custom: {
    label: 'Custom',
    industry_preset: 'custom',
    defaults: {
      enabled: true,
      payment_rule: 'none',
      order_prefix: 'ORD'
    }
  }
};

function listPresets() {
  return Object.keys(PRESETS).map(function (k) {
    return { id: k, label: PRESETS[k].label };
  });
}

function getPreset(id) {
  return PRESETS[id] || PRESETS.custom;
}

module.exports = { PRESETS, listPresets, getPreset };
