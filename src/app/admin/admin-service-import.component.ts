import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../core/services/supabase.service';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;
const FIELDS = [
  { key: 'provider_name', label: 'Provider / business name', aliases: ['provider name', 'business name', 'provider', 'business', 'வழங்குநர் பெயர்', 'கடை பெயர்'] },
  { key: 'service_name', label: 'Service name', aliases: ['service name', 'listing title', 'title', 'சேவை பெயர்', 'சேவை'] },
  { key: 'category', label: 'Category', aliases: ['category', 'parent category', 'வகை', 'முதன்மை வகை', 'பிரிவு'] },
  { key: 'service_type', label: 'Service type / subcategory', aliases: ['service type', 'subcategory', 'sub category', 'துணை வகை', 'சேவை வகை'] },
  { key: 'location', label: 'Location / locality', aliases: ['location', 'locality', 'town', 'ஊர்', 'இடம்'] },
  { key: 'phone', label: 'Phone (optional)', aliases: ['phone', 'mobile', 'mobile number', 'telephone', 'தொலைபேசி', 'கைபேசி'] },
  { key: 'whatsapp', label: 'WhatsApp (optional)', aliases: ['whatsapp', 'whats app', 'வாட்ஸ்அப்'] },
  { key: 'email', label: 'Email (optional)', aliases: ['email', 'email address', 'மின்னஞ்சல்'] },
  { key: 'website', label: 'Website (optional)', aliases: ['website', 'web site', 'இணையதளம்'] },
  { key: 'description', label: 'Description (optional)', aliases: ['description', 'details', 'விளக்கம்'] },
  { key: 'address', label: 'Address (optional)', aliases: ['address', 'முகவரி'] },
  { key: 'postal_code', label: 'Postal code (optional)', aliases: ['postal code', 'postcode', 'pin code', 'pincode', 'அஞ்சல் குறியீடு'] },
  { key: 'provider_type', label: 'Provider type (optional)', aliases: ['provider type', 'business type'] },
] as const;
type FieldKey = typeof FIELDS[number]['key'];
type ImportRow = Partial<Record<FieldKey, string>>;
interface CheckedRow { index: number; row: ImportRow; state: 'valid' | 'warning' | 'error'; message: string; categoryId?: string; locationId?: string; phone?: string; whatsapp?: string; email?: string; website?: string; }
type WizardStep = 'upload' | 'mapping' | 'preview' | 'result';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new Error('The CSV has an unclosed quoted field. Check the file and try again.');
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}
function csvCell(value: unknown): string { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
function normalized(value: string): string { return value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); }

