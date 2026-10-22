import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminCategoryService, CategoryMutation } from '../core/services/admin-category.service';
import { ServiceCategoryRow } from '../core/models/service-category';
import { LanguageService } from '../core/services/language.service';

export function suggestCategorySlug(value: string): string {
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

@Component({
  selector: 'app-admin-category-form',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="admin-form-page" aria-labelledby="category-form-title" [attr.aria-busy]="loading() || saving()">
      <a class="back-link" routerLink="/admin/categories">← {{ i18n.language() === 'ta' ? 'வகை நிர்வாகத்திற்குத் திரும்பு' : 'Back to category management' }}</a>
      @if (loading()) {
        <h1 id="category-form-title">{{ i18n.language() === 'ta' ? 'வகை ஏற்றப்படுகிறது…' : 'Loading category…' }}</h1>
        <p class="state" role="status">{{ i18n.language() === 'ta' ? 'தயவுசெய்து காத்திருக்கவும்.' : 'Please wait.' }}</p>
      } @else if (loadError(); as message) {
        <h1 id="category-form-title">{{ i18n.language() === 'ta' ? 'வகைகளை ஏற்ற முடியவில்லை' : 'Unable to load categories' }}</h1>
        <div class="state"><p role="alert">{{ message }}</p><button type="button" (click)="load()">{{ i18n.language() === 'ta' ? 'மீண்டும் முயற்சிக்கவும்' : 'Try again' }}</button></div>
      } @else if (notFound()) {
        <h1 id="category-form-title">{{ i18n.language() === 'ta' ? 'வகை கிடைக்கவில்லை' : 'Category not found' }}</h1>
        <p class="state" role="alert">{{ i18n.language() === 'ta' ? 'இந்த வகை இனி கிடைக்கவில்லை.' : 'This category is no longer available.' }}</p>
      } @else {
        <header>
          <p class="eyebrow">{{ editing() ? (i18n.language() === 'ta' ? 'வகையைத் திருத்து' : 'EDIT CATEGORY') : (i18n.language() === 'ta' ? 'புதிய வகை' : 'NEW CATEGORY') }}</p>
          <h1 id="category-form-title">{{ editing() ? (i18n.language() === 'ta' ? 'வகையைத் திருத்து' : 'Edit category') : (i18n.language() === 'ta' ? 'வகையை உருவாக்கு' : 'Create category') }}</h1>
          <p class="intro">{{ i18n.language() === 'ta' ? 'வகை அல்லது உட்பிரிவின் தகவல்களை நிர்வகிக்கவும்.' : 'Manage the category or subcategory information.' }}</p>
        </header>
        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          <div class="form-grid">
            <label>
              <span>English name <strong aria-hidden="true">*</strong></span>
              <input type="text" formControlName="name_en" maxlength="160" autocomplete="off" />
              @if (form.controls.name_en.touched && form.controls.name_en.hasError('required')) { <small class="field-error">English name is required.</small> }
            </label>
            <label>
              <span lang="ta">தமிழ் பெயர் <strong aria-hidden="true">*</strong></span>
              <input type="text" formControlName="name_ta" maxlength="160" lang="ta" />
              @if (form.controls.name_ta.touched && form.controls.name_ta.hasError('required')) { <small class="field-error">Tamil name is required.</small> }
            </label>
            <label>
              <span>Slug <strong aria-hidden="true">*</strong></span>
              <input type="text" formControlName="slug" maxlength="120" autocomplete="off" spellcheck="false" />
              <small class="help">Lowercase letters, numbers and hyphens only.</small>
              @if (form.controls.slug.touched && form.controls.slug.invalid) { <small class="field-error">Use a unique lowercase slug such as <code>home-services</code>.</small> }
            </label>
            <label>
              <span>Parent category</span>
              <select formControlName="parent_id">
                <option value="">Root category</option>
                @for (parent of parentOptions(); track parent.id) {
                  <option [value]="parent.id">{{ parent.name_en }} — {{ parent.name_ta }}{{ parent.is_active ? '' : ' (inactive)' }}</option>
                }
              </select>
              <small class="help">Leave empty to create a root category.</small>
            </label>
            <label>
              <span>Icon name</span>
              <input type="text" formControlName="icon_name" maxlength="80" placeholder="house" autocomplete="off" />
            </label>
            <label>
              <span>Sort order</span>
              <input type="number" formControlName="sort_order" min="0" max="100000" step="1" />
            </label>
          </div>
          <label>
            <span>Description <small>(the current schema provides one shared description field)</small></span>
            <textarea formControlName="description" rows="4" maxlength="2000"></textarea>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" formControlName="is_active" />
            <span>Active and visible in the public directory</span>
          </label>
          @if (errorMessage(); as message) { <p class="error" role="alert">{{ message }}</p> }
          <div class="actions">
            <a class="secondary-action" routerLink="/admin/categories">Cancel</a>
            <button type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save category' }}</button>
          </div>
        </form>
      }
    </section>
  `,
  styles: `
    :host { display:block; padding-block:1.5rem 2.5rem; }
    .admin-form-page { display:grid; gap:1.25rem; }
    .back-link, .secondary-action { display:inline-flex; align-items:center; min-height:44px; color:#075541; }
    .eyebrow { margin:0 0 .35rem; color:#52665b; font-size:.72rem; font-weight:800; letter-spacing:.12em; }
    h1 { margin:0; color:#173f32; font-size:clamp(1.7rem,4vw,2.5rem); overflow-wrap:anywhere; }
    .intro, .help { color:#52665b; line-height:1.7; }
    .form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1rem; }
    form { display:grid; gap:1rem; padding:clamp(1rem,3vw,1.5rem); border:1px solid #dfe7e2; border-radius:16px; background:white; }
    label { display:grid; gap:.4rem; color:#173f32; font-weight:650; min-width:0; }
    input, select, textarea { width:100%; min-width:0; border:1px solid #b8c9bf; border-radius:9px; padding:.7rem; background:white; color:#173f32; font:inherit; }
    textarea { resize:vertical; line-height:1.6; }
    label small { font-weight:400; }
    .field-error, .error { color:#8a261f; line-height:1.6; }
    .checkbox-label { display:flex; grid-template-columns:none; align-items:center; gap:.6rem; }
    .checkbox-label input { width:1.1rem; height:1.1rem; accent-color:#075541; }
    .actions { display:flex; justify-content:flex-end; align-items:center; flex-wrap:wrap; gap:1rem; margin-top:.5rem; }
    button { min-height:46px; border:1px solid #075541; border-radius:9px; padding:.7rem 1.1rem; background:#075541; color:white; font:inherit; font-weight:700; cursor:pointer; }
    button:disabled { cursor:default; opacity:.6; }
    .state { padding:1.25rem; border:1px solid #dfe7e2; border-radius:14px; background:white; color:#52665b; line-height:1.7; }
    :is(a,button,input,select,textarea):focus-visible { outline:3px solid #17583f; outline-offset:3px; }
    @media (max-width:700px) { .form-grid { grid-template-columns:1fr; } .actions { justify-content:stretch; } .actions > * { flex:1 1 180px; justify-content:center; } }
  `,
})
export class AdminCategoryFormComponent implements OnInit {
  protected readonly i18n = inject(LanguageService);
  private readonly adminCategories = inject(AdminCategoryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly form = inject(NonNullableFormBuilder).group({
    name_en: ['', [Validators.required, Validators.maxLength(160)]],
    name_ta: ['', [Validators.required, Validators.maxLength(160)]],
    slug: ['', [Validators.required, Validators.maxLength(120), Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    description: ['', [Validators.maxLength(2000)]],
    icon_name: ['', [Validators.maxLength(80)]],
    sort_order: [0, [Validators.required, Validators.min(0), Validators.max(100000)]],
    is_active: true,
    parent_id: '',
  });
  protected readonly rows = signal<readonly ServiceCategoryRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly notFound = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  private lastSuggestedSlug = '';
  protected readonly editing = computed(() => Boolean(this.params().get('id')));
  protected readonly parentOptions = computed(() => {
    const currentId = this.params().get('id');
    const descendants = currentId ? this.descendantIds(currentId) : new Set<string>();
    return this.rows().filter(row => row.id !== currentId && !descendants.has(row.id));
  });

  constructor() {
    this.form.controls.name_en.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(name => {
        const currentSlug = this.form.controls.slug.value;
        if (!currentSlug || currentSlug === this.lastSuggestedSlug) {
          this.lastSuggestedSlug = suggestCategorySlug(name);
          this.form.controls.slug.setValue(this.lastSuggestedSlug, { emitEvent: false });
        }
      });
  }

  ngOnInit(): void {
    void this.load();
  }

  protected async save(): Promise<void> {
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please correct the highlighted fields.');
      return;
    }

    const currentId = this.params().get('id');
    const raw = this.form.getRawValue();
    const nameEnglish = raw.name_en.trim();
    const nameTamil = raw.name_ta.trim();
    const slug = raw.slug.trim().toLowerCase();
    if (!nameEnglish || !nameTamil || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Number.isInteger(raw.sort_order)) {
      this.errorMessage.set('Please enter valid category names, slug and sort order.');
      return;
    }
    const parentId = raw.parent_id || null;
    const current = currentId ? this.rows().find(row => row.id === currentId) : undefined;
    if (parentId && !this.rows().some(row => row.id === parentId)) {
      this.errorMessage.set('Select a valid parent category.');
      return;
    }
    if (currentId && parentId && this.descendantIds(currentId).has(parentId)) {
      this.errorMessage.set('A category cannot be moved below one of its descendants.');
      return;
    }
    if (current && current.is_active && !raw.is_active && !this.confirm('Deactivate this category? It and its descendants will disappear from the public directory.')) return;

    const input: CategoryMutation = {
      parent_id: parentId,
      name_ta: nameTamil,
      name_en: nameEnglish,
      slug,
      description: raw.description.trim() || null,
      icon_name: raw.icon_name.trim() || null,
      sort_order: raw.sort_order,
      is_active: raw.is_active,
    };
    this.saving.set(true);
    try {
      if (currentId) await this.adminCategories.update(currentId, input);
      else await this.adminCategories.create(input);
      await this.router.navigateByUrl('/admin/categories');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to save this category.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async load(): Promise<void> {
    this.loadError.set(null);
    this.errorMessage.set(null);
    this.loading.set(true);
    try {
      const rows = await this.adminCategories.list();
      this.rows.set(rows);
      const currentId = this.params().get('id');
      if (currentId) {
        const current = rows.find(row => row.id === currentId);
        if (!current) {
          this.notFound.set(true);
        } else {
          this.form.reset({
            name_en: current.name_en,
            name_ta: current.name_ta,
            slug: current.slug,
            description: current.description ?? '',
            icon_name: current.icon_name ?? '',
            sort_order: current.sort_order,
            is_active: current.is_active,
            parent_id: current.parent_id ?? '',
          });
          this.lastSuggestedSlug = current.slug;
        }
      }
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'Unable to load categories.');
    } finally {
      this.loading.set(false);
    }
  }

  private descendantIds(rootId: string): Set<string> {
    const descendants = new Set<string>();
    const visit = (parentId: string): void => {
      for (const row of this.rows()) {
        if (row.parent_id !== parentId || descendants.has(row.id)) continue;
        descendants.add(row.id);
        visit(row.id);
      }
    };
    visit(rootId);
    return descendants;
  }

  private confirm(message: string): boolean {
    return this.document.defaultView?.confirm(message) ?? false;
  }
}
