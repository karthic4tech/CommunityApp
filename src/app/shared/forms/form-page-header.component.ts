import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-form-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="cdm-form-page-header">
      <div class="cdm-form-page-copy">
        @if (eyebrow()) { <p class="cdm-form-eyebrow">{{ eyebrow() }}</p> }
        <h1 [id]="titleId()">{{ title() }}</h1>
        @if (description()) { <p class="cdm-form-page-description">{{ description() }}</p> }
      </div>
      <div class="cdm-form-page-actions"><ng-content select="[formPageActions]" /></div>
    </header>
  `,
  styles: `
    :host { display:block; }
    .cdm-form-page-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1.25rem; }
    .cdm-form-eyebrow { margin:0 0 .45rem; color:var(--cdm-form-green); font-size:.72rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
    h1 { margin:0; color:var(--cdm-form-primary); font-size:clamp(1.7rem,3.8vw,2.5rem); font-weight:800; letter-spacing:-.035em; line-height:1.15; }
    .cdm-form-page-description { max-width:52rem; margin:.55rem 0 0; color:var(--cdm-form-muted); line-height:1.65; }
    .cdm-form-page-actions { display:flex; flex:none; align-items:center; gap:.6rem; }
    @media(max-width:640px) { .cdm-form-page-header { flex-direction:column; }.cdm-form-page-actions { width:100%; }.cdm-form-page-actions ::ng-deep > * { width:100%; justify-content:center; } }
  `,
})
export class FormPageHeaderComponent {
  readonly title = input.required<string>();
  readonly titleId = input('form-page-title');
  readonly eyebrow = input('');
  readonly description = input('');
}