@Component({
  selector: 'app-admin-service-import',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="import-page container-xl" aria-labelledby="import-title" [attr.aria-busy]="working()">
      <a class="back-link" routerLink="/admin/listings/review"><i class="bi bi-arrow-left" aria-hidden="true"></i> Listing review</a>
      <header class="page-header"><p class="eyebrow">ADMINISTRATOR TOOL</p><h1 id="import-title">Import services</h1><p>Import existing service records from CSV or Excel. All records enter the review queue and are not published automatically.</p></header>
      <nav class="steps" aria-label="Import steps">@for (item of stepItems; track item.id; let i = $index) { <div [class.active]="step() === item.id" [class.complete]="stepIndex() > i"><span>{{ stepIndex() > i ? '✓' : i + 1 }}</span><small>{{ item.label }}</small></div> }</nav>
      @if (error(); as message) { <p class="alert alert-danger" role="alert">{{ message }}</p> }

      @if (step() === 'upload') {
        <section class="panel" aria-labelledby="upload-title"><h2 id="upload-title">1. Upload a file</h2><p>CSV or XLSX · maximum 5 MB · up to 2,000 data rows. Keep phone numbers and postal codes formatted as text in Excel so leading zeros are retained.</p>
          <div class="template-actions"><button type="button" class="btn btn-outline-primary" (click)="downloadCsvTemplate()"><i class="bi bi-filetype-csv" aria-hidden="true"></i> Download CSV template</button><button type="button" class="btn btn-outline-primary" (click)="downloadExcelTemplate()"><i class="bi bi-file-earmark-spreadsheet" aria-hidden="true"></i> Download Excel template</button></div>
          <label class="drop-zone" for="import-file"><i class="bi bi-cloud-arrow-up" aria-hidden="true"></i><strong>{{ fileName() || 'Choose a CSV or XLSX file' }}</strong><span>Select a file from your device</span><input id="import-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" (click)="clearFileSelection($event)" (change)="readFile($event)" [disabled]="working()"></label>
          @if (working()) { <p role="status">Reading and checking the file…</p> }
        </section>
      }

      @if (step() === 'mapping') {
        <section class="panel" aria-labelledby="mapping-title"><h2 id="mapping-title">2. Map your columns</h2><p>We matched common English and Tamil headings automatically. Review required fields before continuing.</p>
          <div class="mapping-grid">@for (field of fields; track field.key) { <label>{{ field.label }}@if (requiredFields.includes(field.key)) { <span aria-hidden="true">*</span> }<select [value]="mapping()[field.key] ?? -1" (change)="setMapping(field.key, $event)"><option value="-1">Not mapped</option>@for (header of headers(); track $index) { <option [value]="$index">{{ header || ('Column ' + ($index + 1)) }}</option> }</select></label> }</div>
          <p class="help">Required: provider name, service name, category, service type and location. Category and service type must match existing active records. New categories are never created.</p>
          <div class="actions"><button type="button" class="btn btn-outline-secondary" (click)="resetFile()">Choose another file</button><button type="button" class="btn btn-primary" [disabled]="!canValidate() || working()" (click)="validateRows()">Validate and preview</button></div>
        </section>
      }

      @if (step() === 'preview') {
        <section class="panel" aria-labelledby="preview-title"><div class="panel-heading"><div><h2 id="preview-title">3. Validate and preview</h2><p>Review every warning and error. Only valid and warning rows will be submitted for approval.</p></div><button type="button" class="btn btn-outline-secondary" (click)="downloadErrorReport()">Download error report</button></div>
          <div class="summary-cards"><article><strong>{{ rowCounts().valid }}</strong><span>Valid</span></article><article><strong>{{ rowCounts().warning }}</strong><span>Warnings</span></article><article><strong>{{ rowCounts().error }}</strong><span>Errors / duplicates</span></article><article><strong>{{ checkedRows().length }}</strong><span>Total rows</span></article></div>
          <div class="table-wrap"><table class="table table-sm align-middle"><thead><tr><th scope="col">Row</th><th scope="col">Provider / service</th><th scope="col">Category / type</th><th scope="col">Location</th><th scope="col">Status</th><th scope="col">Details</th></tr></thead><tbody>@for (item of checkedRows().slice(0, 200); track item.index) { <tr><td>{{ item.index + 2 }}</td><td>{{ item.row.provider_name }}<small>{{ item.row.service_name }}</small></td><td>{{ item.row.category }}<small>{{ item.row.service_type }}</small></td><td>{{ item.row.location }}</td><td><span class="badge" [class.text-bg-success]="item.state === 'valid'" [class.text-bg-warning]="item.state === 'warning'" [class.text-bg-danger]="item.state === 'error'">{{ item.state }}</span></td><td>{{ item.message || 'Ready to import' }}</td></tr> }</tbody></table></div>
          @if (checkedRows().length > 200) { <p class="help">Showing the first 200 rows. The full error report is downloadable.</p> }
          <div class="actions"><button type="button" class="btn btn-outline-secondary" (click)="step.set('mapping')">Back to mappings</button><button type="button" class="btn btn-primary" [disabled]="!rowCounts().valid && !rowCounts().warning || working()" (click)="confirmImport()">{{ working() ? 'Importing securely…' : 'Import ' + (rowCounts().valid + rowCounts().warning) + ' valid rows' }}</button></div>
        </section>
      }

      @if (step() === 'result') {
        <section class="panel result" aria-labelledby="result-title" role="status"><i class="bi" [class.bi-check-circle-fill]="resultSummary().failed === 0" [class.bi-exclamation-triangle-fill]="resultSummary().failed > 0" aria-hidden="true"></i><h2 id="result-title">{{ resultSummary().failed ? 'Import completed with some errors' : 'Import complete' }}</h2><p>New listings were submitted as pending review. They will not appear publicly until approved.</p><div class="summary-cards"><article><strong>{{ resultSummary().inserted }}</strong><span>Imported</span></article><article><strong>{{ resultSummary().skipped }}</strong><span>Skipped</span></article><article><strong>{{ resultSummary().failed }}</strong><span>Failed</span></article></div><p>Import job: <code>{{ resultSummary().jobId }}</code></p>@if (importErrors().length) { <div class="import-errors" aria-label="Import row errors"><h3>Rows needing attention</h3>@for (item of importErrors().slice(0, 20); track item.row) { <p><strong>Row {{ item.row }} · {{ item.status }}:</strong> {{ item.message }}</p> }@if (importErrors().length > 20) { <p>More row details are available in the downloaded report.</p> }<button type="button" class="btn btn-outline-secondary" (click)="downloadErrorReport()">Download row report</button></div> }<div class="actions"><a class="btn btn-outline-primary" routerLink="/admin/listings/review">Open review queue</a>@if (resultSummary().failed) { <button type="button" class="btn btn-outline-primary" [disabled]="working()" (click)="confirmImport()">{{ working() ? 'Retrying…' : 'Retry failed rows' }}</button> }<button type="button" class="btn btn-primary" (click)="resetFile()">Import another file</button></div></section>
      }
    </main>
  `,
  styles: `
    :host{display:block;padding-block:1.5rem 3rem;color:var(--cdm-navy)}.import-page{max-width:var(--cdm-content-width)}.back-link{display:inline-flex;align-items:center;gap:.4rem;min-height:44px;color:var(--cdm-royal-blue);font-weight:700;text-decoration:none}.page-header{margin:.5rem 0 1rem;padding:clamp(1.25rem,3vw,2rem);border:1px solid var(--cdm-border);border-radius:16px;background:linear-gradient(120deg,var(--cdm-blue-soft),#fff)}.eyebrow{margin:0 0 .3rem;color:var(--cdm-royal-blue);font-size:.72rem;font-weight:800;letter-spacing:.12em}.page-header h1{margin:0;color:var(--cdm-navy);font-size:clamp(1.7rem,4vw,2.4rem)}.page-header p:last-child,.panel>p,.panel-heading p,.help{color:var(--cdm-muted);line-height:1.6}.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:.55rem;margin:1.1rem 0}.steps>div{display:flex;align-items:center;gap:.5rem;padding:.65rem;border:1px solid var(--cdm-border);border-radius:10px;background:#fff;color:var(--cdm-muted)}.steps span{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:50%;background:var(--cdm-page);font-weight:800}.steps .active{border-color:var(--cdm-royal-blue);color:var(--cdm-royal-blue)}.steps .complete span,.steps .active span{color:#fff;background:var(--cdm-royal-blue)}.steps small{font-weight:700}.panel{padding:clamp(1rem,2.5vw,1.5rem);border:1px solid var(--cdm-border);border-radius:16px;background:#fff}.panel h2{margin:0;color:var(--cdm-navy);font-size:1.25rem}.drop-zone{display:grid;justify-items:center;gap:.35rem;margin:1rem 0;padding:2rem 1rem;border:2px dashed var(--cdm-border);border-radius:14px;background:var(--cdm-page);cursor:pointer;text-align:center}.drop-zone:focus-within,.drop-zone:hover{border-color:var(--cdm-royal-blue)}.drop-zone>i{color:var(--cdm-royal-blue);font-size:2rem}.drop-zone span{color:var(--cdm-muted);font-size:.85rem}.drop-zone input{max-width:100%;margin-top:.6rem}.template-actions,.actions{display:flex;flex-wrap:wrap;gap:.55rem}.actions{justify-content:space-between;margin-top:1.25rem}.template-actions{margin:1rem 0}.mapping-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem 1rem;margin-top:1rem}.mapping-grid label{display:grid;gap:.35rem;color:var(--cdm-navy);font-size:.82rem;font-weight:700}.mapping-grid label>span{color:#b42318}.mapping-grid select{min-width:0;min-height:42px;padding:.5rem;border:1px solid var(--cdm-border);border-radius:8px;background:white;color:var(--cdm-navy);font:inherit}.help{font-size:.82rem}.panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.summary-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.65rem;margin:1rem 0}.summary-cards article{display:grid;gap:.2rem;padding:.8rem;border:1px solid var(--cdm-border);border-radius:10px;background:var(--cdm-page)}.summary-cards strong{color:var(--cdm-navy);font-size:1.4rem}.summary-cards span{color:var(--cdm-muted);font-size:.78rem}.table-wrap{max-height:55vh;overflow:auto;border:1px solid var(--cdm-border);border-radius:10px}.table{margin:0}.table small{display:block;color:var(--cdm-muted)}.result{text-align:center}.result>i{color:var(--cdm-teal);font-size:2rem}.result .actions{justify-content:center}.result code{overflow-wrap:anywhere}.import-errors{max-width:720px;margin:1rem auto;padding:1rem;border:1px solid var(--cdm-border);border-radius:10px;text-align:left}.import-errors h3{font-size:1rem}.import-errors p{margin:.35rem 0;color:var(--cdm-muted);font-size:.82rem}.alert{margin-block:1rem}:is(a,button,input,select):focus-visible{outline:3px solid color-mix(in srgb,var(--cdm-royal-blue) 55%,transparent);outline-offset:2px}@media(max-width:640px){.steps{grid-template-columns:repeat(2,minmax(0,1fr))}.steps>div{padding:.45rem}.mapping-grid,.summary-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.panel-heading{flex-direction:column}.actions>*{flex:1}.drop-zone{padding:1.4rem .7rem}.table-wrap{max-height:60vh}}
  `,
})
export class AdminServiceImportComponent {
  private readonly supabase = inject(SupabaseService);
  protected readonly fields = FIELDS;
  protected readonly requiredFields: readonly FieldKey[] = ['provider_name', 'service_name', 'category', 'service_type', 'location'];
  protected readonly stepItems: readonly { id: WizardStep; label: string }[] = [
    { id: 'upload', label: 'Upload' }, { id: 'mapping', label: 'Map columns' }, { id: 'preview', label: 'Review' }, { id: 'result', label: 'Results' },
  ];
  protected readonly step = signal<WizardStep>('upload');
  protected readonly working = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly fileName = signal('');
  protected readonly headers = signal<string[]>([]);
  protected readonly rawRows = signal<string[][]>([]);
  protected readonly mapping = signal<Partial<Record<FieldKey, number>>>({});
  protected readonly checkedRows = signal<CheckedRow[]>([]);
  protected readonly idempotencyKey = signal<string | null>(null);
  protected readonly resultSummary = signal({ jobId: '', inserted: 0, skipped: 0, failed: 0 });
  protected readonly importErrors = signal<{ row: number; status: string; message: string }[]>([]);
  protected readonly stepIndex = computed(() => this.stepItems.findIndex(item => item.id === this.step()));
  protected readonly rowCounts = computed(() => this.checkedRows().reduce((counts, item) => ({ ...counts, [item.state]: counts[item.state] + 1 }), { valid: 0, warning: 0, error: 0 }));

  protected async readFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.error.set(null);
    if (file.size > MAX_FILE_BYTES) { this.error.set('File exceeds the 5 MB size limit.'); return; }
    this.working.set(true);
    try {
      let data: string[][];
      if (file.name.toLocaleLowerCase().endsWith('.csv')) {
        data = parseCsv(await file.text());
      } else if (file.name.toLocaleLowerCase().endsWith('.xlsx')) {
        const { default: readXlsxFile } = await import('read-excel-file/browser');
        const workbook = await readXlsxFile(file, { parseNumber: value => value });
        const matrix = workbook[0]?.data ?? [];
        data = matrix.map(row => row.map(value => value === null || value === undefined ? '' : String(value)));
      } else throw new Error('Choose a .csv or .xlsx file. Legacy .xls files are not supported.');
      if (data.length < 2) throw new Error('The file must contain a header row and at least one data row.');
      if (data.length - 1 > MAX_ROWS) throw new Error(`The file exceeds the ${MAX_ROWS.toLocaleString()} data row limit.`);
      if (data[0].length > 50) throw new Error('The file contains more than 50 columns.');
      const headerRow = data[0].map(value => value.replace(/^\uFEFF/, '').trim());
      const mapping: Partial<Record<FieldKey, number>> = {};
      for (const field of FIELDS) {
        const aliases = [field.key.replaceAll('_', ' '), field.label, ...field.aliases].map(normalized);
        const columnIndex = headerRow.findIndex(header => aliases.includes(normalized(header)));
        if (columnIndex >= 0 && !Object.values(mapping).includes(columnIndex)) mapping[field.key] = columnIndex;
      }
      this.fileName.set(file.name);
      this.headers.set(headerRow);
      this.rawRows.set(data.slice(1));
      this.mapping.set(mapping);
      this.step.set('mapping');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to read this file. Check that it is a valid CSV or XLSX file.');
    } finally { this.working.set(false); }
  }

  protected setMapping(key: FieldKey, event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.mapping.update(current => ({ ...current, [key]: value < 0 ? undefined : value }));
  }
  protected clearFileSelection(event: Event): void { (event.target as HTMLInputElement).value = ''; }
  protected canValidate(): boolean { return this.requiredFields.every(key => this.mapping()[key] !== undefined); }

  protected async validateRows(): Promise<void> {
    this.working.set(true); this.error.set(null);
    try {
      const rows = this.toRows();
      const { data, error } = await this.supabase.client.functions.invoke<{ rows: CheckedRow[]; error?: string }>('service-bulk-import', { body: { action: 'validate', rows } });
      if (error || !data) throw new Error(data?.error ?? error?.message ?? 'Validation failed.');
      if (data.error) throw new Error(data.error);
      this.checkedRows.set(data.rows);
      this.idempotencyKey.set(globalThis.crypto.randomUUID());
      this.step.set('preview');
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to validate these rows.'); }
    finally { this.working.set(false); }
  }

  protected async confirmImport(): Promise<void> {
    const retry = this.step() === 'result';
    const prompt = retry ? `Retry failed rows from import ${this.resultSummary().jobId}? Successfully imported rows will not be duplicated.` : `Import ${this.rowCounts().valid + this.rowCounts().warning} valid rows for administrator review?`;
    if (!globalThis.confirm(prompt)) return;
    this.working.set(true); this.error.set(null);
    try {
      const idempotencyKey = this.idempotencyKey() ?? globalThis.crypto.randomUUID();
      this.idempotencyKey.set(idempotencyKey);
      const { data, error } = await this.supabase.client.functions.invoke<{ jobId: string; inserted: number; skipped: number; failed: number; error?: string; results?: Record<string, { status: string; message?: string }> }>('service-bulk-import', { body: { action: 'import', rows: this.toRows(), idempotencyKey } });
      if (error || !data) throw new Error(data?.error ?? error?.message ?? 'Import failed.');
      if (data.error) throw new Error(data.error);
      this.resultSummary.set({ jobId: data.jobId, inserted: data.inserted, skipped: data.skipped, failed: data.failed });
      this.importErrors.set(Object.entries(data.results ?? {}).flatMap(([index, result]) => result.message ? [{ row: Number(index) + 2, status: result.status, message: result.message }] : []));
      this.step.set('result');
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Import failed.'); }
    finally { this.working.set(false); }
  }

  protected downloadErrorReport(): void {
    const problems = this.importErrors().length ? this.importErrors() : this.checkedRows().filter(item => item.state === 'error').map(item => ({ row: item.index + 2, status: item.state, message: item.message }));
    const rows = [['Row', 'Status', 'Issue', ...FIELDS.map(field => field.label)], ...problems.map(problem => [String(problem.row), problem.status, problem.message, ...FIELDS.map(field => this.toRows()[problem.row - 2]?.[field.key] ?? '')])];
    this.download('service-import-errors.csv', `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`, 'text/csv;charset=utf-8');
  }
  protected downloadCsvTemplate(): void {
    this.download('service-import-template.csv', `\uFEFF${FIELDS.map(field => field.key).join(',')}\r\n${FIELDS.map(field => field.key === 'provider_name' ? 'Example provider' : field.key === 'service_name' ? 'Example service' : field.key === 'category' ? 'Home Services' : field.key === 'service_type' ? 'Electrician' : field.key === 'location' ? 'Chidambaram' : '').map(csvCell).join(',')}`, 'text/csv;charset=utf-8');
  }
  protected async downloadExcelTemplate(): Promise<void> {
    const { zipSync, strToU8 } = await import('fflate');
    const xmlEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const matrix = [FIELDS.map(field => field.key), FIELDS.map(field => field.key === 'provider_name' ? 'Example provider' : field.key === 'service_name' ? 'Example service' : field.key === 'category' ? 'Home Services' : field.key === 'service_type' ? 'Electrician' : field.key === 'location' ? 'Chidambaram' : '')];
    const sheet = matrix.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`).join('')}</row>`).join('');
    const files = {
      '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
      '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
      'xl/workbook.xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Services" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
      'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet}</sheetData></worksheet>`),
    };
    const blob = new Blob([zipSync(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    this.downloadBlob('service-import-template.xlsx', blob);
  }
  protected resetFile(): void { this.step.set('upload'); this.fileName.set(''); this.headers.set([]); this.rawRows.set([]); this.checkedRows.set([]); this.mapping.set({}); this.idempotencyKey.set(null); this.importErrors.set([]); this.error.set(null); }

  private toRows(): ImportRow[] {
    const map = this.mapping();
    return this.rawRows().map(values => Object.fromEntries(FIELDS.flatMap(field => {
      const index = map[field.key];
      return index === undefined || !values[index]?.trim() ? [] : [[field.key, values[index].trim()]];
    })) as ImportRow);
  }
  private download(name: string, content: string, type: string): void { this.downloadBlob(name, new Blob([content], { type })); }
  private downloadBlob(name: string, blob: Blob): void {
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
  }
}
