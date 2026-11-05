import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-form-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<footer class="cdm-form-actions" [class.sticky]="sticky()"><div class="secondary-actions"><ng-content select="[formSecondaryAction]" /></div><div class="primary-actions"><ng-content select="[formPrimaryAction]" /></div></footer>`,
  styles: `
    :host { display:block; }
    .cdm-form-actions { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding-top:1.1rem; border-top:1px solid var(--cdm-form-border); }
    .secondary-actions,.primary-actions { display:flex; align-items:center; gap:.65rem; }
    .primary-actions { margin-left:auto; }
    @media(max-width:560px) { .cdm-form-actions { align-items:stretch; flex-direction:column-reverse; }.secondary-actions,.primary-actions { width:100%; }.primary-actions ::ng-deep > *, .secondary-actions ::ng-deep > * { flex:1 1 0; justify-content:center; } }
    @media(min-width:561px) { .cdm-form-actions.sticky { position:sticky; bottom:0; z-index:5; margin-inline:-1.25rem; padding:1rem 1.25rem; border-top:1px solid var(--cdm-border); background:#ffffffed; backdrop-filter:blur(8px); } }
  `,
})
export class FormActionsComponent { readonly sticky = input(false); }
