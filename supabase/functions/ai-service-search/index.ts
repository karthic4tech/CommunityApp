import { createAuthorizer } from './database.ts';
import { createSearchHandler } from './handler.ts';
import { createClassifier } from './openai.ts';

const monitor = (event: Record<string, string | number | boolean>) => console.info(JSON.stringify(event));

Deno.serve(createSearchHandler({
  allowedOrigins: (Deno.env.get('AI_SEARCH_ALLOWED_ORIGINS') ?? '').split(',').map(value => value.trim()).filter(Boolean),
  authorize: createAuthorizer({
    url: Deno.env.get('SUPABASE_URL') ?? '',
    anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    publicKey: Deno.env.get('AI_SEARCH_PUBLIC_KEY') ?? '',
  }),
  classify: createClassifier({ apiKey: Deno.env.get('OPENAI_API_KEY') ?? '', model: Deno.env.get('AI_SEARCH_MODEL'), monitor }),
  monitor,
}));
