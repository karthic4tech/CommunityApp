# CDM 360 shared form design system

## Shared tokens and controls

Design tokens live in `src/styles/_variables.scss`; shared responsive control and legacy form foundations are in `src/styles/_forms.scss`. Standalone primitives are exported by `src/app/shared/forms/index.ts`:

- `app-form-page-header` and `app-form-section` for page and section hierarchy.
- `app-form-field` for wrapping an existing native or Bootstrap form control.
- `app-form-input`, `app-form-textarea`, `app-form-select`, and `app-form-date-picker` use `FormControlComponent`, a `ControlValueAccessor` for typed reactive forms. Set `kind="textarea"`, `kind="select"`, or `kind="date"` when needed; numeric inputs emit numbers.
- `app-form-checkbox` and `app-form-radio-group` for accessible reactive choice controls.
- `app-form-file-upload` wraps the existing secure `app-media-upload` implementation; it does not create a second Supabase client or weaken storage policies.
- `app-form-progress`, `app-form-actions`, `app-form-feedback`, and `app-form-review` for wizard progress, action layout, status messaging and review summaries.

Example:

```html
<form class="cdm-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
  <app-form-input label="Email" controlId="profile-email" type="email"
    autocomplete="email" [required]="true" formControlName="email" />
</form>
```

Use the shared `cdm-form` class for native/Bootstrap controls while gradually migrating existing pages. Keep the existing typed form models, validators, service calls, and authorization rules; the shared controls are presentational/CVA adapters only.

## Current rollout

- `/my-submissions` has a centered responsive content width, responsive listing cards, status and feedback states, and a shared page header.
- Authentication sign-in/sign-up use shared input CVAs; verification, recovery, password reset and administrator sign-in use shared field labels and validation styling.
- Profile editing uses shared form tokens and the shared upload wrapper. Service and marketplace listing wizards use the shared control styling and marketplace uses shared wizard progress. Admin category and marketplace administration use the shared styles and reusable section/action components.
- Existing Bootstrap search/filter forms retain their route-specific layout and query behavior; their current styling is intentionally not forced into the onboarding form grid.

The home-page contact blocks currently prevent default submission and do not call a contact backend; this work only aligns their presentation, and does not claim that they deliver messages. Business/event/job forms are not currently present as separate data-entry workflows in this checkout.
