import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders, handlePreflight } from '../_shared/cors.ts';

const MAX_ROWS = 2000;
const MAX_BATCH_SIZE = 100;
const norm = (value: unknown): string => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ta-IN')
  .replace(/[ஃ]/g, 'க்').replace(/[்]/g, '').replace(/[^\p{L}\p{N}]/gu, '');
const aliases: Readonly<Record<string, readonly string[]>> = {
  'home-services': ['veetu sevai', 'வீட்டு சேவைகள்'],
  'marriage-services': ['thirumana sevai', 'kalyana services', 'திருமண சேவைகள்'],
  'house-construction-services': ['building services', 'construction', 'கட்டுமான சேவைகள்'],
  'medical-emergency-services': ['medical services', 'health services', 'மருத்துவ சேவைகள்'],
  'ac-refrigeration': ['ac service', 'ac repair', 'air conditioner repair', 'ஏசி பழுது நீக்கம்'],
  'ro-water-purifier': ['ro service', 'ro repair', 'water purifier service', 'தண்ணீர் சுத்திகரிப்பு'],
  'building-contractors': ['building contractor', 'construction contractor', 'கட்டிட ஒப்பந்ததாரர்'],
  'funeral-death-related-services': ['funeral', 'funeral services', 'death services', 'death related services', 'hearse', 'dead body transport', 'உடல் வாகனம்'],
  'hearse-transport': ['hearse', 'dead body transport', 'funeral transport', 'சடல ஊர்தி'],
  'ambulance-services': ['ambulance', 'ஆம்புலன்ஸ்'],
  'chidambaram': ['chidhambaram', 'chidambaram town', 'சிதம்பரம்'],
};
const matches = (input: string, values: readonly (string | null | undefined)[], slug?: string): boolean => {
  const key = norm(input);
  if (!key) return false;
  return values.some(value => norm(value) === key) || Boolean(slug && ([slug, ...(aliases[slug] ?? [])].some(value => norm(value) === key)));
};

interface ImportRow {
  provider_name?: string; service_name?: string; category?: string; service_type?: string;
  location?: string; phone?: string; whatsapp?: string; email?: string; website?: string;
  description?: string; address?: string; postal_code?: string; provider_type?: string;
}
interface CheckedRow { index: number; row: ImportRow; state: 'valid' | 'warning' | 'error'; message: string; categoryId?: string; locationId?: string; phone?: string; whatsapp?: string; email?: string; website?: string; }

