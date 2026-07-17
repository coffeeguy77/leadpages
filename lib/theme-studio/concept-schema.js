'use strict';

const { CONCEPT_SCHEMA_ID, CONCEPT_SCHEMA_VERSION } = require('./constants');

/**
 * theme_studio.concept.v1 — JSON-schema subset compatible with
 * lib/brain/schema.js validateAgainstSchema.
 */
const CONCEPT_SCHEMA_V1 = Object.freeze({
  type: 'object',
  required: [
    'schemaVersion',
    'conceptId',
    'conceptName',
    'foundationId',
    'businessProfile',
    'theme',
    'layoutId',
    'sectionOrder',
    'sections',
    'validationStatus'
  ],
  properties: {
    schemaVersion: { type: 'number', const: CONCEPT_SCHEMA_VERSION },
    conceptId: { type: 'string' },
    conceptName: { type: 'string' },
    rationale: { type: 'string' },
    foundationId: { type: 'string' },
    sourceTemplateId: { type: 'string' },
    sourceAppIds: { type: 'array', items: { type: 'string' } },
    businessProfile: {
      type: 'object',
      required: ['businessName', 'industry'],
      properties: {
        businessName: { type: 'string' },
        industry: { type: 'string' },
        specialisation: { type: 'string' },
        location: { type: 'string' },
        audience: { type: 'string' },
        tone: { type: 'string' },
        conversionGoal: { type: 'string' },
        desiredStyle: { type: 'string' }
      }
    },
    theme: {
      type: 'object',
      required: ['pipe', 'hivis', 'steel', 'safety', 'lightBg'],
      properties: {
        pipe: { type: 'string' },
        hivis: { type: 'string' },
        steel: { type: 'string' },
        safety: { type: 'string' },
        lightBg: { type: 'string' },
        accent: { type: 'string' },
        presetName: { type: 'string' },
        presetKey: { type: 'string' }
      }
    },
    typography: {
      type: 'object',
      properties: {
        fontDisplay: { type: 'string' },
        fontUi: { type: 'string' }
      }
    },
    globalStyles: {
      type: 'object',
      properties: {
        buttonTreatment: { type: 'string' },
        cardTreatment: { type: 'string' },
        motionDirection: { type: 'string' },
        density: { type: 'string' },
        colorMode: { type: 'string' }
      }
    },
    layoutId: { type: 'string' },
    header: {
      type: 'object',
      properties: {
        headerStyle: { type: 'string' },
        ctaLabel: { type: 'string' }
      }
    },
    navigation: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              target: { type: 'string' }
            }
          }
        }
      }
    },
    pages: { type: 'array', items: { type: 'object' } },
    sectionOrder: { type: 'array', items: { type: 'string' } },
    sections: { type: 'object' },
    sectionVariants: { type: 'object' },
    content: { type: 'object' },
    callsToAction: {
      type: 'object',
      properties: {
        primary: { type: 'object' },
        secondary: { type: 'object' }
      }
    },
    imagery: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sectionKey: { type: 'string' },
          subject: { type: 'string' },
          composition: { type: 'string' },
          altDirection: { type: 'string' }
        }
      }
    },
    footer: { type: 'object' },
    mobileRules: {
      type: 'object',
      properties: {
        notes: { type: 'array', items: { type: 'string' } },
        stickyCta: { type: 'boolean' },
        stackOrder: { type: 'string' }
      }
    },
    accessibilityNotes: { type: 'array', items: { type: 'string' } },
    preservedFields: { type: 'array', items: { type: 'string' } },
    generatedFields: { type: 'array', items: { type: 'string' } },
    placeholderFields: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          reason: { type: 'string' }
        }
      }
    },
    validationStatus: { type: 'string' },
    warnings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          path: { type: 'string' }
        }
      }
    },
    provenance: {
      type: 'object',
      properties: {
        generatedBy: { type: 'string' },
        fixtureId: { type: 'string' },
        createdAt: { type: 'string' },
        brainTasks: { type: 'array', items: { type: 'string' } }
      }
    }
  }
});

module.exports = {
  CONCEPT_SCHEMA_ID,
  CONCEPT_SCHEMA_VERSION,
  CONCEPT_SCHEMA_V1
};
