import { getCorsHeaders, handlePreflight, isAllowedOrigin } from './cors.ts';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

const allowed = ['http://localhost:4200', 'http://127.0.0.1:4200', 'https://cdm360.in', 'https://www.cdm360.in'];
for (const origin of allowed) {
  Deno.test(`allows exact origin ${origin}`, async () => {
    const request = new Request('https://example.test/function', { method: 'OPTIONS', headers: { origin } });
    const response = handlePreflight(request);
    assert(response.status === 204, `Expected 204 for ${origin}`);
    assert(response.headers.get('Access-Control-Allow-Origin') === origin, 'Origin was not echoed exactly');
    assert(response.headers.get('Vary') === 'Origin', 'Vary header missing');
    assert(response.headers.get('Access-Control-Allow-Headers')?.includes('authorization'), 'Authorization not allowed');
  });
}

for (const origin of ['https://evil.example', 'https://cdm360.in.evil.example', 'http://cdm360.in', 'http://localhost:4300']) {
  Deno.test(`blocks unapproved origin ${origin}`, () => {
    const request = new Request('https://example.test/function', { method: 'OPTIONS', headers: { origin } });
    const response = handlePreflight(request);
    assert(response.status === 403, `Expected 403 for ${origin}`);
    assert(!response.headers.get('Access-Control-Allow-Origin'), 'Blocked origin received CORS access');
    assert(isAllowedOrigin(origin) === false, 'Blocked origin was considered allowed');
  });
}

Deno.test('keeps server-to-server requests usable without an Origin header', () => {
  const headers = getCorsHeaders(new Request('https://example.test/function'));
  assert(!headers.get('Access-Control-Allow-Origin'), 'Origin was invented');
  assert(headers.get('Vary') === 'Origin', 'Vary header missing');
});
