/**
 * Online Quote System — response serializers.
 * Enforces separate API response levels; never leak pricing below verification tier.
 */

const { RESPONSE_LEVEL } = require('./constants');
const { publicChoiceFields } = require('./display');

function mapPublicChoice(item) {
  const base = publicChoiceFields(item);
  return Object.assign({
    id: item.id,
    label: item.label,
    description: item.description || null,
    showWhen: item.showWhen || null
  }, base);
}

function maskEmail(email) {
  const e = String(email || '').trim();
  const at = e.indexOf('@');
  if (at < 2) return e ? '***' : '';
  return e.slice(0, 1) + '***' + e.slice(at);
}

function maskPhone(phone) {
  const p = String(phone || '').replace(/\s/g, '');
  if (p.length < 4) return p ? '***' : '';
  return '***' + p.slice(-3);
}

function publicProductLabels(config) {
  const products = (config && config.products) || [];
  const addons = (config && config.addons) || [];
  const travel = (config && config.travel) || {};
  const wizard = (config && config.wizard) || {};
  return {
    products: products.map(function(p) {
      return Object.assign(mapPublicChoice(p), {
        type: p.type || 'equipment',
        baristasIncluded: p.baristasIncluded != null ? p.baristasIncluded : 1,
        allowExtraBarista: p.allowExtraBarista !== false,
        allowQuantity: !!p.allowQuantity,
        maxQuantity: p.maxQuantity != null ? p.maxQuantity : null,
        badge: p.badge || null,
        subtitle: p.subtitle || null,
        imageFit: p.imageFit || 'cover',
        imagePos: p.imagePos || 'center',
        imageAxis: p.imageAxis === 'height' || p.imageAxis === 'width' ? p.imageAxis : 'frame'
      });
    }),
    addons: addons.map(mapPublicChoice),
    beverages: ((config && config.beverages) || []).map(function(b) {
      return Object.assign(mapPublicChoice(b), {
        pricingMode: b.pricingMode || ((b.tiers && b.tiers.length) ? 'tiered' : 'per_head'),
        unitLabel: b.unitLabel || null,
        group: b.group || b.category || null
      });
    }),
    travelZones: ((travel.zones) || []).map(function(z) {
      return Object.assign(mapPublicChoice(z), {
        badge: z.badge || null,
        subtitle: z.subtitle || null,
        imageFit: z.imageFit || 'cover',
        imagePos: z.imagePos || 'center',
        imageAxis: z.imageAxis === 'height' || z.imageAxis === 'width' ? z.imageAxis : 'frame'
      });
    }),
    wizard: {
      steps: wizard.steps || ['equipment', 'beverages', 'addons', 'contact'],
      layout: wizard.layout || 'cards',
      stepLabels: wizard.stepLabels || {},
      conditions: wizard.conditions || [],
      equipmentCards: wizard.equipmentCards || {},
      travelCards: wizard.travelCards || {},
      ui: wizard.ui || {},
      allowMultiCart: !!wizard.allowMultiCart,
      customFields: Array.isArray(wizard.customFields)
        ? wizard.customFields.map(function(f) {
          return {
            id: f.id,
            type: f.type || 'text',
            label: f.label || 'Question',
            placeholder: f.placeholder || '',
            helpText: f.helpText || '',
            required: !!f.required,
            options: Array.isArray(f.options) ? f.options : [],
            attachTo: f.attachTo === 'event' || f.attachTo === 'contact' ? f.attachTo : 'custom'
          };
        })
        : []
    },
    business: {
      name: (config && config.business && config.business.name) || null,
      tagline: (config && config.business && config.business.tagline) || null
    },
    labour: {
      label: (config && config.labour && config.labour.label) || 'Labour',
      minimumHours: (config && config.labour && config.labour.minimumHours) || 3,
      allowShiftPlanner: (config && config.labour && config.labour.allowShiftPlanner) !== false,
      minimumHoursPerShift: (config && config.labour && config.labour.minimumHoursPerShift) || (config && config.labour && config.labour.minimumHours) || 3,
      extraBarista: {
        enabled: !config || !config.labour || !config.labour.extraBarista || config.labour.extraBarista.enabled !== false,
        label: (config && config.labour && config.labour.extraBarista && config.labour.extraBarista.label) || 'Additional barista',
        splitShift: (function() {
          var ss = config && config.labour && config.labour.extraBarista && config.labour.extraBarista.splitShift;
          return {
            enabled: !ss || ss.enabled !== false,
            label: (ss && ss.label) || 'Split-shift barista (peak)',
            hourlyCents: (ss && ss.hourlyCents != null) ? ss.hourlyCents : 10000,
            minimumHours: (ss && ss.minimumHours != null) ? ss.minimumHours : 3,
            defaultHours: (ss && ss.defaultHours != null) ? ss.defaultHours : 4
          };
        })()
      }
    }
  };
}