const response = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...Object.fromEntries(getCorsHeaders(request)), 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return handlePreflight(request, { methods: 'POST, OPTIONS' });
  if (request.method !== 'POST') return response(request, { error: 'Method not allowed.' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) throw new Error('Import service is not configured.');
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return response(request, { error: 'Sign in with an administrator account.' }, 401);
    const token = authorization.slice(7);
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: authData, error: authError } = await caller.auth.getUser(token);
    if (authError || !authData.user) return response(request, { error: 'Your session is invalid or expired.' }, 401);
    const { data: isAdmin, error: roleError } = await caller.rpc('is_admin');
    if (roleError || isAdmin !== true) return response(request, { error: 'Administrator access is required.' }, 403);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const configuredBatchSize = Number(Deno.env.get('SERVICE_IMPORT_BATCH_SIZE')) || MAX_BATCH_SIZE;
    const batchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(configuredBatchSize)));
    const body = await request.json() as { action?: string; rows?: ImportRow[]; idempotencyKey?: string };
    if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > MAX_ROWS) {
      return response(request, { error: `Provide between 1 and ${MAX_ROWS} rows.` }, 400);
    }
    if (body.rows.some(row => !row || typeof row !== 'object' || Object.values(row).some(value => typeof value !== 'string' || value.length > 5000))) {
      return response(request, { error: 'Each row must contain text values no longer than 5,000 characters.' }, 400);
    }
    if (body.action === 'import' && (!body.idempotencyKey || !/^[\w-]{16,128}$/.test(body.idempotencyKey))) {
      return response(request, { error: 'Import idempotency key is invalid.' }, 400);
    }
    let priorJob: { id: string; row_results: Record<string, { status?: string; listingId?: string }>; status: string; uploaded_by: string; updated_at: string; total_rows: number; skipped_rows: number; failed_rows: number } | null = null;
    if (body.action === 'import' && body.idempotencyKey) {
      const { data, error } = await admin.from('service_import_jobs').select('id,row_results,status,uploaded_by,updated_at,total_rows,skipped_rows,failed_rows')
        .eq('idempotency_key', body.idempotencyKey).maybeSingle();
      if (error) throw new Error('Unable to check the import idempotency key.');
      priorJob = data;
      if (priorJob && priorJob.uploaded_by !== authData.user.id) return response(request, { error: 'This import key belongs to another administrator.' }, 409);
      if (priorJob && priorJob.total_rows !== body.rows.length) return response(request, { error: 'This import key is already associated with a different file.' }, 409);
      if (priorJob?.status === 'processing' && Date.now() - Date.parse(priorJob.updated_at) < 120000) return response(request, { error: 'This import is already in progress. Wait before retrying.' }, 409);
      if (priorJob?.status === 'processing') {
        const { error: resumeError } = await admin.from('service_import_jobs').update({ status: 'partial' }).eq('id', priorJob.id);
        if (resumeError) throw new Error('Unable to resume the interrupted import.');
        priorJob.status = 'partial';
      }
      if (priorJob?.status === 'completed') return response(request, { jobId: priorJob.id, inserted: Object.values(priorJob.row_results).filter(row => row.status === 'inserted').length, skipped: priorJob.skipped_rows, failed: priorJob.failed_rows, rows: [] });
    }

    const [{ data: categories, error: categoryError }, { data: locations, error: locationError }] = await Promise.all([
      admin.from('service_categories').select('id,parent_id,name_en,name_ta,slug,is_active').eq('is_active', true).limit(5000),
      admin.from('locations').select('id,name_en,name_ta,slug').limit(5000),
    ]);
    if (categoryError || locationError) throw new Error('Unable to load active categories or locations.');
    const categoryRows = categories ?? [];
    const parents = categoryRows.filter(item => !item.parent_id);
    const checked: CheckedRow[] = body.rows.map((row, index) => {
      const problems: string[] = [];
      const provider = row.provider_name?.trim() ?? '';
      const service = row.service_name?.trim() ?? '';
      if (!provider) problems.push('Provider name is required.');
      else if (provider.length > 160) problems.push('Provider name must be 160 characters or fewer.');
      if (!service) problems.push('Service name is required.');
      else if (service.length > 200) problems.push('Service name must be 200 characters or fewer.');
      if ((row.description?.length ?? 0) > 5000) problems.push('Description must be 5,000 characters or fewer.');
      const parentMatches = parents.filter(item => matches(row.category ?? '', [item.name_en, item.name_ta], item.slug));
      if (parentMatches.length !== 1) problems.push(parentMatches.length ? 'Category is ambiguous; choose a specific existing category.' : 'Category does not match an active category.');
      let leaf = undefined;
      if (parentMatches.length === 1) {
        const leaves = categoryRows.filter(item => item.parent_id === parentMatches[0].id);
        const leafMatches = leaves.filter(item => matches(row.service_type ?? '', [item.name_en, item.name_ta], item.slug));
        if (leafMatches.length !== 1) problems.push(leafMatches.length ? 'Service type is ambiguous.' : 'Service type does not match an active subcategory.');
        else leaf = leafMatches[0];
      }
      const placeMatches = (locations ?? []).filter(item => matches(row.location ?? '', [item.name_en, item.name_ta], item.slug));
      if (!row.location?.trim()) problems.push('Location is required.');
      else if (placeMatches.length !== 1) problems.push(placeMatches.length ? 'Location is ambiguous.' : 'Location was not found.');
      const phone = row.phone?.trim().replace(/[\s()-]/g, '') ?? '';
      const whatsapp = row.whatsapp?.trim().replace(/[\s()-]/g, '') ?? '';
      if (phone && !/^(?:\+91)?[6-9]\d{9}$/.test(phone)) problems.push('Phone must be a valid Indian mobile number.');
      if (whatsapp && !/^(?:\+91)?[6-9]\d{9}$/.test(whatsapp)) problems.push('WhatsApp must be a valid Indian mobile number.');
      if (row.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) problems.push('Email address is invalid.');
      if (row.postal_code && (row.postal_code.length < 3 || row.postal_code.length > 16)) problems.push('Postal code must be 3 to 16 characters.');
      let website = row.website?.trim() ?? '';
      if (row.website?.trim()) {
        try {
          const candidate = /^[a-z][a-z\d+.-]*:/i.test(website) ? website : `https://${website.replace(/^\/\//, '')}`;
          const parsed = new URL(candidate);
          const labels = parsed.hostname.split('.');
          if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || labels.length < 2 || labels.some(label => !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))) problems.push('Website must be a valid HTTP or HTTPS URL.');
          else website = parsed.href;
        } catch { problems.push('Website must be a valid HTTP or HTTPS URL.'); }
      }
      return { index, row, state: problems.length ? 'error' : (!phone && !whatsapp ? 'warning' : 'valid'), message: problems.join(' '),
        ...(parentMatches.length === 1 && leaf ? { categoryId: leaf.id } : {}), ...(placeMatches.length === 1 ? { locationId: placeMatches[0].id } : {}), phone, whatsapp,
        email: row.email?.trim(), website };
    });

    const seen = new Set<string>();
    for (const item of checked) {
      if (item.state === 'error') continue;
      if (priorJob?.row_results[String(item.index)]?.status === 'inserted') continue;
      const key = [norm(item.row.provider_name), norm(item.row.service_name), norm(item.row.location), item.phone || item.whatsapp || ''].join('|');
      if (seen.has(key)) { item.state = 'error'; item.message = 'Duplicate row in this file.'; }
      else seen.add(key);
    }
    const existing: Array<{ title: string; service_providers: { display_name: string }; listing_contacts: Array<{ contact_type: string; contact_value: string }>; listing_locations: Array<{ locations: { name_en: string | null; name_ta: string | null; slug: string | null } | null }> }> = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from('service_listings')
        .select('title,service_providers!inner(display_name),listing_contacts(contact_type,contact_value),listing_locations(locations(name_en,name_ta,slug))')
        .range(from, from + 999);
      if (error) throw new Error('Unable to check for existing service listings.');
      existing.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    for (const item of checked) {
      if (item.state === 'error') continue;
      if (priorJob?.row_results[String(item.index)]?.status === 'inserted') continue;
      const phone = item.phone || item.whatsapp || '';
      const duplicate = (existing ?? []).some(candidate => norm(candidate.title) === norm(item.row.service_name)
        && norm(candidate.service_providers?.display_name) === norm(item.row.provider_name)
        && (candidate.listing_locations ?? []).some(place => matches(item.row.location ?? '', [place.locations?.name_en, place.locations?.name_ta], place.locations?.slug))
        && (!phone || (candidate.listing_contacts ?? []).some(contact => contact.contact_value.replace(/\D/g, '').endsWith(phone.replace(/\D/g, '').slice(-10)))));
      if (duplicate) { item.state = 'error'; item.message = 'A matching provider and service already exist.'; }
    }
    if (body.action === 'validate') return response(request, { rows: checked });
    if (body.action !== 'import' || !body.idempotencyKey) {
      return response(request, { error: 'Import action or idempotency key is invalid.' }, 400);
    }
    const validRows = checked.filter(item => item.state !== 'error' && priorJob?.row_results[String(item.index)]?.status !== 'inserted');
    if (!validRows.length && !priorJob) return response(request, { error: 'There are no valid rows to import.', rows: checked }, 422);
    let jobId = priorJob?.id;
    if (!priorJob) {
      const { data: job, error: jobError } = await admin.from('service_import_jobs').insert({
        idempotency_key: body.idempotencyKey, uploaded_by: authData.user.id, total_rows: checked.length,
      }).select('id').single();
      if (jobError || !job) throw new Error('Could not create the import audit record. Apply the service bulk import migration.');
      jobId = job.id;
    }

    const results: Record<string, { status: string; listingId?: string; message?: string }> = { ...(priorJob?.row_results ?? {}) };
    let inserted = 0; let failed = 0;
    for (let offset = 0; offset < validRows.length; offset += batchSize) {
      for (const item of validRows.slice(offset, offset + batchSize)) {
        try {
          const row = item.row;
          const contacts = [item.phone ? { contact_type: 'phone', contact_value: item.phone, sort_order: 0 } : null,
            item.whatsapp ? { contact_type: 'whatsapp', contact_value: item.whatsapp, sort_order: 1 } : null,
            item.email ? { contact_type: 'email', contact_value: item.email, sort_order: 2 } : null,
            item.website ? { contact_type: 'website', contact_value: item.website, sort_order: 3 } : null].filter(Boolean);
          const { data: listingId, error: importError } = await admin.rpc('admin_import_service_row', {
            _job_id: jobId, _row_index: item.index,
            _provider: { provider_type: ['individual', 'organisation'].includes(row.provider_type ?? '') ? row.provider_type : 'business', display_name: row.provider_name!.trim(), description: row.description?.trim() ?? '', public_email: item.email ?? '', website_url: item.website ?? '', address: row.address?.trim() ?? '', postal_code: row.postal_code?.trim() ?? '' },
            _listing: { category_id: item.categoryId, title: row.service_name!.trim(), description: row.description?.trim() ?? '' },
            _contacts: contacts, _location_id: item.locationId,
          });
          if (importError || !listingId) throw new Error(importError?.message ?? 'Row import failed.');
          results[String(item.index)] = { status: 'inserted', listingId };
          inserted++;
        } catch (error) {
          results[String(item.index)] = { status: 'failed', message: error instanceof Error ? error.message : 'Row insert failed.' };
          failed++;
        }
      }
      const { error: progressError } = await admin.from('service_import_jobs').update({ row_results: results, failed_rows: failed, status: 'processing' }).eq('id', jobId);
      if (progressError) throw new Error('Import progress could not be saved. Retry with the same idempotency key.');
    }
    const totalInserted = Object.values(results).filter(result => result.status === 'inserted').length;
    const totalFailed = Object.values(results).filter(result => result.status === 'failed').length;
    const skipped = checked.length - checked.filter(item => item.state !== 'error').length;
    for (const item of checked.filter(item => item.state === 'error')) results[String(item.index)] = { status: 'skipped', message: item.message };
    const errors = Object.entries(results).flatMap(([index, result]) => result.status === 'failed' || result.status === 'skipped'
      ? [{ row: Number(index) + 2, status: result.status, message: result.message ?? 'Skipped during validation.' }] : []);
    const { error: finishError } = await admin.from('service_import_jobs').update({ row_results: results, inserted_rows: totalInserted, skipped_rows: skipped, failed_rows: totalFailed, error_summary: errors, status: totalFailed ? 'partial' : 'completed' }).eq('id', jobId);
    if (finishError) throw new Error('Import completed but its audit summary could not be saved. Retry with the same idempotency key.');
    return response(request, { jobId, inserted: totalInserted, skipped, failed: totalFailed, rows: checked, results });
  } catch (error) {
    return response(request, { error: error instanceof Error ? error.message : 'Bulk import failed.' }, 500);
  }
});
