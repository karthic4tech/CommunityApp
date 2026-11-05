# CDM 360 searchable select

`app-searchable-select` is the shared **single-selection** autocomplete for reactive forms and standalone filter controls. It writes the option's stable string value (typically a Supabase UUID) to the form; it never writes the display label. Multiple selections are intentionally not supported by this component. The service submission's additional coverage areas remain a searchable checkbox group because that field is genuinely multi-valued.

```html
<app-searchable-select
  controlId="parent-category"
  label="Parent category"
  formControlName="parent_slug"
  [options]="parentCategoryOptions()"
  [required]="true"
  [emptyValue]="''"
  placeholder="Select a category"
  searchPlaceholder="Search in English or Tamil…" />
```

Each `SearchableSelectOption` has `{ value, label, searchText?, disabled? }`. Put alternate-language labels and slugs in `searchText`. Use `value` and `valueChange` for a standalone binding, or `formControlName`/`ngModel` for forms. Remote data sources can be supplied as an async `remoteSearch(query)` callback; requests are debounced and `switchMap` prevents stale responses from replacing newer results. Configure `minSearchLength` for larger lookups. Small lookup lists should be loaded once and passed through `options`.

The app's category and locality lists are currently small (the linked project contains 251 active service categories and 13 active locations), so they use the existing Supabase-backed lookup services and local bilingual search rather than issuing a query per keystroke. The component also supports a debounced `remoteSearch` callback with a minimum query length, per-query cache and stale-response cancellation for future larger lookups. The autocomplete does not bypass RLS. Parent changes in service and admin shortcut forms clear dependent subcategory values before the form can be saved.

Migrated data selectors include service/category and locality filters, provider registration categories and locations, profile locality, marketplace categories and locations, marketplace/admin status filters, and media-admin module/status filters. Small fixed choices (language, service coverage type, product condition, contact method, report reason, and sort order) use native controls or radio groups where a searchable combobox would add unnecessary friction. Existing flows that need multiple values use a searchable checkbox list, never a multi-select autocomplete.
