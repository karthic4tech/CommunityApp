import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { EssentialShortcutMutation, EssentialShortcutRow } from '../core/models/essential-service';
import { ServiceCategoryRow } from '../core/models/service-category';
import { AdminCategoryService } from '../core/services/admin-category.service';
import { EssentialServiceService } from '../core/services/essential-service.service';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../shared/components/searchable-select/searchable-select.models';

@Component({
  selector: 'app-admin-essential-services',
  imports: [ReactiveFormsModule, RouterLink, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="essential-admin container-xl cdm-form" aria-labelledby="admin-title" [attr.aria-busy]="loading() || saving()">
      <header class="admin-hero">
        <div><a class="back-link" routerLink="/admin"><i class="bi bi-arrow-left" aria-hidden="true"></i> Admin dashboard</a><p class="eyebrow">DIRECTORY CONFIGURATION</p><h1 id="admin-title">Essential Services Management</h1><p>Choose the categories that belong in the curated directory, set their display order and manage the homepage shortcut strip.</p></div>
        <button type="button" class="refresh" (click)="load()" [disabled]="loading()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Refresh</button>
      </header>
      @if (message()) { <p class="notice" role="status">{{ message() }}</p> }
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (loading()) { <p class="state" role="status">Loading category configuration…</p> }
      @else {
        <section class="config-section" aria-labelledby="category-config-title">
          <div class="section-title"><div><p class="eyebrow">CATALOG CURATION</p><h2 id="category-config-title">Essential category visibility</h2></div><span>{{ activeCategories().length }} active categories</span></div>
          <p class="explanation">All active categories remain in All Services. Only categories marked Essential appear in the curated directory. Homepage preview settings are independent.</p>
          <div class="table-scroll">
            <table class="table align-middle mb-0">
              <caption class="visually-hidden">Essential category settings</caption>
              <thead><tr><th scope="col">Category</th><th scope="col">Essential</th><th scope="col">Priority order</th><th scope="col">Shortcut</th><th scope="col">Emergency</th><th scope="col">Homepage preview</th><th scope="col">Save</th></tr></thead>
              <tbody>
                @for (category of activeCategories(); track category.id) {
                  <tr>
                    <th scope="row"><strong>{{ category.name_en }}</strong><small lang="ta">{{ category.name_ta }}</small><code>{{ category.slug }}</code></th>
                    <td><label class="check-label"><input #essential type="checkbox" [checked]="category.is_essential ?? false" [attr.aria-label]="'Include ' + category.name_en + ' in Essential Services'"><span class="visually-hidden">Essential</span></label></td>
                    <td><label class="visually-hidden" [for]="'essential-order-' + category.id">{{ category.name_en }} priority order</label><input #essentialOrder class="order-input form-control" type="number" min="0" step="1" [id]="'essential-order-' + category.id" [value]="category.essential_order ?? category.sort_order"></td>
                    <td><div class="homepage-setting"><label class="check-label"><input #shortcut type="checkbox" [checked]="category.show_as_shortcut ?? false" [attr.aria-label]="'Show ' + category.name_en + ' as a quick shortcut'"><span class="visually-hidden">Quick shortcut</span></label><label class="visually-hidden" [for]="'shortcut-order-' + category.id">{{ category.name_en }} shortcut order</label><input #shortcutOrder class="order-input form-control" type="number" min="0" step="1" [id]="'shortcut-order-' + category.id" [value]="category.shortcut_order ?? category.sort_order"></div></td>
                    <td><label class="check-label"><input #emergency type="checkbox" [checked]="category.is_emergency ?? false" [attr.aria-label]="'Mark ' + category.name_en + ' as emergency related'"><span class="visually-hidden">Emergency</span></label></td>
                    <td><div class="homepage-setting"><label class="check-label"><input #homepage type="checkbox" [checked]="category.show_on_homepage ?? false" [attr.aria-label]="'Show ' + category.name_en + ' on homepage'"><span class="visually-hidden">Show on homepage</span></label><label class="visually-hidden" [for]="'homepage-order-' + category.id">{{ category.name_en }} homepage order</label><input #homepageOrder class="order-input form-control" type="number" min="0" step="1" [id]="'homepage-order-' + category.id" [value]="category.homepage_order ?? category.sort_order"></div></td>
                    <td><form class="cdm-form" (submit)="saveCategory($event, category, essential.checked, essentialOrder.value, shortcut.checked, shortcutOrder.value, emergency.checked, homepage.checked, homepageOrder.value)"><button type="submit" class="save-button btn btn-success" [disabled]="saving()">Save</button></form></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="config-section shortcut-section" aria-labelledby="shortcut-config-title">
          <div class="section-title"><div><p class="eyebrow">HOMEPAGE QUICK ACCESS</p><h2 id="shortcut-config-title">Service shortcuts</h2></div><span>{{ shortcuts().length }} configured</span></div>
          <form class="shortcut-form cdm-form" [formGroup]="form" (ngSubmit)="saveShortcut()" novalidate>
            <div class="form-grid">
              <app-searchable-select label="Category" controlId="shortcut-category" formControlName="category_id" [options]="rootCategoryOptions()" [required]="true" [emptyValue]="''" [clearable]="true" placeholder="Choose a category" searchPlaceholder="Search category names…" (valueChange)="clearShortcutSubcategory()" />
              <app-searchable-select label="Subcategory" controlId="shortcut-subcategory" formControlName="subcategory_id" [options]="subcategoryOptions()" [disabled]="!form.controls.category_id.value" [emptyValue]="''" [clearable]="true" placeholder="Use the main category" searchPlaceholder="Search subcategories…" />
              <label><span>Shortcut title <strong>*</strong></span><input class="form-control" formControlName="title" maxlength="100" autocomplete="off"></label>
              <label><span lang="ta">Tamil title</span><input class="form-control" formControlName="title_ta" maxlength="100" lang="ta"></label>
              <label><span>Bootstrap icon class</span><input class="form-control" formControlName="icon" maxlength="80" placeholder="bi bi-telephone"></label>
              <label><span>Display order</span><input class="form-control" type="number" min="0" step="1" formControlName="display_order"></label>
            </div>
            <div class="form-options"><label class="check-label"><input type="checkbox" formControlName="is_active"> Active shortcut</label><label class="check-label emergency-option"><input type="checkbox" formControlName="is_emergency"> Emergency related</label></div>
            @if (formError()) { <p class="error" role="alert">{{ formError() }}</p> }
            <div class="form-actions"><button class="save-button btn btn-success" type="submit" [disabled]="saving()">{{ editingId() ? 'Update shortcut' : 'Add shortcut' }}</button>@if (editingId()) { <button class="cancel-button btn btn-outline-secondary" type="button" (click)="resetForm()">Cancel edit</button> }</div>
          </form>
          @if (shortcuts().length) {
            <div class="shortcut-list">
              @for (shortcut of shortcuts(); track shortcut.id) {
                <article class="shortcut-row">
                  <span class="shortcut-symbol"><i class="bi" [class]="shortcut.icon || 'bi bi-grid'" aria-hidden="true"></i></span>
                  <div class="shortcut-info"><strong>{{ shortcut.title }}</strong><small lang="ta">{{ shortcut.title_ta || 'Tamil label not set' }}</small><small>{{ categoryName(shortcut.category_id) }}{{ shortcut.subcategory_id ? ' / ' + categoryName(shortcut.subcategory_id) : '' }} · order {{ shortcut.display_order }}</small></div>
                  <span class="status-pill" [class.inactive]="!shortcut.is_active">{{ shortcut.is_active ? 'Active' : 'Hidden' }}</span>
                  @if (shortcut.is_emergency) { <span class="emergency-pill">Emergency</span> }
                  <div class="row-actions"><button type="button" class="btn btn-sm btn-outline-success" (click)="editShortcut(shortcut)">Edit</button><button type="button" class="btn btn-sm btn-outline-danger" (click)="removeShortcut(shortcut)">Remove</button></div>
                </article>
              }
            </div>
          } @else { <p class="state" role="status">No shortcuts configured yet. Add one above.</p> }
        </section>
        <p class="privacy-note"><i class="bi bi-shield-check" aria-hidden="true"></i> Configuration writes are restricted by Supabase RLS to authorized administrator roles.</p>
      }
    </section>
  `,
  styles: `
    :host { display:block; padding-block:1.25rem 3rem; background:var(--cdm-page); }
    .essential-admin { display:grid; gap:1.1rem; }
    .admin-hero { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding:clamp(1.25rem,3vw,2rem); border:1px solid var(--cdm-border); border-radius:17px; background:linear-gradient(120deg,var(--cdm-blue-soft),var(--cdm-page)); }
    .back-link { display:inline-flex; align-items:center; min-height:40px; margin-bottom:.5rem; color:var(--cdm-royal-blue); text-decoration:none; }.eyebrow { margin:0 0 .35rem; color:var(--cdm-royal-blue); font-size:.7rem; font-weight:800; letter-spacing:.12em; }
    h1 { margin:0; color:var(--cdm-navy); font-size:clamp(1.65rem,3.8vw,2.4rem); letter-spacing:-.03em; }h2 { margin:0; color:var(--cdm-navy); font-size:1.2rem; }.admin-hero p:not(.eyebrow) { max-width:700px; margin:.5rem 0 0; color:var(--cdm-muted); line-height:1.6; }
    .refresh { display:inline-flex; align-items:center; gap:.4rem; min-height:42px; padding:.55rem .8rem; border:1px solid var(--cdm-border); border-radius:9px; color:var(--cdm-royal-blue); background:#fff; font:inherit; font-weight:700; cursor:pointer; }
    .config-section { overflow:hidden; padding:clamp(1rem,2.5vw,1.5rem); border:1px solid var(--cdm-border); border-radius:15px; background:#fff; }.section-title { display:flex; align-items:flex-end; justify-content:space-between; gap:1rem; margin-bottom:.65rem; }.section-title > span { flex:none; color:var(--cdm-muted); font-size:.8rem; }.explanation { color:var(--cdm-muted); font-size:.86rem; line-height:1.6; }
    .table-scroll { overflow-x:auto; border:1px solid var(--cdm-border); border-radius:10px; }table { min-width:840px; }thead th { color:var(--cdm-muted); background:var(--cdm-blue-soft); font-size:.78rem; white-space:nowrap; }td,th { padding:.65rem .7rem; border-color:var(--cdm-border); }tbody th { display:flex; flex-direction:column; gap:.15rem; min-width:190px; }tbody th small { color:var(--cdm-muted); font-weight:500; }code { color:var(--cdm-muted); font-size:.7rem; }.check-label { display:inline-flex; align-items:center; gap:.45rem; color:var(--cdm-muted); font-size:.82rem; }.check-label input { width:1.1rem; height:1.1rem; accent-color:var(--cdm-royal-blue); }.order-input { width:82px; min-height:38px; padding:.35rem .5rem; font-size:.82rem; }.homepage-setting { display:flex; align-items:center; gap:.6rem; }.save-button { min-height:39px; padding:.45rem .8rem; background:var(--cdm-btn-primary); border-color:var(--cdm-royal-blue); font-weight:700; }.save-button:disabled { opacity:.65; }.shortcut-form { display:grid; gap:1rem; padding:1rem; border:1px solid var(--cdm-border); border-radius:11px; background:var(--cdm-page); }.form-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.8rem; }.form-grid label { display:grid; gap:.35rem; color:var(--cdm-muted); font-size:.79rem; font-weight:700; }.form-grid label strong { color:#C92A2A; }.form-control,.form-select { min-height:42px; font-size:.85rem; }.form-options { display:flex; flex-wrap:wrap; gap:1rem; }.emergency-option { color:#C92A2A; }.form-actions { display:flex; flex-wrap:wrap; gap:.5rem; }.cancel-button { min-height:39px; }.shortcut-list { display:grid; gap:.5rem; margin-top:1rem; }.shortcut-row { display:flex; align-items:center; flex-wrap:wrap; gap:.75rem; padding:.7rem; border:1px solid var(--cdm-border); border-radius:10px; }.shortcut-symbol { display:grid; place-items:center; flex:0 0 38px; width:38px; height:38px; border-radius:9px; color:var(--cdm-royal-blue); background:var(--cdm-btn-primary-light); }.shortcut-info { display:grid; flex:1 1 220px; gap:.1rem; min-width:0; }.shortcut-info small { color:var(--cdm-muted); font-size:.75rem; }.status-pill,.emergency-pill { padding:.22rem .5rem; border-radius:999px; color:var(--cdm-royal-blue); background:var(--cdm-page); font-size:.7rem; font-weight:750; }.status-pill.inactive { color:var(--cdm-muted); background:var(--cdm-page); }.emergency-pill { color:#C92A2A; background:var(--cdm-page); }.row-actions { display:flex; gap:.35rem; }.state,.notice,.error,.privacy-note { margin:0; padding:.85rem 1rem; border:1px solid var(--cdm-border); border-radius:10px; color:var(--cdm-muted); background:white; line-height:1.55; }.notice { border-color:var(--cdm-btn-primary-light); color:var(--cdm-royal-blue); background:var(--cdm-page); }.error { border-color:var(--cdm-form-danger); color:#C92A2A; background:var(--cdm-page); }.privacy-note { display:flex; align-items:center; gap:.5rem; border:0; background:transparent; font-size:.78rem; }.privacy-note i { color:var(--cdm-royal-blue); }.visually-hidden { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
    :is(a,button,input,select):focus-visible { outline:3px solid color-mix(in srgb, var(--cdm-btn-primary) 44%, transparent); outline-offset:3px; }
    @media(max-width:850px) { .form-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media(max-width:600px) { .admin-hero { flex-direction:column; }.refresh { width:100%; justify-content:center; }.section-title { align-items:flex-start; flex-direction:column; }.form-grid { grid-template-columns:1fr; }.shortcut-row { align-items:flex-start; }.row-actions { width:100%; }.row-actions button { flex:1; } }
  `,
})
export class AdminEssentialServicesComponent implements OnInit {
  private readonly categoryAdmin = inject(AdminCategoryService);
  private readonly essentialAdmin = inject(EssentialServiceService);
  private readonly categoryService = inject(ServiceCategoryService);
  private readonly document = inject(DOCUMENT);
  protected readonly categories = signal<readonly ServiceCategoryRow[]>([]);
  protected readonly shortcuts = signal<readonly EssentialShortcutRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    category_id: ['', Validators.required],
    subcategory_id: [''],
    title: ['', [Validators.required, Validators.maxLength(100)]],
    title_ta: ['', Validators.maxLength(100)],
    icon: ['', Validators.maxLength(80)],
    display_order: [0, [Validators.required, Validators.min(0)]],
    is_active: true,
    is_emergency: false,
  });
  private readonly selectedCategoryId = toSignal(this.form.controls.category_id.valueChanges, { initialValue: this.form.controls.category_id.value });
  protected readonly activeCategories = computed(() => this.categories().filter(row => row.is_active));
  protected readonly rootCategories = computed(() => this.activeCategories().filter(row => row.parent_id === null && row.is_essential));
  protected readonly subcategories = computed(() => this.activeCategories().filter(row => row.parent_id === this.selectedCategoryId() && row.is_essential));
  protected readonly rootCategoryOptions = computed<readonly SearchableSelectOption[]>(() => this.rootCategories().map(category => ({
    value: category.id, label: `${category.name_en} — ${category.name_ta}`, searchText: `${category.name_en} ${category.name_ta} ${category.slug}`,
  })));
  protected readonly subcategoryOptions = computed<readonly SearchableSelectOption[]>(() => this.subcategories().map(category => ({
    value: category.id, label: `${category.name_en} — ${category.name_ta}`, searchText: `${category.name_en} ${category.name_ta} ${category.slug}`,
  })));
  private readonly categoryNameMap = computed(() => new Map(this.categories().map(row => [row.id, row.name_en])));

  ngOnInit(): void { void this.load(); }

  protected async load(): Promise<void> {
    this.loading.set(true); this.error.set(null); this.message.set(null);
    try {
      const [categories, shortcuts] = await Promise.all([this.categoryAdmin.list(), this.essentialAdmin.listShortcutsForAdmin()]);
      this.categories.set(categories); this.shortcuts.set(shortcuts);
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to load essential settings.'); }
    finally { this.loading.set(false); }
  }

  protected async saveCategory(event: Event, category: ServiceCategoryRow, essential: boolean, essentialOrder: string, shortcut: boolean, shortcutOrder: string, emergency: boolean, homepage: boolean, homepageOrder: string): Promise<void> {
    event.preventDefault(); this.saving.set(true); this.error.set(null); this.message.set(null);
    const parent = category.parent_id ? this.categories().find(row => row.id === category.parent_id) : null;
    const essentialChildren = this.categories().some(row => row.parent_id === category.id && row.is_essential);
    if ((shortcut || homepage || emergency) && !essential) {
      this.error.set('Mark this category as Essential before enabling shortcuts, homepage visibility or emergency status.'); this.saving.set(false); return;
    }
    if (category.parent_id && essential && !parent?.is_essential) {
      this.error.set('Mark the parent category as Essential first so this subcategory has a visible directory path.'); this.saving.set(false); return;
    }
    if (!category.parent_id && !essential && essentialChildren) {
      this.error.set('Remove Essential status from this category’s selected subcategories before removing it here.'); this.saving.set(false); return;
    }
    const priority = Number(essentialOrder); const shortcutPriority = Number(shortcutOrder); const homepagePriority = Number(homepageOrder);
    if (!Number.isInteger(priority) || priority < 0 || !Number.isInteger(shortcutPriority) || shortcutPriority < 0 || !Number.isInteger(homepagePriority) || homepagePriority < 0) {
      this.error.set('Display order must be a non-negative whole number.'); this.saving.set(false); return;
    }
    try {
      await this.essentialAdmin.updateCategoryCuration({
        id: category.id, is_essential: essential, essential_order: essential ? priority : null,
        show_as_shortcut: shortcut, shortcut_order: shortcut ? shortcutPriority : null,
        show_on_homepage: homepage, homepage_order: homepage ? homepagePriority : null, is_emergency: emergency,
      });
      await this.categoryService.refresh();
      await this.load(); this.message.set(`${category.name_en} curation saved.`);
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to save category settings.'); }
    finally { this.saving.set(false); }
  }

  protected async saveShortcut(): Promise<void> {
    this.formError.set(null); this.form.markAllAsTouched();
    const raw = this.form.getRawValue();
    if (this.form.invalid || !raw.title.trim() || !Number.isInteger(Number(raw.display_order))) {
      this.formError.set('Select a category, enter a title, and provide a valid display order.'); return;
    }
    this.saving.set(true); this.error.set(null); this.message.set(null);
    const input: EssentialShortcutMutation = {
      id: this.editingId() ?? undefined, category_id: raw.category_id,
      subcategory_id: raw.subcategory_id || null, title: raw.title.trim(),
      title_ta: raw.title_ta.trim() || null, icon: raw.icon.trim() || null,
      display_order: Number(raw.display_order), is_active: raw.is_active, is_emergency: raw.is_emergency,
    };
    try {
      await this.essentialAdmin.saveShortcut(input); await this.load(); this.resetForm(); this.message.set('Shortcut saved.');
    } catch (error) { this.formError.set(error instanceof Error ? error.message : 'Unable to save shortcut.'); }
    finally { this.saving.set(false); }
  }

  protected editShortcut(shortcut: EssentialShortcutRow): void {
    this.editingId.set(shortcut.id); this.formError.set(null);
    this.form.reset({ category_id: shortcut.category_id, subcategory_id: shortcut.subcategory_id ?? '', title: shortcut.title,
      title_ta: shortcut.title_ta ?? '', icon: shortcut.icon ?? '', display_order: shortcut.display_order,
      is_active: shortcut.is_active, is_emergency: shortcut.is_emergency });
  }

  protected resetForm(): void {
    this.editingId.set(null); this.formError.set(null);
    this.form.reset({ category_id: '', subcategory_id: '', title: '', title_ta: '', icon: '', display_order: 0, is_active: true, is_emergency: false });
  }

  protected async removeShortcut(shortcut: EssentialShortcutRow): Promise<void> {
    if (!(this.document.defaultView?.confirm(`Remove the “${shortcut.title}” shortcut?`) ?? false)) return;
    this.saving.set(true); this.error.set(null); this.message.set(null);
    try { await this.essentialAdmin.deleteShortcut(shortcut.id); await this.load(); this.message.set('Shortcut removed.'); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to remove shortcut.'); }
    finally { this.saving.set(false); }
  }

  protected categoryName(id: string): string { return this.categoryNameMap().get(id) ?? 'Unavailable category'; }
  protected clearShortcutSubcategory(): void { this.form.controls.subcategory_id.setValue(''); }
}
