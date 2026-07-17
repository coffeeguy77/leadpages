'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  createBrain,
  BrainError,
  CODES,
  createAnthropicAdapter,
} = require('../lib/brain');

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return typeof body === 'string' ? body : JSON.stringify(body);
    },
  };
}

describe('createAnthropicAdapter', () => {
  it('sends Messages API request with LeadPages-compatible headers', async () => {
    let captured;
    const fetchImpl = async (url, init) => {
      captured = { url, init };
      return jsonResponse(200, {
        id: 'msg_1',
        model: 'claude-sonnet-4-20250514',
        content: [{ type: 'text', text: 'Hello from Claude' }],
        usage: { input_tokens: 12, output_tokens: 4 },
        stop_reason: 'end_turn',
      });
    };

    const adapter = createAnthropicAdapter({
      apiKey: 'sk-test',
      fetchImpl,
    });

    const result = await adapter.generate({
      correlationId: 'c1',
      model: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      messages: [
        { role: 'system', content: 'Be brief' },
        { role: 'user', content: 'Hi' },
      ],
      temperature: 0.2,
      maxTokens: 256,
    });

    assert.equal(captured.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(captured.init.method, 'POST');
    assert.equal(captured.init.headers['x-api-key'], 'sk-test');
    assert.equal(captured.init.headers['anthropic-version'], '2023-06-01');
    assert.equal(captured.init.headers['content-type'], 'application/json');

    const body = JSON.parse(captured.init.body);
    assert.equal(body.model, 'claude-sonnet-4-20250514');
    assert.equal(body.system, 'Be brief');
    assert.equal(body.max_tokens, 256);
    assert.equal(body.temperature, 0.2);
    assert.deepEqual(body.messages, [{ role: 'user', content: 'Hi' }]);

    assert.equal(result.text, 'Hello from Claude');
    assert.equal(result.model.provider, 'anthropic');
    assert.equal(result.usage.inputTokens, 12);
    assert.equal(result.usage.outputTokens, 4);
    assert.equal(result.providerRequestId, 'msg_1');
  });

  it('parses structured JSON when responseSchema is set', async () => {
    let captured;
    const fetchImpl = async (_url, init) => {
      captured = init;
      return jsonResponse(200, {
        id: 'msg_2',
        model: 'claude-sonnet-4-20250514',
        content: [
          {
            type: 'text',
            text: '{"title":"Roof repair","body":"Local specialists"}',
          },
        ],
        usage: { input_tokens: 40, output_tokens: 20 },
        stop_reason: 'end_turn',
      });
    };

    const adapter = createAnthropicAdapter({ apiKey: 'sk-test', fetchImpl });
    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['title', 'body'],
    };

    const result = await adapter.generate({
      correlationId: 'c2',
      model: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      messages: [{ role: 'user', content: 'Draft landing copy' }],
      responseSchema: schema,
    });

    const body = JSON.parse(captured.body);
    assert.match(String(body.system), /valid JSON only/i);
    assert.match(String(body.system), /"title"/);
    assert.deepEqual(result.json, {
      title: 'Roof repair',
      body: 'Local specialists',
    });
  });

  it('maps 429 to BrainError provider_rate_limit', async () => {
    const adapter = createAnthropicAdapter({
      apiKey: 'sk-test',
      fetchImpl: async () => jsonResponse(429, { error: { message: 'slow down' } }),
    });

    await assert.rejects(
      () =>
        adapter.generate({
          model: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      (err) => {
        assert.ok(err instanceof BrainError);
        assert.equal(err.code, CODES.provider_rate_limit);
        assert.equal(err.retryable, true);
        return true;
      }
    );
  });

  it('maps 401 to BrainError provider_auth', async () => {
    const adapter = createAnthropicAdapter({
      apiKey: 'sk-test',
      fetchImpl: async () => jsonResponse(401, { error: { message: 'bad key' } }),
    });

    await assert.rejects(
      () =>
        adapter.generate({
          model: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      (err) => {
        assert.ok(err instanceof BrainError);
        assert.equal(err.code, CODES.provider_auth);
        return true;
      }
    );
  });

  it('fails closed when api key is missing', async () => {
    const adapter = createAnthropicAdapter({ apiKey: '' });
    await assert.rejects(
      () =>
        adapter.generate({
          model: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      (err) => err instanceof BrainError && err.code === CODES.provider_auth
    );
  });

  it('healthCheck reports missing key', async () => {
    const adapter = createAnthropicAdapter({ apiKey: '' });
    const health = await adapter.healthCheck();
    assert.equal(health.ok, false);
    assert.match(health.detail, /missing/i);
  });
});

describe('createBrain with anthropic adapter', () => {
  it('routes generate through anthropic when configured', async () => {
    const fetchImpl = async () =>
      jsonResponse(200, {
        id: 'msg_3',
        model: 'claude-haiku-4-5-20251001',
        content: [{ type: 'text', text: 'Routed ok' }],
        usage: { input_tokens: 5, output_tokens: 2 },
        stop_reason: 'end_turn',
      });

    const brain = createBrain({
      fetchImpl,
      anthropic: { apiKey: 'sk-test' },
      config: {
        defaultProvider: 'anthropic',
        models: {
          'anthropic:haiku': {
            provider: 'anthropic',
            model: 'claude-haiku-4-5-20251001',
            capabilities: ['text'],
            maxTokens: 4096,
          },
          'mock:default': {
            provider: 'mock',
            model: 'mock-default',
            capabilities: ['text', 'structured_json'],
            maxTokens: 4096,
          },
        },
        routes: {
          'content.landing_draft': {
            taskId: 'content.landing_draft',
            primary: {
              provider: 'anthropic',
              model: 'claude-haiku-4-5-20251001',
            },
            structured: false,
          },
        },
      },
    });

    const result = await brain.generate({
      taskId: 'content.landing_draft',
      messages: [{ role: 'user', content: 'Write a hero' }],
    });

    assert.equal(result.ok, true);
    assert.equal(result.model.provider, 'anthropic');
    assert.equal(result.output.text, 'Routed ok');
    assert.equal(result.model.model, 'claude-haiku-4-5-20251001');
  });

  it('falls back to mock when anthropic fails and fallback is configured', async () => {
    const fetchImpl = async () => jsonResponse(500, { error: { message: 'boom' } });

    const brain = createBrain({
      fetchImpl,
      anthropic: { apiKey: 'sk-test' },
      config: {
        defaultProvider: 'anthropic',
        models: {
          'anthropic:sonnet': {
            provider: 'anthropic',
            model: 'claude-sonnet-4-20250514',
            capabilities: ['text'],
            maxTokens: 8192,
          },
          'mock:default': {
            provider: 'mock',
            model: 'mock-default',
            capabilities: ['text', 'structured_json'],
            maxTokens: 4096,
          },
        },
        routes: {
          'help.answer': {
            taskId: 'help.answer',
            primary: {
              provider: 'anthropic',
              model: 'claude-sonnet-4-20250514',
            },
            fallback: [{ provider: 'mock', model: 'mock-default' }],
            structured: false,
          },
        },
      },
    });

    const result = await brain.generate({
      taskId: 'help.answer',
      messages: [{ role: 'user', content: 'Need help' }],
    });

    assert.equal(result.ok, true);
    assert.equal(result.model.provider, 'mock');
    assert.equal(result.routing.fallbackUsed, true);
    assert.match(result.output.text, /Need help/);
  });

  it('generateStructured validates anthropic JSON against schema', async () => {
    const fetchImpl = async () =>
      jsonResponse(200, {
        id: 'msg_4',
        model: 'claude-sonnet-4-20250514',
        content: [
          {
            type: 'text',
            text: '{"title":"Mock title","bodyMarkdown":"# Draft\\n\\nBody"}',
          },
        ],
        usage: { input_tokens: 10, output_tokens: 30 },
        stop_reason: 'end_turn',
      });

    const brain = createBrain({
      fetchImpl,
      anthropic: { apiKey: 'sk-test' },
      config: {
        models: {
          'anthropic:sonnet': {
            provider: 'anthropic',
            model: 'claude-sonnet-4-20250514',
            capabilities: ['text', 'structured_json'],
            maxTokens: 8192,
          },
        },
        routes: {
          'content.landing_draft': {
            taskId: 'content.landing_draft',
            primary: {
              provider: 'anthropic',
              model: 'claude-sonnet-4-20250514',
            },
            structured: true,
          },
        },
      },
    });

    const result = await brain.generateStructured({
      taskId: 'content.landing_draft',
      input: { brief: 'Roofers in Canberra' },
      responseSchema: {
        type: 'object',
        required: ['title', 'bodyMarkdown'],
        properties: {
          title: { type: 'string' },
          bodyMarkdown: { type: 'string' },
        },
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.output.title, 'Mock title');
    assert.match(result.output.bodyMarkdown, /Draft/);
  });
});
