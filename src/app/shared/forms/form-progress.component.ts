import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-form-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="cdm-form-progress" aria-label="Form progress"><ol [style.--step-count]="steps().length">
      @for (step of steps(); track $index; let i = $index) {
        <li [class.current]="currentStep() === i + 1" [class.complete]="currentStep() > i + 1">
          <button class="cdm-step-button" type="button" [disabled]="!allowForward() && i + 1 >= currentStep()" [attr.aria-current]="currentStep() === i + 1 ? 'step' : null" (click)="stepSelected.emit(i + 1)"><span class="step-number">@if (currentStep() > i + 1) { <i class="bi bi-check2" aria-hidden="true"></i> } @else { {{ i + 1 }} }</span><span class="step-label">{{ step }}</span></button>
        </li>
      }
    </ol></nav>
  `,
  styles: `
    :host { display:block; min-width:0; }
    ol { display:grid; grid-template-columns:repeat(var(--step-count),minmax(0,1fr)); gap:.65rem; margin:0; padding:0; list-style:none; }
    li { position:relative; min-width:0; }
    .cdm-step-button { position:relative; display:flex; align-items:center; justify-content:flex-start; gap:.65rem; width:100%; min-height:54px; padding:.55rem .8rem; border:1px solid var(--cdm-form-border); border-radius:11px; color:var(--cdm-navy); background:#fff; font:inherit; text-align:left; transition:border-color .15s,background-color .15s,box-shadow .15s; }
    .cdm-step-button:disabled { cursor:default; opacity:1; }
    .step-number { display:grid; place-items:center; flex:0 0 30px; width:30px; height:30px; border:1px solid var(--cdm-border); border-radius:50%; color:var(--cdm-muted); background:#fff; font-size:.78rem; font-weight:800; }
    li.current .cdm-step-button { border-color:var(--cdm-form-green); color:var(--cdm-form-primary); background:var(--cdm-page); box-shadow:0 0 0 2px color-mix(in srgb, var(--cdm-btn-primary) 7%, transparent); }
    li.complete .cdm-step-button { border-color:var(--cdm-border); color:var(--cdm-form-green); background:var(--cdm-page); }
    li.current .step-number,li.complete .step-number { border-color:var(--cdm-form-green); color:#fff; background:var(--cdm-form-green); }
    li.current .step-label,li.complete .step-label { color:var(--cdm-form-green); font-weight:740; }
    .step-label { max-width:100%; overflow-wrap:anywhere; font-size:.83rem; font-weight:630; }
    .cdm-step-button:not(:disabled):hover { border-color:var(--cdm-border); background:var(--cdm-page); }
    .cdm-step-button:focus-visible { outline:3px solid color-mix(in srgb, var(--cdm-btn-primary) 40%, transparent); outline-offset:3px; }
    @media(max-width:640px) { ol { grid-template-columns:repeat(2,minmax(0,1fr)); gap:.5rem; } .cdm-step-button { min-height:48px; padding:.45rem .6rem; } .step-label { font-size:.76rem; } }
    @media(max-width:360px) { .cdm-step-button { gap:.45rem; padding:.4rem; }.step-label { font-size:.7rem; } }
  `,
})
export class FormProgressComponent {
  readonly steps = input.required<readonly string[]>();
  readonly currentStep = input.required<number>();
  readonly allowForward = input(false);
  readonly stepSelected = output<number>();
}
