import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/services/language.service';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="admin-page container-xl" aria-labelledby="admin-title">
      <header class="admin-header">
        <div>
          <p class="eyebrow">{{ i18n.language() === 'ta' ? 'நிர்வாகம்' : 'ADMINISTRATION' }}</p>
          <h1 id="admin-title">{{ i18n.language() === 'ta' ? 'நிர்வாக பலகை' : 'Admin dashboard' }}</h1>
          <p class="intro">{{ i18n.language() === 'ta' ? 'CDM360 சேவை அடைவைக் கண்காணிக்கவும்.' : 'Manage the CDM360 service directory.' }}</p>
        </div>
        <button type="button" class="btn btn-primary sign-out" (click)="signOut()">{{ i18n.language() === 'ta' ? 'வெளியேறு' : 'Sign out' }}</button>
      </header>

      <div class="admin-grid row g-3">
        <article class="card col-12 col-md-6">
          <h2>{{ i18n.language() === 'ta' ? 'உங்கள் அணுகல்' : 'Your access' }}</h2>
          <p>{{ auth.user()?.email }}</p>
          <p class="verified"><i class="bi bi-patch-check-fill" aria-hidden="true"></i> {{ i18n.language() === 'ta' ? 'நிர்வாகி சரிபார்க்கப்பட்டது' : 'Administrator verified' }}</p>
          <ul>
            @for (role of auth.roles(); track role) { <li>{{ role }}</li> }
          </ul>
        </article>
        <article class="card col-12 col-md-6">
          <h2>{{ i18n.language() === 'ta' ? 'சேவை அடைவு' : 'Service directory' }}</h2>
          <p>{{ i18n.language() === 'ta' ? 'வழங்குநர்கள், சேவைகள் மற்றும் வகைகளை நிர்வகிக்கும் கருவிகள் இங்கே சேர்க்கப்படும்.' : 'Directory management tools for providers, listings and categories can be added here.' }}</p>
          <a routerLink="/services">{{ i18n.language() === 'ta' ? 'பொது அடைவைக் காண்க' : 'View public directory' }}</a>
        </article>
        <article class="card col-12 col-md-6">
          <h2>{{ i18n.language() === 'ta' ? 'வகை நிர்வாகம்' : 'Category management' }}</h2>
          <p>{{ i18n.language() === 'ta' ? 'சேவை வகைகள் மற்றும் உட்பிரிவுகளை உருவாக்கி, திருத்தி, செயல்படுத்தவும்.' : 'Create, edit, activate and deactivate service categories and subcategories.' }}</p>
          <a routerLink="/admin/categories">{{ i18n.language() === 'ta' ? 'வகைகளை நிர்வகிக்கவும்' : 'Manage categories' }}</a>
        </article>
        <article class="card col-12 col-md-6">
          <h2>{{ i18n.language() === 'ta' ? 'படங்கள்' : 'Media management' }}</h2>
          <p>{{ i18n.language() === 'ta' ? 'பதிவேற்றப்பட்ட படங்கள், புள்ளியியல் மற்றும் சேமிப்பக பராமரிப்பை நிர்வகிக்கவும்.' : 'Review upload stats, preview files and remove media.' }}</p>
          <a routerLink="/admin/media">{{ i18n.language() === 'ta' ? 'பட நிர்வாகம்' : 'Open media management' }}</a>
        </article>
        <article class="card col-12 col-md-6">
          <h2>{{ i18n.language() === 'ta' ? 'அத்தியாவசிய சேவைகள்' : 'Essential Services Management' }}</h2>
          <p>{{ i18n.language() === 'ta' ? 'அத்தியாவசிய வகைகள், முகப்புப் பக்கக் குறுக்குவழிகள் மற்றும் வரிசையை நிர்வகிக்கவும்.' : 'Curate priority categories, emergency flags and homepage shortcuts.' }}</p>
          <a routerLink="/admin/essential-services">{{ i18n.language() === 'ta' ? 'அத்தியாவசிய சேவைகளை நிர்வகி' : 'Manage Essential Services' }}</a>
        </article>
        <article class="card col-12 col-md-6">
          <h2>Marketplace</h2>
          <p>Moderate product advertisements and reports, and manage the local marketplace catalogue.</p>
          <a routerLink="/admin/marketplace">Manage marketplace</a>
        </article>
        <article class="card col-12 col-md-6">
          <h2>Marketplace moderation</h2>
          <p>Review local product listings and reports, and manage marketplace categories and settings.</p>
          <a routerLink="/admin/marketplace">Open marketplace administration</a>
        </article>
        <article class="card col-12 col-md-6">
          <h2>{{ i18n.language() === 'ta' ? 'உள்ளூர் பிராண்டுகள்' : 'Local brands' }}</h2>
          <p>{{ i18n.language() === 'ta' ? 'முகப்புப் பக்கத்தில் இடம்பெறும் சரிபார்க்கப்பட்ட வணிகங்களையும் அவற்றின் வரிசையையும் நிர்வகிக்கவும்.' : 'Feature verified businesses on the homepage and set their display order.' }}</p>
          <a routerLink="/admin/local-brands">{{ i18n.language() === 'ta' ? 'பிராண்டுகளை நிர்வகி' : 'Manage local brands' }}</a>
        </article>
        <article class="card col-12 col-md-6">
          <h2>{{ i18n.language() === 'ta' ? 'சமர்ப்பிப்பு மதிப்பாய்வு' : 'Listing review' }}</h2>
          <p>{{ i18n.language() === 'ta' ? 'சமூக சேவை சமர்ப்பிப்புகளை சரிபார்த்து வெளியிடவும்.' : 'Review, request changes, reject and publish community service submissions.' }}</p>
          <a routerLink="/admin/listings/review">{{ i18n.language() === 'ta' ? 'மதிப்பாய்வு வரிசையைத் திறக்கவும்' : 'Open review queue' }}</a>
        </article>
      </div>
    </section>
  `,
  styles: `
    :host { display:block; padding-block:2rem; }
     .admin-page { width:100%; max-width:var(--cdm-content-width); margin:0 auto; }
     .admin-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding:clamp(1.5rem,4vw,2.5rem); border-radius:var(--cdm-radius-xl); background:var(--cdm-green-soft); border:1px solid var(--cdm-border); }
    .eyebrow { margin:0 0 .35rem; color:var(--cdm-muted); font-size:.72rem; font-weight:800; letter-spacing:.12em; }
     h1 { margin:0; color:var(--cdm-navy-deep); font-size:clamp(1.7rem,4vw,2.5rem); }
     h2 { color:var(--cdm-navy-deep); font-size:1.1rem; }
    .intro, .card p { color:var(--cdm-muted); line-height:1.8; }
     .sign-out { flex:none; }
     .admin-grid { align-items:stretch; }
     .card { padding:1.25rem; border:1px solid var(--cdm-border); border-radius:var(--cdm-radius-lg); background:white; }
    .card a { display:inline-flex; align-items:center; min-height:44px; color:var(--cdm-royal-blue); }
    .verified { color:var(--cdm-royal-blue) !important; font-weight:700; }
    ul { padding-left:1.25rem; color:var(--cdm-muted); line-height:1.8; }
    :is(a,button):focus-visible { outline:3px solid var(--cdm-royal-blue); outline-offset:3px; }
     @media (max-width:650px) { .admin-header { flex-direction:column; } }
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
