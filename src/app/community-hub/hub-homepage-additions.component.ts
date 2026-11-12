import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EssentialShortcut } from '../core/models/essential-service';
import { EssentialServiceService } from '../core/services/essential-service.service';
import { ContactRequestService } from '../core/services/contact-request.service';

@Component({
  selector: 'app-hub-homepage-additions',
  imports: [RouterLink, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (section() === 'quick') {
    <section class="hub-extra-quick" aria-labelledby="hub-extra-quick-title">
      <p class="hub-extra-eyebrow">CDM 360 / QUICK ACCESS</p>
      <h2 id="hub-extra-quick-title">Need Something? Find It Quickly.</h2>
      <p>Quick access to the services people need most in Chidambaram.</p>
      <a class="hub-extra-emergency" routerLink="/essential-services" [queryParams]="{q:'ambulance'}"><i class="bi bi-telephone-forward" aria-hidden="true"></i> Quick Emergency Contacts</a>
      @if (loading()) { <p role="status">Loading service shortcuts…</p> }
      @else if (shortcutError()) { <p role="alert">Unable to load service shortcuts.</p> }
      @else { <div class="hub-extra-shortcuts">@for (shortcut of shortcuts(); track shortcut.id) {
        <a [routerLink]="shortcut.destination" [class.hub-extra-urgent]="shortcut.is_emergency"><i [class]="shortcut.icon || 'bi bi-grid'" aria-hidden="true"></i><span>{{ shortcut.title }}</span><i class="bi bi-arrow-up-right" aria-hidden="true"></i></a>
      } @empty { <p>No service shortcuts are published yet.</p> }</div> }
    </section>
    } @else {
    <section class="hub-extra-contact" aria-labelledby="hub-extra-contact-title">
      <p class="hub-extra-eyebrow">GET IN TOUCH</p><h2 id="hub-extra-contact-title">Contact Us</h2>
      <form class="d-grid gap-3" [formGroup]="form" (ngSubmit)="submit()" novalidate [attr.aria-busy]="sending()">
        <div><label class="form-label" for="hub-contact-name">Your Name</label><input class="form-control" id="hub-contact-name" formControlName="name" autocomplete="name" placeholder="Enter your name" />@if (submitted() && form.controls.name.invalid) { <small class="text-danger" role="alert">Please enter your name.</small> }</div>
        <div><label class="form-label" for="hub-contact-email">Email Address</label><input class="form-control" id="hub-contact-email" type="email" formControlName="email" autocomplete="email" placeholder="Enter your email address" />@if (submitted() && form.controls.email.invalid) { <small class="text-danger" role="alert">Please enter a valid email address.</small> }</div>
        <div><label class="form-label" for="hub-contact-mobile">Mobile Number</label><input class="form-control" id="hub-contact-mobile" type="tel" formControlName="mobile" autocomplete="tel" placeholder="9876543210" aria-describedby="hub-contact-mobile-help" /><small id="hub-contact-mobile-help">Indian mobile number, for example 9876543210.</small>@if (submitted() && form.controls.mobile.invalid) { <small class="text-danger" role="alert">Please enter a valid 10-digit Indian mobile number.</small> }</div>
        <div><label class="form-label" for="hub-contact-message">Message</label><textarea class="form-control" id="hub-contact-message" formControlName="message" rows="4" placeholder="How can we help?"></textarea>@if (submitted() && form.controls.message.invalid) { <small class="text-danger" role="alert">Please enter a message.</small> }</div>
        @if (error()) { <p class="text-danger" role="alert">{{ error() }}</p> } @if (success()) { <p class="text-success" role="status">Thank you for reaching out! We will get back to you soon.</p> }
        <button type="submit" class="btn w-100 hub-extra-send" [disabled]="sending()">{{ sending() ? 'Sending…' : 'Send Message' }}</button>
      </form>
    </section>
    <section class="hub-extra-info" aria-labelledby="hub-extra-info-title">
      <h2 id="hub-extra-info-title">Contact Information</h2>
      <dl><div><dt><i class="bi bi-person" aria-hidden="true"></i> Karthic</dt><dd>Community contact</dd></div><div><dt><a href="tel:+919514636355">9514636355</a></dt><dd><a href="https://wa.me/919514636355" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a></dd></div><div><dt>Location</dt><dd>Chidambaram, Cuddalore District<br />Tamil Nadu, India</dd></div></dl>
      <a class="hub-extra-whatsapp" href="https://wa.me/919514636355" target="_blank" rel="noopener noreferrer"><i class="bi bi-whatsapp" aria-hidden="true"></i> WhatsApp</a>
    </section>
    }
  `,
  styles: `
    :host{display:grid;gap:32px;padding-bottom:32px;color:#002050;min-width:0}
    section{min-width:0;padding:clamp(16px,4vw,32px);border:1px solid #dce5ef;border-radius:18px;background:white;overflow-wrap:anywhere}
    h2{font-size:clamp(24px,3vw,32px);margin:0 0 16px;color:#002050}.hub-extra-eyebrow{font-size:12px;font-weight:800;letter-spacing:.1em;color:#0755b8}
    .hub-extra-emergency{display:inline-flex;align-items:center;gap:8px;min-height:44px;border:1px solid #c92a2a;border-radius:10px;padding:10px;color:#b42318;text-decoration:none;margin-bottom:16px}
    .hub-extra-shortcuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hub-extra-shortcuts a{display:flex;align-items:center;gap:8px;min-width:0;min-height:64px;padding:12px;border:1px solid #dce5ef;border-radius:12px;color:#002050;text-decoration:none;font-size:13px;font-weight:650}.hub-extra-shortcuts a>i:first-child{color:#0755b8;font-size:20px}.hub-extra-shortcuts a>i:last-child{margin-left:auto}.hub-extra-shortcuts .hub-extra-urgent{border-color:#c92a2a}
    .form-control{width:100%;min-height:48px}small{display:block}.hub-extra-send{min-height:48px;background:#e3864f;color:#071b3b;font-weight:750}.hub-extra-info{background:#fff0e6}.hub-extra-info dl{display:grid;gap:16px}.hub-extra-info dd{margin:4px 0 0}.hub-extra-info a{color:#002050}.hub-extra-whatsapp{display:inline-flex;gap:8px;align-items:center;min-height:44px}a:focus-visible,button:focus-visible{outline:3px solid #0755b8;outline-offset:3px}
    @media(min-width:768px){.hub-extra-shortcuts{grid-template-columns:repeat(4,minmax(0,1fr))}}
  `,
})
export class HubHomepageAdditionsComponent implements OnInit {
  readonly section = input<'quick' | 'contact'>('contact');
  private readonly essential = inject(EssentialServiceService);
  private readonly contacts = inject(ContactRequestService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly shortcuts = signal<readonly EssentialShortcut[]>([]);
  protected readonly loading = signal(true);
  protected readonly shortcutError = signal(false);
  protected readonly sending = signal(false);
  protected readonly submitted = signal(false);
  protected readonly success = signal(false);
  protected readonly error = signal('');
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    mobile: ['', [Validators.required, Validators.pattern(/^(?:\+91[\s-]?)?[6-9]\d{9}$/)]],
    message: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(4000)]],
  });
  async ngOnInit(): Promise<void> { if (this.section() !== 'quick') return; try { this.shortcuts.set(await this.essential.getEssentialShortcuts()); } catch { this.shortcutError.set(true); } finally { this.loading.set(false); } }
  protected async submit(): Promise<void> {
    this.submitted.set(true); this.success.set(false); this.error.set('');
    if (this.form.invalid || this.sending()) { this.form.markAllAsTouched(); return; }
    this.sending.set(true);
    try { const value = this.form.getRawValue(); const mobile = value.mobile.replace(/[\s-]/g, ''); await this.contacts.submit({ ...value, mobile: mobile.startsWith('+91') ? mobile : `+91${mobile}` }); this.form.reset(); this.submitted.set(false); this.success.set(true); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to send your message right now. Please try again.'); }
    finally { this.sending.set(false); }
  }
}
