import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JobService, PublishedJob } from '../core/services/job.service';
import { LanguageService } from '../core/services/language.service';
import { SeoService } from '../core/services/seo.service';
import { AnalyticsService } from '../core/services/analytics.service';

@Component({
  selector: 'app-jobs-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="jobs-page" aria-labelledby="jobs-title" [attr.aria-busy]="loading()">
      <div class="jobs-shell">
        <header class="jobs-heading">
          <div><p class="eyebrow">{{ i18n.language() === 'ta' ? 'உள்ளூர் வேலைவாய்ப்புகள்' : 'LOCAL OPPORTUNITIES' }}</p><h1 id="jobs-title">{{ i18n.language() === 'ta' ? 'சிதம்பரத்தில் வேலைகள்' : 'Jobs in Chidambaram' }}</h1><p>{{ i18n.language() === 'ta' ? 'உள்ளூர் வேலை வாய்ப்புகளைக் கண்டறியுங்கள்.' : 'Find opportunities shared with the local community.' }}</p></div>
          <a class="post-job" routerLink="/jobs/submit"><i class="bi bi-plus-circle" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'வேலையைப் பதிவு செய்க' : 'Post a job' }}</a>
        </header>

        @if (loading()) {
          <p class="jobs-state" role="status">{{ i18n.language() === 'ta' ? 'வேலைகள் ஏற்றப்படுகின்றன…' : 'Loading jobs…' }}</p>
        } @else if (error(); as message) {
          <p class="jobs-state jobs-error" role="alert">{{ message }}</p>
        } @else if (jobs().length) {
          <section class="jobs-list" aria-label="{{ i18n.language() === 'ta' ? 'வேலை வாய்ப்புகள்' : 'Job opportunities' }}">
            @for (job of jobs(); track job.id) {
              <article class="job-card">
                <div class="job-card-heading"><div><h2>{{ job.title }}</h2><p class="company">{{ job.company_name }}</p></div><span class="job-category">{{ i18n.language() === 'ta' ? job.job_categories.name_ta : job.job_categories.name_en }}</span></div>
                <p class="job-location"><i class="bi bi-geo-alt" aria-hidden="true"></i>{{ job.location }}</p>
                <p class="job-description">{{ job.description }}</p>
                <div class="job-contacts">
                  @if (job.contact_phone) { <a [href]="'tel:' + job.contact_phone" (click)="analytics.track('job_contact_click', { public_job_id: job.id, contact_method: 'phone', content_language: i18n.language() })"><i class="bi bi-telephone" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'தொலைபேசியில் தொடர்புகொள்ள' : 'Call employer' }}</a> }
                  @if (job.contact_email) { <a [href]="'mailto:' + job.contact_email" (click)="analytics.track('job_contact_click', { public_job_id: job.id, contact_method: 'email', content_language: i18n.language() })"><i class="bi bi-envelope" aria-hidden="true"></i>{{ i18n.language() === 'ta' ? 'மின்னஞ்சல் அனுப்புக' : 'Email employer' }}</a> }
                </div>
              </article>
            }
          </section>
        } @else {
          <section class="jobs-state jobs-empty" role="status"><i class="bi bi-briefcase" aria-hidden="true"></i><h2>{{ i18n.language() === 'ta' ? 'தற்போது வேலைகள் இல்லை' : 'No published jobs yet' }}</h2><p>{{ i18n.language() === 'ta' ? 'புதிய வேலை வாய்ப்புகள் வெளியிடப்பட்டதும் இங்கே தோன்றும்.' : 'New opportunities will appear here after review.' }}</p><a routerLink="/jobs/submit">{{ i18n.language() === 'ta' ? 'வேலை வாய்ப்பைப் பகிருங்கள்' : 'Share a job opening' }}</a></section>
        }
      </div>
    </main>
  `,
  styles: `
    :host { display:block; min-width:0; color:var(--cdm-navy); background:var(--cdm-page); }
    * { box-sizing:border-box; }
    .jobs-page { width:100%; min-height:55vh; padding:clamp(1rem,3vw,2rem) max(.9rem,calc((100vw - var(--cdm-content-width))/2)) 3rem; }
    .jobs-shell { width:min(100%,var(--cdm-content-width)); margin:0 auto; }
    .jobs-heading { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1rem; padding:clamp(1.1rem,3vw,1.8rem); border:1px solid var(--cdm-border); border-radius:16px; background:#fff; }
    .eyebrow { margin:0 0 .35rem; color:var(--cdm-royal-blue); font-size:.72rem; font-weight:800; letter-spacing:.12em; }
    h1 { margin:0; font-size:clamp(1.65rem,4vw,2.35rem); font-weight:760; }
    .jobs-heading p:last-child { margin:.4rem 0 0; color:var(--cdm-muted); }
    .post-job,.job-contacts a,.jobs-empty a { display:inline-flex; align-items:center; justify-content:center; gap:.45rem; min-height:42px; padding:.55rem .8rem; border:1px solid var(--cdm-btn-primary); border-radius:9px; color:#fff; background:var(--cdm-btn-primary); font-size:.82rem; font-weight:750; text-decoration:none; }
    .jobs-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.8rem; }
    .job-card,.jobs-state { min-width:0; padding:1rem; border:1px solid var(--cdm-border); border-radius:13px; background:#fff; }
    .job-card-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:.65rem; }
    .job-card h2,.jobs-empty h2 { margin:0; color:var(--cdm-navy); font-size:1.05rem; }
    .company { margin:.25rem 0 0; color:var(--cdm-muted); font-size:.86rem; font-weight:650; }
    .job-category { flex:none; padding:.25rem .5rem; border:1px solid var(--cdm-border); border-radius:999px; color:var(--cdm-royal-blue); background:var(--cdm-page); font-size:.7rem; }
    .job-location { display:flex; align-items:center; gap:.35rem; margin:.7rem 0; color:var(--cdm-muted); font-size:.82rem; }
    .job-description { display:-webkit-box; overflow:hidden; margin:0; color:#53667d; line-height:1.55; -webkit-box-orient:vertical; -webkit-line-clamp:4; white-space:pre-line; }
    .job-contacts { display:flex; flex-wrap:wrap; gap:.5rem; margin-top:.85rem; }
    .job-contacts a { min-height:38px; font-size:.75rem; }
    .jobs-state { color:var(--cdm-muted); }
    .jobs-error { color:#a5261f; }
    .jobs-empty { display:grid; justify-items:start; gap:.5rem; padding:1.4rem; }
    .jobs-empty > i { color:var(--cdm-royal-blue); font-size:1.3rem; }
    .jobs-empty p { margin:0; }
    :is(a,button):focus-visible { outline:3px solid color-mix(in srgb,var(--cdm-btn-primary) 35%,transparent); outline-offset:3px; }
    @media(max-width:680px) { .jobs-page { padding:1rem .75rem 2rem; }.jobs-heading { align-items:stretch; flex-direction:column; }.post-job { width:100%; }.jobs-list { grid-template-columns:1fr; } }
  `,
})
export class JobsPageComponent implements OnInit {
  protected readonly i18n = inject(LanguageService);
  protected readonly analytics = inject(AnalyticsService);
  private readonly jobService = inject(JobService);
  private readonly seo = inject(SeoService);
  protected readonly jobs = signal<readonly PublishedJob[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const language = this.i18n.language();
      const tamil = language === 'ta';
      this.seo.update({
        title: tamil ? 'சிதம்பரத்தில் வேலைவாய்ப்புகள் | நம் சிதம்பரம்' : 'Jobs in Chidambaram | CDM 360',
        description: tamil
          ? 'சிதம்பரம் சமூகத்திற்காக வெளியிடப்பட்ட உள்ளூர் வேலைவாய்ப்புகளைப் பாருங்கள்.'
          : 'Browse job opportunities shared with the Chidambaram community.',
        path: '/jobs',
        language,
      });
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      const publishedJobs = await this.jobService.publishedJobs();
      this.jobs.set(publishedJobs);
      for (const job of publishedJobs) {
        this.analytics.trackOnce('job_listing_view', job.id, {
          public_job_id: job.id,
          content_language: this.i18n.language(),
        });
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load jobs.');
    } finally {
      this.loading.set(false);
    }
  }
}
