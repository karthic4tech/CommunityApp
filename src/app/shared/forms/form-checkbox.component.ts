import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-form-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => FormCheckboxComponent), multi: true }],
  template: `<label class="cdm-form-checkbox" [for]="controlId()"><input type="checkbox" [id]="controlId()" [checked]="checked()" [disabled]="disabled()" [required]="required()" [attr.aria-describedby]="hint() ? controlId() + '-hint' : null" (change)="change($event)" (blur)="touched()"><span class="box" aria-hidden="true"><i class="bi bi-check2"></i></span><span class="copy">{{ label() }}@if (required()) { <b aria-hidden="true">*</b> }@if (hint()) { <small [id]="controlId() + '-hint'">{{ hint() }}</small> }</span></label>`,
  styles: `
    :host { display:block; }
    .cdm-form-checkbox { display:flex; align-items:flex-start; gap:.65rem; color:var(--cdm-form-text); cursor:pointer; }
    input { position:absolute; width:1px;height:1px; opacity:0; }
    .box { display:grid; place-items:center; flex:none; width:21px;height:21px;border:1px solid var(--cdm-border);border-radius:5px;color:transparent;background:white; }
    .copy { display:grid; gap:.2rem; padding-top:.05rem; font-size:.86rem; font-weight:550; line-height:1.5; }.copy b { color:#C92A2A; }.copy small { color:var(--cdm-form-muted); font-size:.75rem; font-weight:400; }
    input:checked + .box { border-color:var(--cdm-form-green); color:#fff; background:var(--cdm-form-green); }
    input:focus-visible + .box { outline:3px solid color-mix(in srgb, var(--cdm-green) 25%, transparent); outline-offset:2px; }
    input:disabled + .box { background:var(--cdm-page); }
  `,
})
export class FormCheckboxComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly controlId = input.required<string>();
  readonly hint = input('');
  readonly required = input(false);
  protected readonly checked = signal(false);
  protected readonly disabled = signal(false);
  private onChange: (value: boolean) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  writeValue(value: unknown): void { this.checked.set(value === true); }
  registerOnChange(fn: (value: boolean) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled.set(disabled); }
  protected change(event: Event): void { const value = (event.currentTarget as HTMLInputElement).checked; this.checked.set(value); this.onChange(value); }
  protected touched(): void { this.onTouched(); }
}
