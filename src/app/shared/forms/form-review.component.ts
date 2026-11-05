import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface FormReviewRow { label: string; value: string; }

@Component({
  selector: 'app-form-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dl class="cdm-form-review">@for (row of rows(); track row.label) { <div><dt>{{ row.label }}</dt><dd>{{ row.value || emptyLabel() }}</dd></div> }</dl>`,
  styles: `
    :host { display:block; }
    .cdm-form-review { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.2rem 1.25rem; margin:0; }
    .cdm-form-review div { display:grid; grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr); gap:.75rem; padding:.7rem 0; border-bottom:1px solid var(--cdm-border); }
    dt { color:var(--cdm-form-muted); font-size:.82rem; font-weight:500; }
    dd { margin:0; overflow-wrap:anywhere; color:var(--cdm-form-text); font-size:.84rem; font-weight:680; }
    @media(max-width:640px) { .cdm-form-review { grid-template-columns:1fr; } }
  `,
})
export class FormReviewComponent {
  readonly rows = input.required<readonly FormReviewRow[]>();
  readonly emptyLabel = input('Not provided');
}
