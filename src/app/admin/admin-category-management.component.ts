import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminCategoryService, AdminCategoryTreeRow, CategoryMutation, flattenAdminCategories } from '../core/services/admin-category.service';
import { ServiceCategoryRow } from '../core/models/service-category';
import { LanguageService } from '../core/services/language.service';

@Component({
  selector: 'app-admin-category-management',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="category-admin-page" aria-labelledby="category-admin-title" [attr.aria-busy]="loading() || savingId() !== null">
      <header class="page-header">
        <div>
          <a class="back-link" routerLink="/admin"><i class="bi bi-arrow-left" aria-hidden="true"></i> {{ i18n.language() === 'ta' ? 'நிர்வாக பலகை' : 'Admin dashboard' }}</a>
          <p class="eyebrow">{{ i18n.language() === 'ta' ? 'சேவை அடைவு' : 'SERVICE DIRECTORY' }}</p>
          <h1 id="category-admin-title">{{ i18n.language() === 'ta' ? 'வகைகள் மற்றும் உட்பிரிவுகள்' : 'Categories and subcategories' }}</h1>
          <p class="intro">{{ i18n.language() === 'ta' ? 'பொது சேவை அடைவின் வகை அமைப்பை நிர்வகிக்கவும்.' : 'Manage the category hierarchy used by the public service directory.' }}</p>
        </div>
        <a class="primary-action" routerLink="/admin/categories/new"><i class="bi bi-plus-lg" aria-hidden="true"></i> {{ i18n.language() === 'ta' ? 'வகையைச் சேர்' : 'Add category' }}</a>
      </header>

      <div class="toolbar">
        <label class="search-label">
          <span>{{ i18n.language() === 'ta' ? 'வகைகளைத் தேடுக' : 'Search categories' }}</span>
          <input #search type="search" [value]="searchTerm()" (input)="searchTerm.set(search.value)" [placeholder]="i18n.language() === 'ta' ? 'தமிழ், English அல்லது slug' : 'Tamil, English name or slug'" />
        </label>
        @if (searchTerm()) { <button type="button" class="secondary-action" (click)="searchTerm.set('')">{{ i18n.language() === 'ta' ? 'தேடலை நீக்கு' : 'Clear search' }}</button> }
        <button type="button" class="secondary-action" (click)="load()">{{ i18n.language() === 'ta' ? 'புதுப்பி' : 'Refresh' }}</button>
      </div>

      @if (loading()) {
        <p class="state" role="status">{{ i18n.language() === 'ta' ? 'வகைகள் ஏற்றப்படுகின்றன…' : 'Loading categories…' }}</p>
      } @else if (errorMessage(); as message) {
        <div class="state"><p role="alert">{{ message }}</p><button type="button" (click)="load()">{{ i18n.language() === 'ta' ? 'மீண்டும் முயற்சிக்கவும்' : 'Try again' }}</button></div>
      } @else if (!visibleRows().length) {
        <div class="state"><p role="status">{{ searchTerm() ? (i18n.language() === 'ta' ? 'பொருத்தமான வகைகள் இல்லை.' : 'No matching categories.') : (i18n.language() === 'ta' ? 'வகைகள் எதுவும் இல்லை.' : 'No categories have been created yet.') }}</p>
          @if (searchTerm()) { <button type="button" (click)="searchTerm.set('')">{{ i18n.language() === 'ta' ? 'தேடலை நீக்கு' : 'Clear search' }}</button> }
          @else { <a class="inline-link" routerLink="/admin/categories/new">{{ i18n.language() === 'ta' ? 'முதல் வகையை உருவாக்கு' : 'Create the first category' }}</a> }
        </div>
      } @else {
        <div class="table-wrap">
          <table>
            <caption class="visually-hidden">Category and subcategory management</caption>
            <thead><tr><th scope="col">Category</th><th scope="col">Slug</th><th scope="col">Order</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              @for (row of visibleRows(); track row.category.id) {
                <tr>
                  <th scope="row"><span class="tree-name" [style.padding-inline-start.rem]="row.depth * 1.35"><i class="bi tree-marker" [class]="row.depth ? 'bi bi-arrow-return-right tree-marker' : 'bi bi-folder2 tree-marker'" aria-hidden="true"></i><span><strong>{{ row.category.name_en }}</strong><small lang="ta">{{ row.category.name_ta }}</small></span></span></th>
                  <td><code>{{ row.category.slug }}</code></td>
                  <td>{{ row.category.sort_order }}</td>
                  <td><span [class.status-active]="row.category.is_active" [class.status-inactive]="!row.category.is_active">{{ row.category.is_active ? 'Active' : 'Inactive' }}</span></td>
                  <td><div class="row-actions"><a [routerLink]="['/admin/categories', row.category.id, 'edit']">Edit</a><button type="button" (click)="toggle(row.category)" [disabled]="savingId() === row.category.id">{{ row.category.is_active ? 'Deactivate' : 'Activate' }}</button></div></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="scope" aria-live="polite">{{ visibleRows().length }} {{ visibleRows().length === 1 ? 'category' : 'categories' }} shown</p>
      }
    </section>
  `,
  styles: `
    :host { display:block; padding-block:1.5rem 2.5rem; }
    .category-admin-page { display:grid; gap:1.25rem; }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding:clamp(1.5rem,4vw,2.5rem); border-radius:20px; background:linear-gradient(120deg,#eff7ee,#f8f8ed); border:1px solid #dfeade; }
    .back-link { display:inline-flex; align-items:center; min-height:44px; margin-bottom:1rem; color:#075541; }
    .eyebrow { margin:0 0 .35rem; color:#52665b; font-size:.72rem; font-weight:800; letter-spacing:.12em; }
    h1 { margin:0; color:#173f32; font-size:clamp(1.7rem,4vw,2.5rem); overflow-wrap:anywhere; }
    .intro { color:#52665b; line-height:1.8; }
    .primary-action, .secondary-action, .row-actions a, .inline-link { display:inline-flex; align-items:center; justify-content:center; min-height:44px; border-radius:9px; font:inherit; text-decoration:none; cursor:pointer; }
    .primary-action { padding:.7rem 1rem; background:#075541; color:white; font-weight:700; white-space:nowrap; }
    .secondary-action { padding:.6rem .9rem; border:1px solid #b8c9bf; background:white; color:#075541; }
    .toolbar { display:flex; align-items:end; flex-wrap:wrap; gap:.75rem; padding:1rem; border:1px solid #dfe7e2; border-radius:14px; background:white; }
    .search-label { display:grid; flex:1 1 300px; gap:.4rem; color:#173f32; font-weight:650; }
    input { width:100%; min-height:44px; border:1px solid #b8c9bf; border-radius:9px; padding:.7rem; background:white; color:#173f32; font:inherit; }
    .table-wrap { overflow-x:auto; border:1px solid #dfe7e2; border-radius:16px; background:white; }
    table { width:100%; min-width:760px; border-collapse:collapse; color:#173f32; }
    th, td { padding:.9rem 1rem; border-bottom:1px solid #edf1ee; text-align:left; vertical-align:middle; }
    thead th { background:#f7faf7; color:#52665b; font-size:.82rem; letter-spacing:.03em; }
    tbody tr:last-child th, tbody tr:last-child td { border-bottom:0; }
    .tree-name { display:flex; align-items:center; gap:.5rem; min-width:240px; }
    .tree-name > span:last-child { display:flex; flex-direction:column; gap:.15rem; min-width:0; }
    .tree-name small { color:#52665b; font-weight:400; overflow-wrap:anywhere; }
    .tree-marker { flex:0 0 1rem; color:#176044; }
    code { color:#52665b; overflow-wrap:anywhere; }
    .status-active, .status-inactive { display:inline-flex; padding:.25rem .55rem; border-radius:99px; font-size:.78rem; font-weight:700; }
    .status-active { background:#e2f3e8; color:#176044; }.status-inactive { background:#f1eee8; color:#6b6251; }
    .row-actions { display:flex; align-items:center; flex-wrap:wrap; gap:.45rem; }
    .row-actions a { padding:.4rem .65rem; border:1px solid #b8c9bf; color:#075541; }
    .row-actions button, .state button { min-height:40px; border:1px solid #075541; border-radius:8px; padding:.45rem .65rem; background:#075541; color:white; font:inherit; cursor:pointer; }
    .row-actions button:disabled { opacity:.6; cursor:default; }
    .state { display:flex; align-items:center; flex-wrap:wrap; gap:1rem; padding:1.25rem; border:1px solid #dfe7e2; border-radius:14px; background:white; color:#52665b; line-height:1.7; }
    .inline-link { color:#075541; }
    .scope { color:#52665b; font-size:.85rem; }
    .visually-hidden { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
    :is(a,button,input):focus-visible { outline:3px solid #17583f; outline-offset:3px; }
    @media (max-width:700px) { .page-header { flex-direction:column; } .primary-action { width:100%; } .toolbar .secondary-action { flex:1 1 140px; } }
  `,
})
export class AdminCategoryManagementComponent implements OnInit {
  protected readonly i18n = inject(LanguageService);
  private readonly adminCategories = inject(AdminCategoryService);
  private readonly document = inject(DOCUMENT);
  protected readonly rows = signal<readonly AdminCategoryTreeRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly savingId = signal<string | null>(null);
  protected readonly searchTerm = signal('');
  protected readonly visibleRows = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase();
    return term
      ? this.rows().filter(row => `${row.category.name_ta} ${row.category.name_en} ${row.category.slug} ${row.category.description ?? ''}`.toLocaleLowerCase().includes(term))
      : this.rows();
  });

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      this.rows.set(flattenAdminCategories(await this.adminCategories.list()));
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load categories.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async toggle(category: ServiceCategoryRow): Promise<void> {
    const nextActive = !category.is_active;
    if (!nextActive && !this.confirm('Deactivate this category? It and its descendants will disappear from the public directory.')) return;
    this.savingId.set(category.id);
    this.errorMessage.set(null);
    const input: CategoryMutation = {
      parent_id: category.parent_id,
      name_ta: category.name_ta,
      name_en: category.name_en,
      slug: category.slug,
      description: category.description,
      icon_name: category.icon_name,
      sort_order: category.sort_order,
      is_active: nextActive,
    };
    try {
      await this.adminCategories.update(category.id, input);
      await this.load();
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to update category status.');
    } finally {
      this.savingId.set(null);
    }
  }

  private confirm(message: string): boolean {
    return this.document.defaultView?.confirm(message) ?? false;
  }
}
