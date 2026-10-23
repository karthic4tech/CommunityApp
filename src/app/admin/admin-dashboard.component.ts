import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/services/language.service';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="admin-page" aria-labelledby="admin-title">
      <header class="admin-header">
        <div>
          <p class="eyebrow">{{ i18n.language() === 'ta' ? 'நிர்வாகம்' : 'ADMINISTRATION' }}</p>
          <h1 id="admin-title">{{ i18n.language() === 'ta' ? 'நிர்வாக பலகை' : 'Admin dashboard' }}</h1>
          <p class="intro">{{ i18n.language() === 'ta' ? 'நம் சிதம்பரம் சேவை அடைவைக் கண்காணிக்கவும்.' : 'Manage the Nam Chidambaram service directory.' }}</p>
        </div>
        <button type="button" class="sign-out" (click)="signOut()">{{ i18n.language() === 'ta' ? 'வெளியேறு' : 'Sign out' }}</button>
      </header>

      <div class="admin-grid">
        <article class="card">
          <h2>{{ i18n.language() === 'ta' ? 'உங்கள் அணுகல்' : 'Your access' }}</h2>
          <p>{{ auth.user()?.email }}</p>
          <p class="verified"><i class="bi bi-patch-check-fill" aria-hidden="true"></i> {{ i18n.language() === 'ta' ? 'நிர்வாகி சரிபார்க்கப்பட்டது' : 'Administrator verified' }}</p>
          <ul>
            @for (role of auth.roles(); track role) { <li>{{ role }}</li> }
          </ul>
        </article>
        <article class="card">
          <h2>{{ i18n.language() === 'ta' ? 'சேவை அடைவு' : 'Service directory' }}</h2>
          <p>{{ i18n.language() === 'ta' ? 'வழங்குநர்கள், சேவைகள் மற்றும் வகைகளை நிர்வகிக்கும் கருவிகள் இங்கே சேர்க்கப்படும்.' : 'Directory management tools for providers, listings and categories can be added here.' }}</p>
          <a routerLink="/services">{{ i18n.language() === 'ta' ? 'பொது அடைவைக் காண்க' : 'View public directory' }}</a>
        </article>
        <article class="card">
          <h2>{{ i18n.language() === 'ta' ? 'வகை நிர்வாகம்' : 'Category management' }}</h2>
          <p>{{ i18n.language() === 'ta' ? 'சேவை வகைகள் மற்றும் உட்பிரிவுகளை உருவாக்கி, திருத்தி, செயல்படுத்தவும்.' : 'Create, edit, activate and deactivate service categories and subcategories.' }}</p>
          <a routerLink="/admin/categories">{{ i18n.language() === 'ta' ? 'வகைகளை நிர்வகிக்கவும்' : 'Manage categories' }}</a>
        </article>
        <article class="card">
          <h2>{{ i18n.language() === 'ta' ? 'சமர்ப்பிப்பு மதிப்பாய்வு' : 'Listing review' }}</h2>
          <p>{{ i18n.language() === 'ta' ? 'சமூக சேவை சமர்ப்பிப்புகளை சரிபார்த்து வெளியிடவும்.' : 'Review, request changes, reject and publish community service submissions.' }}</p>
          <a routerLink="/admin/listings/review">{{ i18n.language() === 'ta' ? 'மதிப்பாய்வு வரிசையைத் திறக்கவும்' : 'Open review queue' }}</a>
        </article>
      </div>
    </section>
  `,
  styles: `
    :host { display:block; padding-block:2rem; }
    .admin-page { display:grid; gap:1.5rem; }
    .admin-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding:clamp(1.5rem,4vw,2.5rem); border-radius:20px; background:linear-gradient(120deg,#eff7ee,#f8f8ed); border:1px solid #dfeade; }
    .eyebrow { margin:0 0 .35rem; color:#52665b; font-size:.72rem; font-weight:800; letter-spacing:.12em; }
    h1 { margin:0; color:#173f32; font-size:clamp(1.7rem,4vw,2.5rem); }
    h2 { color:#173f32; font-size:1.1rem; }
    .intro, .card p { color:#52665b; line-height:1.8; }
    .sign-out { min-height:44px; border:1px solid #075541; border-radius:9px; padding:.7rem 1rem; background:#075541; color:white; font:inherit; font-weight:700; cursor:pointer; }
    .admin-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1rem; }
    .card { padding:1.25rem; border:1px solid #dfe7e2; border-radius:16px; background:white; }
    .card a { display:inline-flex; align-items:center; min-height:44px; color:#075541; }
    .verified { color:#176044 !important; font-weight:700; }
    ul { padding-left:1.25rem; color:#52665b; line-height:1.8; }
    :is(a,button):focus-visible { outline:3px solid #17583f; outline-offset:3px; }
    @media (max-width:650px) { .admin-header { flex-direction:column; } .admin-grid { grid-template-columns:1fr; } }
  `,
})
export class AdminDashboardComponent {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/admin/login');
  }
}