function formatMoney(cents) {
  return '$' + (Math.round(cents) / 100).toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function serializeQuoteResult(calc, level) {
  const base = {
    level,
    versionNumber: calc.versionNumber || 1,
    currency: 'AUD'
  };

  if (level === RESPONSE_LEVEL.PUBLIC_PROGRESS) {
    return Object.assign(base, {
      hasQuote: calc.totalCents > 0,
      message: calc.totalCents > 0
        ? 'Verify your email to see your quote total.'
        : 'Complete the wizard to receive your quote.'
    });
  }

  if (level === RESPONSE_LEVEL.EMAIL_VERIFIED_TOTAL) {
    return Object.assign(base, {
      totalCents: calc.totalCents,
      totalFormatted: formatMoney(calc.totalCents),
      totalIncGst: true,
      message: 'Verify your mobile number to unlock the full itemised breakdown.'
    });
  }

  if (level === RESPONSE_LEVEL.FULLY_VERIFIED_QUOTE) {
    return Object.assign(base, {
      subtotalCents: calc.subtotalCents,
      gstCents: calc.gstCents,
      totalCents: calc.totalCents,
      subtotalFormatted: formatMoney(calc.subtotalCents),
      gstFormatted: formatMoney(calc.gstCents),
      totalFormatted: formatMoney(calc.totalCents),
      breakdown: calc.breakdown || [],
      inputs: calc.inputs || {}
    });
  }

  if (level === RESPONSE_LEVEL.AUTHORISED_ADMIN_QUOTE) {
    return Object.assign(base, {
      subtotalCents: calc.subtotalCents,
      gstCents: calc.gstCents,
      totalCents: calc.totalCents,
      breakdown: calc.breakdown || [],
      inputs: calc.inputs || {},
      configVersionId: calc.configVersionId || null,
      sessionId: calc.sessionId || null
    });
  }

  return base;
}

function serializeSession(session, level) {
  if (!session) return null;
  const out = {
    id: session.id,
    status: session.status,
    level,
    progress: session.progress || {},
    contact: {
      name: session.contact_name || null,
      email: session.contact_email ? maskEmail(session.contact_email) : null,
      phone: session.contact_phone ? maskPhone(session.contact_phone) : null
    },
    emailVerified: !!session.email_verified_at,
    smsVerified: !!session.sms_verified_at
  };
  if (level === RESPONSE_LEVEL.AUTHORISED_ADMIN_QUOTE) {
    out.contact = {
      name: session.contact_name || null,
      email: session.contact_email || null,
      phone: session.contact_phone || null
    };
    out.leadId = session.lead_id || null;
    out.createdAt = session.created_at;
    out.updatedAt = session.updated_at;
  }
  return out;
}

function serializePublicConfig(config, quoteSystem) {
  return {
    enabled: !!(quoteSystem && quoteSystem.enabled),
    classification: (quoteSystem && quoteSystem.configuration_classification) || 'blank',
    shell: publicProductLabels(config || {})
  };
}

function serializeAdminConfig(configVersion, quoteSystem) {
  return {
    quoteSystemId: quoteSystem.id,
    siteId: quoteSystem.site_id,
    enabled: quoteSystem.enabled,
    classification: quoteSystem.configuration_classification,
    activeVersion: configVersion ? {
      id: configVersion.id,
      versionNumber: configVersion.version_number,
      label: configVersion.label,
      config: configVersion.config,
      createdAt: configVersion.created_at
    } : null
  };
}

module.exports = {
  maskEmail,
  maskPhone,
  publicProductLabels,
  formatMoney,
  serializeQuoteResult,
  serializeSession,
  serializePublicConfig,
  serializeAdminConfig
};
