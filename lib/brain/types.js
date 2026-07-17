'use strict';

/**
 * Shared JSDoc types for LeadPages Brain (Phase 1).
 * Not runtime code — imported only for editor/type hints via require of this file's exports.
 */

/**
 * @typedef {'anthropic'|'openai'|'gemini'|'mock'|string} ProviderId
 *
 * @typedef {{ provider: ProviderId, model: string }} ModelRef
 *
 * @typedef {{ role: 'system'|'user'|'assistant', content: string }} BrainMessage
 *
 * @typedef {object} GenerateRequest
 * @property {string} correlationId
 * @property {BrainMessage[]} messages
 * @property {ModelRef} model
 * @property {number} [maxTokens]
 * @property {number} [temperature]
 * @property {object} [responseSchema]
 * @property {number} [timeoutMs]
 * @property {boolean} [stream]
 *
 * @typedef {object} GenerateResult
 * @property {string} [text]
 * @property {unknown} [json]
 * @property {{ inputTokens?: number, outputTokens?: number, cachedTokens?: number }} usage
 * @property {string} [providerRequestId]
 * @property {number} latencyMs
 * @property {ModelRef} model
 *
 * @typedef {object} ProviderAdapter
 * @property {ProviderId} id
 * @property {() => Set<string>} capabilities
 * @property {(req: GenerateRequest) => Promise<GenerateResult>} generate
 * @property {() => Promise<{ ok: boolean, detail?: string }>} healthCheck
 *
 * @typedef {object} BrainActor
 * @property {string} [userId]
 * @property {string} [role]
 * @property {string} [partnerId]
 *
 * @typedef {object} BrainGenerateInput
 * @property {string} [correlationId]
 * @property {string} taskId
 * @property {string} [promptId]
 * @property {string} [siteId]
 * @property {BrainActor} [actor]
 * @property {string[]} [contextSlices]
 * @property {Record<string, unknown>|string} [input]
 * @property {BrainMessage[]} [messages]
 * @property {object} [responseSchema]
 * @property {string} [idempotencyKey]
 * @property {boolean} [stream]
 */

module.exports = {};
