import { createAuthorizer } from './database.ts';
import { createSearchHandler } from './handler.ts';
import { createCategoryClassifier, createClassifier } from './openai.ts';

const monitor = (event: Record<string, string | number | boolean>) => console.info(JSON.stringify(event));

Deno.serve(createSearchHandler({
  // The shared utility includes the production/development defaults and accepts
  // exact additional origins from trusted server-side configuration.
  authorize: createAuthorizer({
    url: Deno.env.get('SUPABASE_URL') ?? '',
    anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    publicKey: Deno.env.get('AI_SEARCH_PUBLIC_KEY') ?? '',
  }),
  cacheVersion: Deno.env.get('AI_SEARCH_CONFIG_VERSION') ?? 'v1',
  classify: createClassifier({ apiKey: Deno.env.get('OPENAI_API_KEY') ?? '', model: Deno.env.get('OPENAI_MODEL') ?? Deno.env.get('AI_SEARCH_MODEL'), monitor }),
  classifyCategory: createCategoryClassifier({ apiKey: Deno.env.get('OPENAI_API_KEY') ?? '', model: Deno.env.get('OPENAI_MODEL') ?? Deno.env.get('AI_SEARCH_MODEL'), monitor }),
  monitor,
}));
