import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { FormControlComponent, FormSelectOption } from './form-control.component';

@Component({
  imports: [ReactiveFormsModule, FormControlComponent],
  template: `
    <form [formGroup]="form">
      <app-form-input label="Age" controlId="age" type="number" [required]="true" formControlName="age" />
      <app-form-select label="Locality" controlId="locality" kind="select" [options]="localities" formControlName="locality" />
    </form>
  `,
})
class FormControlHostComponent {
  readonly form = new FormGroup({ age: new FormControl<number | null>(21), locality: new FormControl('chidambaram', { nonNullable: true }) });
  readonly localities: readonly FormSelectOption[] = [{ label: 'Chidambaram', value: 'chidambaram' }, { label: 'Parangipettai', value: 'parangipettai' }];
}

describe('shared form controls', () => {
  it('keeps label association and writes numeric input values to reactive forms as numbers', async () => {
    await TestBed.configureTestingModule({ imports: [FormControlHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(FormControlHostComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const input = host.querySelector<HTMLInputElement>('#age');
    expect(host.querySelector('label[for="age"]')?.textContent).toContain('Age');
    expect(input?.required).toBe(true);
    if (!input) throw new Error('Age input was not rendered');

    input.value = '42';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.form.controls.age.value).toBe(42);
  });

  it('uses the single-select autocomplete and writes the selected ID through ControlValueAccessor', async () => {
    await TestBed.configureTestingModule({ imports: [FormControlHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(FormControlHostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const input = host.querySelector<HTMLInputElement>('#locality');
    expect(input?.value).toBe('Chidambaram');
    if (!input) throw new Error('Locality autocomplete was not rendered');
    input.focus();
    input.value = 'Parang';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    host.querySelector<HTMLElement>('[role="option"]')?.click();
    expect(fixture.componentInstance.form.controls.locality.value).toBe('parangipettai');
  });
});
