import { directIntent } from './contracts.ts';

const categories = [
  { id: 'electrician', slug: 'electrician', parent_id: 'home', name_en: 'Electrician', name_ta: 'மின்சாரப் பணிகள்' },
  { id: 'electrician-labour', slug: 'electrician-labour', parent_id: 'labour', name_en: 'Electrician Labour', name_ta: 'எலக்ட்ரீஷியன்' },
  ...['plumber', 'ac-refrigeration'].map(slug => ({ id: slug, slug, parent_id: null, name_en: slug, name_ta: '' })),
];
for (const [query, expected] of [
  ['எலக்ட்ரீஷியன் வேண்டும்', 'electrician'],
  ['மின்சார வேலை செய்பவர் வேண்டும்', 'electrician'],
  ['Need an electrician', 'electrician'],
  ['Electrician near me', 'electrician'],
  ['Electrician venum', 'electrician'],
  ['Current work aal venum', 'electrician'],
  ['பிளம்பர் வேண்டும்', 'plumber'],
  ['Plumber thevai', 'plumber'],
  ['ஏசி சர்வீஸ் வேண்டும்', 'ac-refrigeration'],
  ['AC repair', 'ac-refrigeration'],
  ['AC service venum', 'ac-refrigeration'],
] as const) {
  Deno.test(`deterministic category: ${query}`, () => {
    const result = directIntent(query, { categories, locations: [] }, null);
    if (result?.category_slug !== expected || result.keywords !== '' || result.location_slug !== null) throw new Error('Incorrect deterministic intent');
  });
}
Deno.test('Tamil electrician alias resolves the Electrician category despite the Electrician Labour Tamil label collision', () => {
  const result = directIntent('எலக்ட்ரீஷியன் வேண்டும்', { categories, locations: [] }, null);
  if (result?.category_slug !== 'electrician') throw new Error('Expected the canonical electrician category');
});
Deno.test('longer English electrician labour query resolves to the labor category', () => {
  const result = directIntent('electrician labour', { categories, locations: [] }, null);
  if (result?.category_slug !== 'electrician-labour') throw new Error('Expected the more specific electrician labour category');
});
