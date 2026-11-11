import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContactRequest } from '../core/models/contact-request';
import { ContactRequestService } from '../core/services/contact-request.service';

@Component({
  selector: 'app-admin-contact-requests',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="requests-page container-xl" aria-labelledby="requests-title" [attr.aria-busy]="loading() || deletingId() !== null">
      <header class="page-header">
        <div>
          <a class="back-link" routerLink="/admin"><i class="bi bi-arrow-left" aria-hidden="true"></i> Admin dashboard</a>
          <p class="eyebrow">CONTACT MANAGEMENT</p>
          <h1 id="requests-title">Contact requests</h1>
          <p>Review messages submitted through the public Contact Us form.</p>
        </div>
        <button type="button" class="btn btn-outline-primary" (click)="load()" [disabled]="loading()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Refresh</button>
      </header>

      @if (error()) { <p class="alert alert-danger" role="alert">{{ error() }}</p> }
      @if (loading()) { <p class="state" role="status">Loading contact requests…</p> }
      @else if (!requests().length) { <p class="empty state" role="status">No contact requests have been received yet.</p> }
      @else {
        <div class="table-wrap">
          <table class="table align-middle mb-0">
            <caption class="visually-hidden">Contact requests submitted by website visitors</caption>
            <thead><tr><th scope="col">Received</th><th scope="col">Visitor</th><th scope="col">Contact</th><th scope="col">Message</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              @for (request of requests(); track request.id) {
                <tr>
                  <td class="date">{{ request.created_at | date:'medium' }}</td>
                  <th scope="row"><strong>{{ request.name }}</strong><span class="status">{{ request.status }}</span></th>
                  <td><a [href]="'mailto:' + request.email">{{ request.email }}</a><a [href]="'tel:' + request.mobile">{{ request.mobile }}</a></td>
                  <td class="message">{{ request.message }}</td>
                  <td><button type="button" class="btn btn-sm btn-outline-danger" [disabled]="deletingId() === request.id" (click)="deleteRequest(request)">{{ deletingId() === request.id ? 'Deleting…' : 'Delete' }}</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    :host { display:block; padding-block:1.25rem 3rem; background:var(--cdm-page); }
    .requests-page { display:grid; gap:1rem; max-width:var(--cdm-content-width); }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding:clamp(1.25rem,3vw,2rem); border:1px solid var(--cdm-border); border-radius:17px; background:linear-gradient(120deg,var(--cdm-blue-soft),var(--cdm-page)); }
    .back-link { display:inline-flex; align-items:center; gap:.35rem; min-height:40px; margin-bottom:.5rem; color:var(--cdm-royal-blue); text-decoration:none; }.eyebrow { margin:0 0 .35rem; color:var(--cdm-royal-blue); font-size:.7rem; font-weight:800; letter-spacing:.12em; } h1 { margin:0; color:var(--cdm-navy); font-size:clamp(1.65rem,3.8vw,2.4rem); } .page-header p:not(.eyebrow) { margin:.5rem 0 0; color:var(--cdm-muted); line-height:1.6; }
    .table-wrap { overflow-x:auto; border:1px solid var(--cdm-border); border-radius:15px; background:#fff; } table { min-width:850px; } th,td { padding:.85rem .75rem; border-color:var(--cdm-border); vertical-align:top; } thead th { color:var(--cdm-muted); background:var(--cdm-blue-soft); font-size:.78rem; white-space:nowrap; } tbody th { min-width:130px; color:var(--cdm-navy); } td a { display:block; color:var(--cdm-royal-blue); text-decoration:none; } .date { min-width:150px; color:var(--cdm-muted); font-size:.82rem; } .message { min-width:260px; max-width:420px; white-space:pre-wrap; word-break:break-word; color:var(--cdm-muted); line-height:1.55; } .status { display:block; width:max-content; margin-top:.35rem; padding:.2rem .45rem; border-radius:999px; color:var(--cdm-royal-blue); background:var(--cdm-blue-soft); font-size:.7rem; font-weight:700; text-transform:capitalize; } .state { padding:2rem; border:1px solid var(--cdm-border); border-radius:15px; color:var(--cdm-muted); background:#fff; text-align:center; } :is(a,button):focus-visible { outline:3px solid var(--cdm-royal-blue); outline-offset:3px; }
    @media(max-width:650px) { .page-header { flex-direction:column; } .page-header > button { width:100%; } }
  `,
})
export class AdminContactRequestsComponent implements OnInit {
  private readonly contactRequests = inject(ContactRequestService);
  protected readonly requests = signal<readonly ContactRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly deletingId = signal<string | null>(null);

  ngOnInit(): void { void this.load(); }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.requests.set(await this.contactRequests.listForAdmin());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load contact requests.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async deleteRequest(request: ContactRequest): Promise<void> {
    if (!globalThis.confirm(`Delete the contact request from ${request.name}?`)) return;
    this.deletingId.set(request.id);
    this.error.set('');
    try {
      await this.contactRequests.deleteForAdmin(request.id);
      this.requests.update((items) => items.filter((item) => item.id !== request.id));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to delete this contact request.');
    } finally {
      this.deletingId.set(null);
    }
  }
}
