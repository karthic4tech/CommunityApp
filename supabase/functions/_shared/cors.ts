const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'https://cdm360.in',
  'https://www.cdm360.in',
] as const;

const ALLOWED_REQUEST_HEADERS = 'authorization, apikey, x-client-info, content-type';
const DEFAULT_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

function configuredOrigins(): readonly string[] {
  const read = (name: string): string => {
    try { return Deno.env.get(name) ?? ''; } catch { return ''; }
  };
  const configured = [
    read('CORS_ALLOWED_ORIGINS'),
    read('AI_SEARCH_ALLOWED_ORIGINS'),
  ];
  return configured.flatMap(value => value.split(',').map(origin => origin.trim()).filter(Boolean));
}

export function allowedOrigins(additionalOrigins: readonly string[] = []): ReadonlySet<string> {
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins(), ...additionalOrigins].filter(Boolean));
}

export function isAllowedOrigin(origin: string | null, additionalOrigins: readonly string[] = []): boolean {
  return origin === null || allowedOrigins(additionalOrigins).has(origin);
}

export function getCorsHeaders(
  request: Request,
  options: { methods?: string; additionalOrigins?: readonly string[] } = {},
): Headers {
  const headers = new Headers({
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': options.methods ?? DEFAULT_METHODS,
    'Access-Control-Allow-Headers': ALLOWED_REQUEST_HEADERS,
    'Access-Control-Max-Age': '600',
  });
  const origin = request.headers.get('origin');
  if (origin && isAllowedOrigin(origin, options.additionalOrigins)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  return headers;
}

export function handlePreflight(
  request: Request,
  options: { methods?: string; additionalOrigins?: readonly string[] } = {},
): Response {
  const origin = request.headers.get('origin');
  if (!origin || !isAllowedOrigin(origin, options.additionalOrigins)) {
    return new Response(null, { status: 403, headers: new Headers({ 'Vary': 'Origin' }) });
  }
  return new Response(null, { status: 204, headers: getCorsHeaders(request, options) });
}
