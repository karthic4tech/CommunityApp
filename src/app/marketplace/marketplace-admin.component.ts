import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MarketplaceCategoryRow, MarketplaceListing, MarketplaceReport, MarketplaceStatus } from './marketplace.models';
import { MarketplaceAdminStats, MarketplaceCategoryMutation, MarketplaceService } from './marketplace.service';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption, SearchableSelectValue } from '../shared/components/searchable-select/searchable-select.models';

@Component({
  selector: 'app-marketplace-admin',
  imports: [RouterLink, FormsModule, CurrencyPipe, DatePipe, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mp-page mp-admin-page container-xl" aria-labelledby="mp-admin-title" [attr.aria-busy]="loading() || saving()">
      <header class="mp-dashboard-head"><div><a routerLink="/admin" class="mp-back-link"><i class="bi bi-arrow-left" aria-hidden="true"></i> Admin dashboard</a><p class="mp-eyebrow">MARKETPLACE OPERATIONS</p><h1 id="mp-admin-title">Marketplace Moderation</h1><p>Review product listings, reports, categories and marketplace settings.</p></div><button type="button" class="mp-secondary" (click)="load()" [disabled]="loading()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Refresh</button></header>
      @if (error()) { <p class="mp-state mp-error" role="alert">{{ error() }}</p> }
      @if (notice()) { <p class="mp-success" role="status">{{ notice() }}</p> }
      @if (stats(); as summary) { <section class="mp-stats" aria-label="Marketplace totals"><article><span>Total Listings</span><strong>{{ summary.total }}</strong></article><article><span>Pending Approval</span><strong>{{ summary.pending }}</strong></article><article><span>Published</span><strong>{{ summary.published }}</strong></article><article><span>Rejected</span><strong>{{ summary.rejected }}</strong></article><article><span>Reported</span><strong>{{ summary.reported }}</strong></article><article><span>Sold</span><strong>{{ summary.sold }}</strong></article></section> }
      <nav class="mp-status-tabs mp-admin-tabs" aria-label="Marketplace administration sections">
        @for (section of adminTabs; track section.value) { <button type="button" [class.active]="tab() === section.value" (click)="selectTab(section.value)">{{ section.label }}</button> }
      </nav>
      @if (loading()) { <p class="mp-state" role="status">Loading marketplace administration…</p> }
      @else {
        @if (tab() === 'listings') {
          <section aria-labelledby="admin-listings-title"><header class="mp-section-head"><div><p class="mp-eyebrow">SELLER SUBMISSIONS</p><h2 id="admin-listings-title">Marketplace listings</h2></div></header>
            <div class="mp-admin-filters"><input class="form-control" type="search" [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event)" placeholder="Search title or seller" aria-label="Search marketplace listings"><app-searchable-select label="Status" controlId="mp-admin-status" [options]="statusOptions()" [value]="listingStatus()" (valueChange)="setListingStatus($event)" [clearable]="false" searchPlaceholder="Search statuses…" /><button type="button" class="mp-search-button" (click)="loadListings()">Search</button></div>
            @if (!listings().length) { <p class="mp-state">No marketplace listings match this filter.</p> }
            <div class="mp-admin-list">@for (item of listings(); track item.id) {
              <article><a [routerLink]="['/marketplace/item',item.id,item.slug]">@if (primaryImage(item); as image) { <img [src]="image" [alt]="item.title" loading="lazy"> } @else { <span class="mp-admin-image-placeholder"><i class="bi bi-image" aria-hidden="true"></i></span> }</a>
                <div><h3>{{ item.title }}</h3><p>{{ item.seller_display_name }} · {{ item.category?.name }} · {{ item.price | currency:'INR':'symbol':'1.0-0' }}</p><span class="mp-listing-status" [class]="'mp-listing-status status-' + item.status">{{ statusLabel(item.status) }}</span>@if (item.status === 'rejected' && item.rejection_reason) { <p class="mp-rejection">{{ item.rejection_reason }}</p> }</div>
                <div class="mp-admin-actions"><textarea #remarks aria-label="Moderation remarks" maxlength="2000" rows="2" placeholder="Remarks for seller"></textarea><label class="mp-admin-feature"><input #featured type="checkbox" [checked]="item.is_featured"> Feature listing</label>
                  @if (item.status === 'pending_approval' || item.status === 'rejected') { <button type="button" class="approve" [disabled]="saving()" (click)="moderate(item,'approve',remarks.value,featured.checked)">Approve & Publish</button><button type="button" class="reject" [disabled]="saving()" (click)="moderate(item,'reject',remarks.value,featured.checked)">Reject</button> }
                  @if (item.status === 'published') { <button type="button" class="reject" [disabled]="saving()" (click)="moderate(item,'suspend',remarks.value,featured.checked)">Suspend</button><button type="button" [disabled]="saving()" (click)="moderate(item,'restore',remarks.value,featured.checked)">{{ item.is_featured ? 'Save / Unfeature' : 'Save / Feature' }}</button> }
                  @if (item.status === 'suspended') { <button type="button" class="approve" [disabled]="saving()" (click)="moderate(item,'restore',remarks.value,featured.checked)">Restore listing</button> }
                </div>
              </article>
            }</div>
          </section>
        }

        @if (tab() === 'categories') {
          <section aria-labelledby="admin-categories-title"><header class="mp-section-head"><div><p class="mp-eyebrow">CATALOGUE</p><h2 id="admin-categories-title">Marketplace categories</h2><p>Categories are database-managed and never hardcoded in the marketplace pages.</p></div><button type="button" class="mp-primary" (click)="newCategory()">Add category</button></header>
            @if (categoryEditor()) { <form class="mp-category-admin-form cdm-form" (submit)="saveCategory($event, categoryId(), parent.value,name.value,nameTa.value,slug.value,description.value,icon.value,order.value,schema.value,active.checked)">
              <h3>{{ categoryId() ? 'Edit category' : 'New category' }}</h3><app-searchable-select #parent="ngModel" name="marketplace-parent-category" label="Parent category" controlId="marketplace-parent-category" [ngModel]="categoryDraft().parent_id" (ngModelChange)="setCategoryParent($event)" [ngModelOptions]="{standalone:true}" [options]="parentCategoryOptions()" [emptyValue]="''" [clearable]="true" placeholder="Top-level category" searchPlaceholder="Search category names…" />
              <label>English name<input #name class="form-control" required maxlength="100" [value]="categoryDraft().name"></label><label>Tamil name<input #nameTa class="form-control" required maxlength="100" [value]="categoryDraft().name_ta" lang="ta"></label><label>Slug<input #slug class="form-control" required maxlength="120" pattern="[a-z0-9]+(-[a-z0-9]+)*" [value]="categoryDraft().slug"></label><label>Icon class<input #icon class="form-control" maxlength="80" placeholder="bi bi-phone" [value]="categoryDraft().icon"></label><label>Sort order<input #order class="form-control" required type="number" min="0" step="1" [value]="categoryDraft().sort_order"></label><label class="mp-schema-field">Description<textarea #description class="form-control" maxlength="1000" [value]="categoryDraft().description"></textarea></label><label class="mp-schema-field">Product-specific fields (JSON array)<textarea #schema class="form-control" rows="5" [value]="schemaText()" placeholder='[{"key":"brand","label":"Brand","type":"text"}]'></textarea></label><label class="mp-check"><input #active type="checkbox" [checked]="categoryDraft().is_active"> Active category</label><div class="mp-admin-form-actions"><button type="submit" class="mp-primary" [disabled]="saving()">Save category</button><button type="button" class="mp-secondary" (click)="categoryEditor.set(false)">Cancel</button></div>
            </form> }
            <div class="mp-category-admin-list">@for (category of categories(); track category.id) { <article class="mp-category-admin-row"><div><strong>{{ category.name }}</strong><small lang="ta">{{ category.name_ta }}</small><code>{{ category.slug }}</code></div><span>{{ category.parent_id ? 'Subcategory' : 'Main category' }} · order {{ category.sort_order }}</span><span class="mp-listing-status" [class.inactive]="!category.is_active">{{ category.is_active ? 'Active' : 'Inactive' }}</span><button type="button" class="mp-secondary" (click)="editCategory(category)">Edit</button><button type="button" class="mp-secondary" (click)="toggleCategory(category)">{{ category.is_active ? 'Deactivate' : 'Activate' }}</button></article> }</div>
          </section>
        }

        @if (tab() === 'reports') {
          <section aria-labelledby="admin-reports-title"><header class="mp-section-head"><div><p class="mp-eyebrow">COMMUNITY SAFETY</p><h2 id="admin-reports-title">Listing reports</h2></div></header>
            @if (!reports().length) { <p class="mp-state">No reported marketplace listings.</p> }
            <div class="mp-report-list">@for (report of reports(); track report.id) { <article class="mp-report-card"><div><strong>{{ report.listing?.title || 'Listing unavailable' }}</strong><p>{{ report.reason }} · {{ report.description || 'No extra details' }}</p><small>{{ report.created_at | date:'medium' }} · {{ report.status }}</small></div><div class="mp-report-actions"><a [routerLink]="['/marketplace/item',report.listing_id,report.listing?.slug || 'item']">Open listing</a>@if (report.status !== 'dismissed' && report.status !== 'action_taken') { <button type="button" class="mp-secondary" (click)="resolveReport(report,'reviewing')">Reviewing</button><button type="button" class="mp-secondary" (click)="resolveReport(report,'action_taken')">Action taken</button><button type="button" class="mp-secondary" (click)="resolveReport(report,'dismissed')">Dismiss</button> }</div></article> }</div>
          </section>
        }

        @if (tab() === 'settings') {
          <section aria-labelledby="admin-settings-title" class="mp-settings-card"><p class="mp-eyebrow">MARKETPLACE RULES</p><h2 id="admin-settings-title">Listing configuration</h2><form class="cdm-form" (submit)="saveSettings($event,freeListings.checked,expiry.value,maxImages.value)"><label class="mp-check"><input #freeListings type="checkbox" [checked]="settings().allow_free_listings"> Allow free listings</label><label>Default expiry (days)<input #expiry class="form-control" type="number" min="1" max="365" [value]="settings().default_expiry_days"></label><label>Maximum product images<input #maxImages class="form-control" type="number" min="1" max="10" [value]="settings().max_images_per_listing"></label><button type="submit" class="mp-primary" [disabled]="saving()">Save settings</button></form></section>
        }
        @if (tab() === 'logs') { <section><header class="mp-section-head"><div><p class="mp-eyebrow">AUDIT TRAIL</p><h2>Recent moderation actions</h2></div></header>@for (log of logs(); track log.id) { <article class="mp-log-row"><strong>{{ log.action }}</strong><span>{{ log.remarks || 'No remarks' }}</span><time>{{ log.created_at | date:'medium' }}</time></article> }</section> }
      }
    </main>
  `,
})
export class MarketplaceAdminComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly tab = signal<'listings'|'categories'|'reports'|'settings'|'logs'>('listings');
  protected readonly stats = signal<MarketplaceAdminStats | null>(null);
  protected readonly listings = signal<MarketplaceListing[]>([]);
  protected readonly categories = signal<MarketplaceCategoryRow[]>([]);
  protected readonly reports = signal<MarketplaceReport[]>([]);
  protected readonly logs = signal<Array<{id:string;listing_id:string|null;action:string;remarks:string|null;created_at:string}>>([]);
  protected readonly settings = signal({ allow_free_listings:false, default_expiry_days:60, max_images_per_listing:10 });
  protected readonly searchTerm = signal('');
  protected readonly listingStatus = signal('pending_approval');
  protected readonly categoryEditor = signal(false);
  protected readonly categoryId = signal<string | null>(null);
  protected readonly schemaText = signal('[]');
  protected readonly categoryDraft = signal<MarketplaceCategoryMutation>({ id:undefined,parent_id:null,name:'',name_ta:'',slug:'',description:null,icon:null,sort_order:0,attributes_schema:[],is_active:true });
  protected readonly statuses = ['draft','pending_approval','published','rejected','sold','expired','suspended','archived'] as const;
  protected readonly statusOptions = signal<readonly SearchableSelectOption[]>([
    {value:'all',label:'All statuses',searchText:'all'},
    ...this.statuses.map(status => ({value:status,label:this.statusLabel(status),searchText:status.replaceAll('_',' ')})),
  ]);
  protected readonly adminTabs = [
    {value:'listings',label:'Listings'},{value:'categories',label:'Categories'},{value:'reports',label:'Reports'},
    {value:'settings',label:'Settings'},{value:'logs',label:'Audit log'},
  ] as const;
  protected readonly rootCategories = signal<MarketplaceCategoryRow[]>([]);
  protected readonly parentCategoryOptions = signal<readonly SearchableSelectOption[]>([]);

  ngOnInit(): void { void this.load(); }
  protected async load(): Promise<void> {
    this.loading.set(true); this.error.set(null);
    try {
      const [stats,categories,reports,settings,logs] = await Promise.all([
        this.marketplace.adminStats(),this.marketplace.flatCategories(true),this.marketplace.reports(),this.marketplace.settings(),this.marketplace.moderationLogs(),
      ]);
      this.stats.set(stats); this.categories.set(categories); this.rootCategories.set(categories.filter(row => row.parent_id === null));
      this.parentCategoryOptions.set(categories.filter(row => row.parent_id === null).map(row => ({value:row.id,label:row.name,searchText:`${row.name} ${row.name_ta} ${row.slug}`})));
      this.reports.set(reports); this.settings.set(settings); this.logs.set(logs);
      await this.loadListings();
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to load marketplace administration.'); }
    finally { this.loading.set(false); }
  }
  protected selectTab(value: 'listings'|'categories'|'reports'|'settings'|'logs'): void { this.tab.set(value); if (value === 'listings') void this.loadListings(); }
  protected async loadListings(): Promise<void> {
    try { this.listings.set((await this.marketplace.adminListings(this.listingStatus(),this.searchTerm())).items); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to load listings.'); }
  }
  protected setListingStatus(value: SearchableSelectValue): void { this.listingStatus.set(typeof value === 'string' && value ? value : 'all'); }
  protected setCategoryParent(value: string | null): void { this.categoryDraft.update(current => ({...current,parent_id:value || null})); }
  protected async moderate(item: MarketplaceListing, decision: 'approve'|'reject'|'suspend'|'restore', remarks: string, featured: boolean): Promise<void> {
    this.saving.set(true); this.error.set(null); this.notice.set(null);
    try { await this.marketplace.moderateListing(item.id,decision,remarks,featured); this.notice.set(`Listing ${decision}d.`); await this.load(); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to save moderation decision.'); }
    finally { this.saving.set(false); }
  }
  protected primaryImage(item: MarketplaceListing): string | null { const images=item.images??[];return images.find(image=>image.is_primary)?.url??images[0]?.url??null; }
  protected statusLabel(status: MarketplaceStatus): string { return ({draft:'Draft',pending_approval:'Pending approval',published:'Published',rejected:'Rejected',sold:'Sold',expired:'Expired',suspended:'Suspended',archived:'Archived'} as const)[status]; }
  protected newCategory(): void { this.categoryId.set(null); this.categoryDraft.set({parent_id:null,name:'',name_ta:'',slug:'',description:null,icon:null,sort_order:this.categories().length*10,attributes_schema:[],is_active:true});this.schemaText.set('[]');this.categoryEditor.set(true); }
  protected editCategory(category: MarketplaceCategoryRow): void { this.categoryId.set(category.id);this.categoryDraft.set({...category});this.schemaText.set(JSON.stringify(category.attributes_schema,null,2));this.categoryEditor.set(true); }
  protected async saveCategory(event: Event,id:string|null,parentId:string,name:string,nameTa:string,slug:string,description:string,icon:string,order:string,schema:string,active:boolean): Promise<void> {
    event.preventDefault();this.error.set(null);this.notice.set(null);
    let attributes: MarketplaceCategoryMutation['attributes_schema'];
    try { const parsed: unknown = JSON.parse(schema||'[]');if(!Array.isArray(parsed))throw new Error();attributes=parsed as MarketplaceCategoryMutation['attributes_schema']; }
    catch { this.error.set('Product-specific fields must be a valid JSON array.');return; }
    const sortOrder=Number(order);
    if(!name.trim()||!nameTa.trim()||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!Number.isInteger(sortOrder)||sortOrder<0){this.error.set('Enter valid category names, a lowercase slug and a non-negative order.');return;}
    this.saving.set(true);
    try { await this.marketplace.saveCategory({id:id||undefined,parent_id:parentId||null,name:name.trim(),name_ta:nameTa.trim(),slug,description:description.trim()||null,icon:icon.trim()||null,sort_order:sortOrder,attributes_schema:attributes,is_active:active});this.categoryEditor.set(false);this.notice.set('Marketplace category saved.');await this.load(); }
    catch(error){this.error.set(error instanceof Error?error.message:'Unable to save category.');}
    finally{this.saving.set(false);}
  }
  protected async toggleCategory(category:MarketplaceCategoryRow):Promise<void>{this.saving.set(true);this.error.set(null);try{await this.marketplace.saveCategory({...category,is_active:!category.is_active});await this.load();}catch(error){this.error.set(error instanceof Error?error.message:'Unable to update category.');}finally{this.saving.set(false);}}
  protected async resolveReport(report:MarketplaceReport,status:'reviewing'|'action_taken'|'dismissed'):Promise<void>{this.saving.set(true);this.error.set(null);try{await this.marketplace.resolveReport(report.id,status);this.notice.set('Report status updated.');await this.load();}catch(error){this.error.set(error instanceof Error?error.message:'Unable to update report.');}finally{this.saving.set(false);}}
  protected async saveSettings(event:Event,free:boolean,expiry:string,maxImages:string):Promise<void>{event.preventDefault();const days=Number(expiry),images=Number(maxImages);if(!Number.isInteger(days)||days<1||days>365||!Number.isInteger(images)||images<1||images>10){this.error.set('Expiry must be 1–365 days and image count must be 1–10.');return;}this.saving.set(true);try{await this.marketplace.saveSettings({allow_free_listings:free,default_expiry_days:days,max_images_per_listing:images});this.notice.set('Marketplace settings saved.');await this.load();}catch(error){this.error.set(error instanceof Error?error.message:'Unable to save settings.');}finally{this.saving.set(false);}}
}
