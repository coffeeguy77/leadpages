'use strict';

/** Structured output schemas for Brain generateStructured */

const GENERATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'root', 'category', 'reason'],
        properties: {
          name: { type: 'string' },
          root: { type: 'string' },
          category: { type: 'string' },
          reason: { type: 'string' }
        }
      }
    }
  }
};

const RANK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ranked'],
  properties: {
    ranked: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['root', 'overall_score', 'reason'],
        properties: {
          root: { type: 'string' },
          overall_score: { type: 'number' },
          brandability: { type: 'number' },
          relevance: { type: 'number' },
          memorability: { type: 'number' },
          spelling: { type: 'number' },
          pronunciation: { type: 'number' },
          professionalism: { type: 'number' },
          growth_potential: { type: 'number' },
          reason: { type: 'string' },
          badge: { type: 'string' }
        }
      }
    }
  }
};

module.exports = { GENERATE_SCHEMA, RANK_SCHEMA };
