import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-form-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cdm-form-section" [attr.aria-labelledby]="titleId()">
      @if (title()) {
        <header class="cdm-form-section-header">
          @if (icon()) { <span class="cdm-form-section-icon" aria-hidden="true"><i [class]="icon()"></i></span> }
          <div><h2 [id]="titleId()">{{ title() }}</h2>@if (description()) { <p>{{ description() }}</p> }</div>
        </header>
      }
      <div class="cdm-form-section-content"><ng-content /></div>
    </section>
  `,
  styles: `
    :host { display:block; min-width:0; }
    .cdm-form-section { min-width:0; }
    .cdm-form-section-header { display:flex; align-items:flex-start; gap:.8rem; margin-bottom:1.1rem; }
    .cdm-form-section-icon { display:grid; place-items:center; flex:0 0 42px; width:42px; height:42px; border-radius:12px; color:var(--cdm-form-green); background:var(--cdm-green-soft); font-size:1.15rem; }
    h2 { margin:0; color:var(--cdm-form-primary); font-size:1.15rem; font-weight:760; line-height:1.3; }
    .cdm-form-section-header p { margin:.25rem 0 0; color:var(--cdm-form-muted); font-size:.86rem; line-height:1.55; }
    .cdm-form-section-content { min-width:0; }
  `,
})
export class FormSectionComponent {
  readonly title = input('');
  readonly titleId = input('form-section-title');
  readonly description = input('');
  readonly icon = input('');
}
