import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Renderer2, computed, effect, forwardRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, distinctUntilChanged, from, map, of, switchMap, finalize, timer } from 'rxjs';
import { SearchableSelectOption, SearchableSelectRemoteSearch, SearchableSelectValue } from './searchable-select.models';

interface PanelPosition { top: number; left: number; width: number; above: boolean; }
interface LabelPart { text: string; match: boolean; }

@Component({
  selector: 'app-searchable-select',
  templateUrl: './searchable-select.component.html',
  styleUrl: './searchable-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchableSelectComponent), multi: true }],
  host: {
    '[class.is-disabled]': 'isDisabled()',
    '[class.is-open]': 'isOpen()',
  },
})
export class SearchableSelectComponent implements ControlValueAccessor {
  private static nextId = 0;
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchTerms = new Subject<string>();
  private readonly remoteCache = new Map<string, readonly SearchableSelectOption[]>();
  private readonly selectedCache = signal<ReadonlyMap<string, SearchableSelectOption>>(new Map());
  private readonly inputElement = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly controlId = input<string | null>(null);
  readonly label = input('');
  readonly options = input<readonly SearchableSelectOption[]>([]);
  readonly value = input<SearchableSelectValue | undefined>(undefined);
  readonly valueChange = output<SearchableSelectValue>();
  readonly touched = output<void>();
  readonly emptyValue = input<string | null>('');
  readonly placeholder = input('Select an option');
  readonly searchPlaceholder = input('Type to search…');
  readonly searchable = input(true);
  readonly disabled = input(false);
  readonly required = input(false);
  readonly readOnly = input(false);
  readonly loading = input(false);
  readonly clearable = input(true);
  readonly invalid = input(false);
  readonly hint = input('');
  readonly error = input('');
  readonly minSearchLength = input(0);
  readonly maxResults = input(300);
  readonly debounceMs = input(300);
  readonly noResultsText = input('No matching options found');
  readonly loadingText = input('Loading options…');
  readonly minCharsText = input('Type at least');
  readonly remoteSearch = input<SearchableSelectRemoteSearch | null>(null);

