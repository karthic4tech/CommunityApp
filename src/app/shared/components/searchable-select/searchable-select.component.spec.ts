import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SearchableSelectComponent } from './searchable-select.component';
import { SearchableSelectOption } from './searchable-select.models';

@Component({
  imports: [ReactiveFormsModule, SearchableSelectComponent],
  template: `
    <form [formGroup]="form">
      <app-searchable-select label="Category" controlId="category" formControlName="category" [options]="options" [required]="true" />
    </form>
  `,
})
class SearchableSelectHostComponent {
  readonly options: readonly SearchableSelectOption[] = [
    { value:'home', label:'Home Services — வீட்டு சேவைகள்', searchText:'home services வீட்டு சேவைகள் home-services' },
    { value:'medical', label:'Medical & Emergency — மருத்துவம்', searchText:'medical emergency மருத்துவம் medical-emergency' },
    { value:'food', label:'Food & Restaurant — உணவு', searchText:'food restaurant உணவு food-service' },
  ];
  readonly form = new FormGroup({
    category: new FormControl('', { nonNullable:true }),
  });
}

describe('SearchableSelectComponent', () => {
  async function createHost() {
    await TestBed.configureTestingModule({ imports:[SearchableSelectHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SearchableSelectHostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('searches Tamil and English and writes the selected ID to the reactive form', async () => {
    const fixture = await createHost();
    const host = fixture.nativeElement as HTMLElement;
    const input = host.querySelector<HTMLInputElement>('#category')!;
    input.focus();
    fixture.detectChanges();
    input.value = 'மருத்துவம்';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(host.querySelector('[role="option"]')?.textContent).toContain('Medical & Emergency');

    host.querySelector<HTMLElement>('[role="option"]')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.category.value).toBe('medical');
    expect(input.value).toContain('Medical & Emergency');
  });

  it('supports arrow/enter keyboard selection and clear selection', async () => {
    const fixture = await createHost();
    const host = fixture.nativeElement as HTMLElement;
    const input = host.querySelector<HTMLInputElement>('#category')!;
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
    fixture.detectChanges();
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.category.value).toBe('home');
    expect(input.value).toContain('Home Services');
    host.querySelector<HTMLButtonElement>('.clear-selection')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.category.value).toBe('');
  });

  it('closes on Escape and marks the input disabled through the ControlValueAccessor', async () => {
    const fixture = await createHost();
    const host = fixture.nativeElement as HTMLElement;
    const input = host.querySelector<HTMLInputElement>('#category')!;
    input.focus();
    fixture.detectChanges();
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    fixture.detectChanges();
    expect(host.querySelector('[role="listbox"]')).toBeNull();

    fixture.componentInstance.form.controls.category.disable();
    fixture.detectChanges();
    expect(input.disabled).toBe(true);
  });

  it('debounces remote search and waits for the configured minimum query length', async () => {
    const remoteSearch = vi.fn(async (query: string) => query === 'med'
      ? [{value:'medical',label:'Medical — மருத்துவம்',searchText:'medical மருத்துவம்'}]
      : []);
    await TestBed.configureTestingModule({ imports:[SearchableSelectComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    fixture.componentRef.setInput('label','Remote category');
    fixture.componentRef.setInput('controlId','remote-category');
    fixture.componentRef.setInput('remoteSearch',remoteSearch);
    fixture.componentRef.setInput('minSearchLength',2);
    fixture.componentRef.setInput('debounceMs',0);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const input = host.querySelector<HTMLInputElement>('#remote-category')!;
    input.focus();
    input.value = 'm';
    input.dispatchEvent(new Event('input'));
    await new Promise<void>(resolve => setTimeout(resolve, 5));
    fixture.detectChanges();
    expect(remoteSearch).not.toHaveBeenCalled();

    input.value = 'med';
    input.dispatchEvent(new Event('input'));
    await new Promise<void>(resolve => setTimeout(resolve, 5));
    fixture.detectChanges();
    expect(remoteSearch).toHaveBeenCalledWith('med');
    expect(host.querySelector('[role="option"]')?.textContent).toContain('Medical');
  });

  it('ignores stale remote results after a newer search supersedes the request', async () => {
    let resolveOld!: (options: readonly SearchableSelectOption[]) => void;
    const oldRequest = new Promise<readonly SearchableSelectOption[]>(resolve => { resolveOld = resolve; });
    const remoteSearch = vi.fn((query: string): Promise<readonly SearchableSelectOption[]> => query === 'ho'
      ? oldRequest
      : Promise.resolve([{value:'medical',label:'Medical — மருத்துவம்',searchText:'medical மருத்துவம்'}]));
    await TestBed.configureTestingModule({ imports:[SearchableSelectComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    fixture.componentRef.setInput('label','Remote category');
    fixture.componentRef.setInput('controlId','remote-race');
    fixture.componentRef.setInput('remoteSearch',remoteSearch);
    fixture.componentRef.setInput('minSearchLength',2);
    fixture.componentRef.setInput('debounceMs',0);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const input = host.querySelector<HTMLInputElement>('#remote-race')!;
    input.focus();

    input.value = 'ho';
    input.dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(remoteSearch).toHaveBeenCalledWith('ho'));
    input.value = 'medical';
    input.dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(host.querySelector('[role="option"]')?.textContent).toContain('Medical'));
    resolveOld([{value:'home',label:'Home Services',searchText:'home'}]);
    await Promise.resolve();
    fixture.detectChanges();
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(host.querySelector('[role="option"]')?.textContent).toContain('Medical');
  });
});
