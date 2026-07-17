'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  createBrain,
  createOpenAIAdapter,
  createGeminiAdapter,
  BrainError,
  CODES,
} = require('../lib/brain');

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

describe('OpenAI adapter', () => {
  it('sends chat completions with Bearer auth', async () => {
    let captured;
    const adapter = createOpenAIAdapter({
      apiKey: 'sk-openai',
      fetchImpl: async (url, init) => {
        captured = { url, init };
        return jsonResponse(200, {
          id: 'chatcmpl-1',
          choices: [{ message: { role: 'assistant', content: 'Hello GPT' } }],
          usage: { prompt_tokens: 8, completion_tokens: 3 },
        });
      },
    });

    const result = await adapter.generate({
      model: { provider: 'openai', model: 'gpt-4o-mini' },
      messages: [
        { role: 'system', content: 'Be brief' },
        { role: 'user', content: 'Hi' },
      ],
      maxTokens: 128,
      temperature: 0.1,
    });

    assert.equal(captured.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(captured.init.headers.authorization, 'Bearer sk-openai');
    const body = JSON.parse(captured.init.body);
    assert.equal(body.model, 'gpt-4o-mini');
    assert.equal(body.max_tokens, 128);
    assert.equal(body.temperature, 0.1);
    assert.equal(result.text, 'Hello GPT');
    assert.equal(result.usage.inputTokens, 8);
    assert.equal(result.model.provider, 'openai');
  });

  it('requests json_object for structured output', async () => {
    let captured;
    const adapter = createOpenAIAdapter({
      apiKey: 'sk-openai',
      fetchImpl: async (_u, init) => {
        captured = init;
        return jsonResponse(200, {
          id: 'chatcmpl-2',
          choices: [{ message: { content: '{"title":"A","bodyMarkdown":"B"}' } }],
          usage: { prompt_tokens: 1, completion_tokens: 2 },
        });
      },
    });

    const result = await adapter.generate({
      model: { provider: 'openai', model: 'gpt-4o-mini' },
      messages: [{ role: 'user', content: 'draft' }],
      responseSchema: {
        type: 'object',
        required: ['title', 'bodyMarkdown'],
        properties: { title: { type: 'string' }, bodyMarkdown: { type: 'string' } },
      },
    });

    const body = JSON.parse(captured.body);
    assert.equal(body.response_format.type, 'json_object');
    assert.deepEqual(result.json, { title: 'A', bodyMarkdown: 'B' });
  });

  it('maps 429 to provider_rate_limit', async () => {
    const adapter = createOpenAIAdapter({
      apiKey: 'sk-openai',
      fetchImpl: async () => jsonResponse(429, { error: { message: 'rate' } }),
    });
    await assert.rejects(
      () =>
        adapter.generate({
          model: { provider: 'openai', model: 'gpt-4o-mini' },
          messages: [{ role: 'user', content: 'x' }],
        }),
      (err) => err instanceof BrainError && err.code === CODES.provider_rate_limit
    );
  });
});

describe('Gemini adapter', () => {
  it('sends generateContent with API key query param', async () => {
    let captured;
    const adapter = createGeminiAdapter({
      apiKey: 'gem-key',
      fetchImpl: async (url, init) => {
        captured = { url, init };
        return jsonResponse(200, {
          candidates: [{ content: { parts: [{ text: 'Hello Gemini' }] } }],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 4 },
        });
      },
    });

    const result = await adapter.generate({
      model: { provider: 'gemini', model: 'gemini-2.0-flash' },
      messages: [
        { role: 'system', content: 'Be brief' },
        { role: 'user', content: 'Hi' },
      ],
      maxTokens: 256,
    });

    assert.match(captured.url, /gemini-2\.0-flash:generateContent/);
    assert.match(captured.url, /key=gem-key/);
    const body = JSON.parse(captured.init.body);
    assert.equal(body.systemInstruction.parts[0].text, 'Be brief');
    assert.equal(body.generationConfig.maxOutputTokens, 256);
    assert.equal(result.text, 'Hello Gemini');
    assert.equal(result.usage.inputTokens, 5);
    assert.equal(result.model.provider, 'gemini');
  });

  it('uses responseMimeType application/json for structured', async () => {
    let captured;
    const adapter = createGeminiAdapter({
      apiKey: 'gem-key',
      fetchImpl: async (_u, init) => {
        captured = init;
        return jsonResponse(200, {
          candidates: [
            { content: { parts: [{ text: '{"title":"T","bodyMarkdown":"M"}' }] } },
          ],
          usageMetadata: {},
        });
      },
    });

    const result = await adapter.generate({
      model: { provider: 'gemini', model: 'gemini-2.0-flash' },
      messages: [{ role: 'user', content: 'draft' }],
      responseSchema: {
        type: 'object',
        required: ['title', 'bodyMarkdown'],
        properties: { title: { type: 'string' }, bodyMarkdown: { type: 'string' } },
      },
    });

    const body = JSON.parse(captured.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(result.json.title, 'T');
  });

  it('maps safety block to provider_content_filter', async () => {
    const adapter = createGeminiAdapter({
      apiKey: 'gem-key',
      fetchImpl: async () =>
        jsonResponse(200, { promptFeedback: { blockReason: 'SAFETY' } }),
    });
    await assert.rejects(
      () =>
        adapter.generate({
          model: { provider: 'gemini', model: 'gemini-2.0-flash' },
          messages: [{ role: 'user', content: 'x' }],
        }),
      (err) => err instanceof BrainError && err.code === CODES.provider_content_filter
    );
  });
});

describe('capability matrix (comparative contract)', () => {
  const providers = [
    {
      name: 'openai',
      create: createOpenAIAdapter,
      model: { provider: 'openai', model: 'gpt-4o-mini' },
      apiKey: 'sk-test',
      success: () =>
        jsonResponse(200, {
          id: 'x',
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
    },
    {
      name: 'gemini',
      create: createGeminiAdapter,
      model: { provider: 'gemini', model: 'gemini-2.0-flash' },
      apiKey: 'gem-test',
      success: () =>
        jsonResponse(200, {
          candidates: [{ content: { parts: [{ text: 'ok' }] } }],
          usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
        }),
    },
  ];

  for (const p of providers) {
    it(p.name + ' healthCheck + text generate envelope', async () => {
      const adapter = p.create({
        apiKey: p.apiKey,
        fetchImpl: async () => p.success(),
      });
      const health = await adapter.healthCheck();
      assert.equal(health.ok, true);
      assert.ok(adapter.capabilities().has('text'));
      assert.ok(adapter.capabilities().has('structured_json'));

      const result = await adapter.generate({
        model: p.model,
        messages: [{ role: 'user', content: 'ping' }],
      });
      assert.equal(typeof result.text, 'string');
      assert.equal(result.model.provider, p.name);
      assert.ok(result.usage);
      assert.ok(typeof result.latencyMs === 'number');
    });
  }

  it('gateway routes through openai when configured', async () => {
    const brain = createBrain({
      openai: { apiKey: 'sk-test' },
      fetchImpl: async () =>
        jsonResponse(200, {
          id: 'c',
          choices: [{ message: { content: 'via openai' } }],
          usage: { prompt_tokens: 2, completion_tokens: 2 },
        }),
      config: {
        models: {
          'openai:default': {
            provider: 'openai',
            model: 'gpt-4o-mini',
            maxTokens: 100,
          },
        },
        routes: {
          'generic.fast': {
            taskId: 'generic.fast',
            primary: { provider: 'openai', model: 'gpt-4o-mini' },
          },
        },
      },
    });
    const res = await brain.generate({
      taskId: 'generic.fast',
      messages: [{ role: 'user', content: 'hi' }],
    });
    assert.equal(res.ok, true);
    assert.equal(res.model.provider, 'openai');
    assert.equal(res.output.text, 'via openai');
  });
});