  protected readonly inputId = computed(() => this.controlId() || `cdm-searchable-select-${SearchableSelectComponent.nextId}`);
  protected readonly listId = computed(() => `${this.inputId()}-listbox`);
  protected readonly query = signal('');
  protected readonly isOpen = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());
  private readonly currentValue = signal<SearchableSelectValue>(null);
  protected readonly remoteResults = signal<readonly SearchableSelectOption[] | null>(null);
  protected readonly remoteLoading = signal(false);
  protected readonly remoteError = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly panelPosition = signal<PanelPosition>({ top: 0, left: 0, width: 0, above: false });
  protected readonly results = computed(() => {
    const remote = this.remoteSearch();
    const source = remote ? this.remoteResults() ?? [] : this.options();
    const query = this.normalise(this.query());
    const filtered = remote || !query
      ? source
      : source.filter(option => this.normalise(`${option.label} ${option.searchText ?? ''}`).includes(query));
    return filtered.slice(0, Math.max(1, this.maxResults()));
  });
  protected readonly selectedSingle = computed(() => {
    const value = this.currentValue();
    if (typeof value !== 'string' || !value) return null;
    return this.options().find(option => option.value === value)
      ?? this.remoteResults()?.find(option => option.value === value)
      ?? this.selectedCache().get(value)
      ?? { value, label: value };
  });
  protected readonly displayedValue = computed(() => this.isOpen() ? this.query() : this.selectedSingle()?.label ?? '');
  protected readonly isBusy = computed(() => this.loading() || this.remoteLoading());
  protected readonly needsMoreChars = computed(() => Boolean(this.remoteSearch()) && this.normalise(this.query()).length < this.minSearchLength());
  protected readonly activeOptionId = computed(() => {
    const option = this.results()[this.activeIndex()];
    return option ? `${this.listId()}-option-${this.activeIndex()}` : null;
  });
  protected readonly showClear = computed(() => this.clearable() && !this.isDisabled() && !this.readOnly() && Boolean(this.currentValue()));
  private formDisabled = signal(false);
  private onChange: (value: SearchableSelectValue) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    SearchableSelectComponent.nextId++;

    effect(() => {
      const externalValue = this.value();
      if (externalValue !== undefined) this.currentValue.set(externalValue);
    });

    this.searchTerms.pipe(
      distinctUntilChanged(),
      switchMap(term => timer(Math.max(0, this.debounceMs())).pipe(switchMap(() => {
          const search = this.remoteSearch();
          const query = this.normalise(term);
          if (!search) {
            this.remoteResults.set(null);
            this.remoteError.set(false);
            return of<readonly SearchableSelectOption[]>([]);
          }
          if (query.length < this.minSearchLength()) {
            this.remoteResults.set([]);
            this.remoteError.set(false);
            return of<readonly SearchableSelectOption[]>([]);
          }
          const cached = this.remoteCache.get(query);
          if (cached) {
            this.remoteResults.set(cached);
            this.remoteError.set(false);
            return of(cached);
          }
          this.remoteLoading.set(true);
          this.remoteError.set(false);
          return from(search(query)).pipe(
            map(items => {
              const unique = this.uniqueOptions(items);
              this.remoteCache.set(query, unique);
              if (this.remoteCache.size > 30) this.remoteCache.delete(this.remoteCache.keys().next().value as string);
              this.remoteResults.set(unique);
              this.cacheSelected(unique);
              return unique;
            }),
            catchError(() => {
              this.remoteError.set(true);
              this.remoteResults.set([]);
              return of<readonly SearchableSelectOption[]>([]);
            }),
            finalize(() => this.remoteLoading.set(false)),
          );
        })),
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.ensureActiveIndex());

    const stopOutside = this.renderer.listen('document', 'pointerdown', (event: Event) => {
      if (!this.isOpen()) return;
      const target = event.target;
      if (target && !this.host.nativeElement.contains(target as Node)) this.close(true);
    });
    this.destroyRef.onDestroy(stopOutside);

    const win = this.document.defaultView;
    if (win) {
      let scheduled = false;
      const reposition = () => {
        if (!this.isOpen() || scheduled) return;
        scheduled = true;
        win.requestAnimationFrame(() => { scheduled = false; if (this.isOpen()) this.positionPanel(); });
      };
      const onResize = this.renderer.listen(win, 'resize', reposition);
      const onScroll = this.renderer.listen('document', 'scroll', reposition, { capture: true, passive: true });
      this.destroyRef.onDestroy(onResize);
      this.destroyRef.onDestroy(onScroll);
    }
  }

  writeValue(value: unknown): void {
    untracked(() => {
      const normalized: SearchableSelectValue = Array.isArray(value)
        ? (typeof value[0] === 'string' ? value[0] : null)
        : typeof value === 'string' && value.length ? value : null;
      this.currentValue.set(normalized);
      this.cacheSelected(this.options());
      this.query.set('');
      this.remoteResults.set(null);
    });
  }

  registerOnChange(fn: (value: SearchableSelectValue) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.formDisabled.set(disabled); if (disabled) this.close(false); }

  protected onFocus(): void {
    if (!this.isDisabled() && !this.readOnly()) this.open();
  }

  protected onInput(event: Event): void {
    if (this.isDisabled() || this.readOnly()) return;
    const value = (event.currentTarget as HTMLInputElement).value;
    this.query.set(value);
    this.activeIndex.set(0);
    this.remoteResults.set(this.remoteSearch() ? [] : null);
    this.remoteError.set(false);
    if (!this.isOpen()) this.isOpen.set(true);
    this.searchTerms.next(value);
    this.positionPanel();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.isDisabled()) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.isOpen()) this.open();
      else this.moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.isOpen()) this.open();
      else this.moveActive(-1);
      return;
    }
    if (event.key === 'Enter') {
      if (this.isOpen()) {
        event.preventDefault();
        const option = this.results()[this.activeIndex()];
        if (option) this.select(option);
      } else {
        event.preventDefault();
        this.open();
      }
      return;
    }
    if (event.key === 'Escape' && this.isOpen()) {
      event.preventDefault();
      this.close(true);
      return;
    }
    if (event.key === 'Tab' && this.isOpen()) this.close(true);
  }

  protected toggle(): void {
    if (this.isDisabled()) return;
    if (this.isOpen()) this.close(true);
    else this.open();
  }

  protected select(option: SearchableSelectOption): void {
    if (option.disabled || this.isDisabled()) return;
    this.cacheSelected([option]);
    this.currentValue.set(option.value);
    this.onChange(option.value);
    this.valueChange.emit(option.value);
    this.close(true);
  }

  protected clearSelection(event?: Event): void {
    event?.stopPropagation();
    if (this.isDisabled() || this.readOnly()) return;
    const emptyValue = this.emptyValue();
    this.currentValue.set(emptyValue);
    this.onChange(emptyValue);
    this.valueChange.emit(emptyValue);
    this.query.set('');
    this.searchTerms.next('');
    this.activeIndex.set(-1);
    this.inputElement()?.nativeElement.focus();
  }

  protected clearSearch(): void {
    this.query.set('');
    this.remoteResults.set(this.remoteSearch() ? [] : null);
    this.remoteError.set(false);
    this.searchTerms.next('');
    this.activeIndex.set(0);
    this.inputElement()?.nativeElement.focus();
  }

  protected retryRemoteSearch(): void { this.searchTerms.next(this.query()); }
  protected onOptionHover(index: number): void { this.activeIndex.set(index); }
  protected isSelected(option: SearchableSelectOption): boolean { return this.currentValue() === option.value; }
  protected optionId(index: number): string { return `${this.listId()}-option-${index}`; }
  protected optionLabelParts(option: SearchableSelectOption): LabelPart[] {
    const query = this.query().trim();
    if (!query) return [{ text: option.label, match: false }];
    const index = option.label.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
    if (index < 0) return [{ text: option.label, match: false }];
    return [
      ...(index ? [{ text: option.label.slice(0, index), match: false }] : []),
      { text: option.label.slice(index, index + query.length), match: true },
      ...(index + query.length < option.label.length ? [{ text: option.label.slice(index + query.length), match: false }] : []),
    ];
  }
  protected onBlur(): void { this.markTouched(); }
  protected describedBy(): string | null {
    const ids = [this.hint() ? `${this.inputId()}-hint` : '', this.error() ? `${this.inputId()}-error` : ''].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  }

  private open(): void {
    if (this.isDisabled()) return;
    this.isOpen.set(true);
    this.query.set('');
    this.activeIndex.set(-1);
    this.remoteResults.set(this.remoteSearch() ? [] : null);
    this.remoteError.set(false);
    this.searchTerms.next('');
    this.positionPanel();
    this.inputElement()?.nativeElement.focus();
  }

  private close(touch: boolean): void {
    this.isOpen.set(false);
    this.query.set('');
    this.activeIndex.set(-1);
    this.remoteError.set(false);
    if (touch) this.markTouched();
  }

  private markTouched(): void { this.onTouched(); this.touched.emit(); }

  private moveActive(delta: number): void {
    const options = this.results();
    if (!options.length) return;
    const start = this.activeIndex() < 0 ? (delta > 0 ? -1 : 0) : this.activeIndex();
    const direction = delta > 0 ? 1 : -1;
    let index = start;
    for (let tries = 0; tries < options.length; tries++) {
      index = (index + direction + options.length) % options.length;
      if (!options[index].disabled) break;
    }
    this.activeIndex.set(index);
    const id = this.optionId(index);
    this.document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  }

  private ensureActiveIndex(): void {
    const options = this.results();
    if (!options.length) { this.activeIndex.set(-1); return; }
    const current = this.activeIndex();
    if (current < 0 || current >= options.length || options[current].disabled) {
      this.activeIndex.set(options.findIndex(option => !option.disabled));
    }
  }

  private positionPanel(): void {
    const control = this.host.nativeElement;
    const win = this.document.defaultView;
    if (!win) return;
    const rect = control.getBoundingClientRect();
    const margin = 8;
    const panelMaxHeight = 320;
    const below = win.innerHeight - rect.bottom;
    const above = rect.top;
    const openAbove = below < Math.min(panelMaxHeight, 220) && above > below;
    const width = Math.min(rect.width, win.innerWidth - margin * 2);
    const left = Math.max(margin, Math.min(rect.left, win.innerWidth - width - margin));
    const top = openAbove ? Math.max(margin, rect.top - panelMaxHeight - 4) : Math.min(win.innerHeight - margin, rect.bottom + 4);
    this.panelPosition.set({ top, left, width, above: openAbove });
  }

  private cacheSelected(options: readonly SearchableSelectOption[]): void {
    if (!options.length) return;
    this.selectedCache.update(current => {
      const next = new Map(current);
      for (const option of options) next.set(option.value, option);
      return next;
    });
  }

  private uniqueOptions(options: readonly SearchableSelectOption[]): readonly SearchableSelectOption[] {
    const seen = new Set<string>();
    return options.filter(option => {
      if (!option.value || seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
  }

  private normalise(value: string): string {
    return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  }
}
