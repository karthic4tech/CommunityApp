import { createClassifier } from './openai.ts';
const catalog = { categories: [], locations: [] };
for (const [status, providerCode, expected] of [[401, 'invalid_api_key', 'ai_auth_failed'], [429, 'insufficient_quota', 'ai_quota_exceeded'], [429, 'rate_limit_exceeded', 'ai_rate_limited'], [400, 'model_not_found', 'ai_provider_error']] as const) {
  Deno.test(`provider diagnostic ${status}/${providerCode}`, async () => {
    const events: Record<string, string | number | boolean>[] = [];
    const classify = createClassifier({ apiKey: 'test-secret', monitor: event => events.push(event), fetcher: () => Promise.resolve(new Response(JSON.stringify({ error: { code: providerCode } }), { status })) });
    const correlationId = '11111111-2222-4333-8444-555555555555';
    try { await classify('local help', catalog, correlationId); throw new Error('Expected failure'); } catch (error) { if (!(error instanceof Error) || error.message !== expected) throw error; }
    if (!events.some(event => event.provider_code === providerCode && event.correlation_id === correlationId)) throw new Error('Missing provider diagnostics');
    if (JSON.stringify(events).includes('test-secret')) throw new Error('Secret leaked');
  });
}
for (const [name, apiKey, fetcher, expected] of [
  ['missing key', '', () => Promise.reject(new Error('Must not fetch')), 'ai_not_configured'],
  ['timeout', 'test', () => Promise.reject(new DOMException('Timed out', 'TimeoutError')), 'ai_timeout'],
  ['invalid JSON', 'test', () => Promise.resolve(new Response('invalid JSON')), 'ai_invalid_response'],
] as const) {
  Deno.test(name, async () => {
    const classify = createClassifier({ apiKey, fetcher, monitor: () => {} });
    try { await classify('help', catalog); throw new Error('Expected failure'); } catch (error) { if (!(error instanceof Error) || error.message !== expected) throw error; }
  });
}
