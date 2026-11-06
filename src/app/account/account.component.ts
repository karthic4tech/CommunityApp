import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { locationSearchOptions } from '../core/models/service-listing';
import { SubmissionRow, SubmissionStatus } from '../core/models/service-submission';
import { LanguageService } from '../core/services/language.service';
import { MediaService } from '../core/services/media.service';
import { ProfileService } from '../core/services/profile.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { ServiceSubmissionService } from '../core/services/service-submission.service';
import { FormFileUploadComponent } from '../shared/forms/form-file-upload.component';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../shared/components/searchable-select/searchable-select.models';
import { MobileVerificationComponent } from './mobile-verification.component';

const ACCOUNT_COPY = {
  en: {
    eyebrow: 'ACCOUNT OVERVIEW', title: 'My account', intro: 'Your profile, listings and community activity in one place.',
    verified: 'Email verified', verifyNeeded: 'Email verification needed', verifyTitle: 'Verify your email to publish services',
    verifyBody: 'You can complete your profile now. Email verification is required before submitting a service for review.', verifyAction: 'Verify email',
    member: 'Community member', editProfile: 'Edit profile', profile: 'Profile information', profileHint: 'Keep your details up to date so the community can recognize you.',
    fullName: 'Full name', email: 'Email address', emailHelp: 'Managed securely through Supabase Auth.', phone: 'Phone number',
    preferredLanguage: 'Preferred language', preferredLocality: 'Preferred locality', notSelected: 'Not selected',
    profilePhoto: 'Profile photo', photoHint: 'Upload a square photo. Your existing profile image can be replaced here.',
    save: 'Save changes', cancel: 'Cancel', readOnlyHint: 'Your profile details are read-only. Select Edit profile to make changes.',
    saving: 'Saving changes…', saved: 'Your profile was saved.', saveFailed: 'Unable to save your profile.',
    loadingProfile: 'Loading your profile…', loadingActivity: 'Loading your activity…', profileLoadFailed: 'Unable to load your profile.', retry: 'Try again',
    totalSubmissions: 'Total submissions', publishedListings: 'Published listings', pendingApprovals: 'Pending approvals',
    activity: 'Community activity', summary: 'Your activity at a glance', shortcuts: 'Quick links', addService: 'Add your service', listings: 'My service listings',
    listingsHint: 'Manage drafts, submissions and review feedback.', browseServices: 'Browse services', recentSubmissions: 'Recent submissions',
    viewAll: 'View all submissions', noSubmissions: 'No submissions yet', noSubmissionsHint: 'Your service submissions and their review progress will appear here.',
    updated: 'Updated', openSubmission: 'Manage', approvalProgress: 'Approval progress', stepDraft: 'Draft', stepReview: 'Review', stepPublished: 'Published',
    statuses: { draft: 'Draft', pending_review: 'Pending review', published: 'Published', rejected: 'Changes requested', suspended: 'Suspended', archived: 'Unpublished' },
    accountSettings: 'Account settings', memberSince: 'Community member since', security: 'Password and security', resetPassword: 'Reset password',
    resetHint: 'Send a secure password reset link to your email.', signOut: 'Sign out', signingOut: 'Signing out…',
    invalidName: 'Please enter your name.', invalidNameLength: 'Your name must be 160 characters or fewer.',
  },
  ta: {
    eyebrow: 'கணக்கு கண்ணோட்டம்', title: 'எனது கணக்கு', intro: 'உங்கள் சுயவிவரம், சேவைகள் மற்றும் சமூகச் செயல்பாடுகள் ஒரே இடத்தில்.',
    verified: 'மின்னஞ்சல் சரிபார்க்கப்பட்டது', verifyNeeded: 'மின்னஞ்சலைச் சரிபார்க்கவும்', verifyTitle: 'சேவைகளை வெளியிட மின்னஞ்சலைச் சரிபார்க்கவும்',
    verifyBody: 'இப்போது உங்கள் சுயவிவரத்தைப் பூர்த்தி செய்யலாம். சேவையை மதிப்பாய்வுக்கு அனுப்ப மின்னஞ்சல் சரிபார்ப்பு அவசியம்.', verifyAction: 'மின்னஞ்சலைச் சரிபார்க்கவும்',
    member: 'சமூக உறுப்பினர்', editProfile: 'சுயவிவரத்தைத் திருத்து', profile: 'சுயவிவரத் தகவல்', profileHint: 'சமூகத்தினர் உங்களை அடையாளம் காண உங்கள் தகவல்களைப் புதுப்பித்த நிலையில் வைத்திருங்கள்.',
    fullName: 'முழுப் பெயர்', email: 'மின்னஞ்சல் முகவரி', emailHelp: 'Supabase Auth மூலம் பாதுகாப்பாக நிர்வகிக்கப்படுகிறது.', phone: 'தொலைபேசி எண்',
    preferredLanguage: 'விருப்ப மொழி', preferredLocality: 'விருப்பமான பகுதி', notSelected: 'தேர்ந்தெடுக்கப்படவில்லை',
    profilePhoto: 'சுயவிவரப் படம்', photoHint: 'சதுர வடிவப் படத்தைப் பதிவேற்றவும். ஏற்கனவே உள்ள படத்தையும் இங்கே மாற்றலாம்.',
    save: 'மாற்றங்களைச் சேமி', cancel: 'ரத்து செய்', readOnlyHint: 'உங்கள் சுயவிவர விவரங்கள் படிக்க மட்டும். மாற்ற “சுயவிவரத்தைத் திருத்து” என்பதைத் தேர்ந்தெடுக்கவும்.',
    saving: 'சேமிக்கப்படுகிறது…', saved: 'உங்கள் சுயவிவரம் சேமிக்கப்பட்டது.', saveFailed: 'சுயவிவரத்தைச் சேமிக்க முடியவில்லை.',
    loadingProfile: 'சுயவிவரம் ஏற்றப்படுகிறது…', loadingActivity: 'செயல்பாடுகள் ஏற்றப்படுகின்றன…', profileLoadFailed: 'சுயவிவரத்தை ஏற்ற முடியவில்லை.', retry: 'மீண்டும் முயற்சி',
    totalSubmissions: 'மொத்த சமர்ப்பிப்புகள்', publishedListings: 'வெளியிடப்பட்ட சேவைகள்', pendingApprovals: 'மதிப்பாய்வில் உள்ளவை',
    activity: 'சமூகச் செயல்பாடு', summary: 'உங்கள் செயல்பாடுகள்', shortcuts: 'விரைவு இணைப்புகள்', addService: 'உங்கள் சேவையைச் சேர்க்கவும்', listings: 'எனது சேவைகள்',
    listingsHint: 'வரைவுகள், சமர்ப்பிப்புகள் மற்றும் மதிப்பாய்வு கருத்துகளை நிர்வகிக்கவும்.', browseServices: 'சேவைகளைப் பாருங்கள்', recentSubmissions: 'சமீபத்திய சமர்ப்பிப்புகள்',
    viewAll: 'அனைத்து சமர்ப்பிப்புகளையும் காண்க', noSubmissions: 'சமர்ப்பிப்புகள் இல்லை', noSubmissionsHint: 'உங்கள் சேவைகள் மற்றும் அவற்றின் மதிப்பாய்வு நிலை இங்கே தோன்றும்.',
    updated: 'புதுப்பிக்கப்பட்டது', openSubmission: 'நிர்வகிக்கவும்', approvalProgress: 'ஒப்புதல் முன்னேற்றம்', stepDraft: 'வரைவு', stepReview: 'மதிப்பாய்வு', stepPublished: 'வெளியீடு',
    statuses: { draft: 'வரைவு', pending_review: 'மதிப்பாய்வில்', published: 'வெளியிடப்பட்டது', rejected: 'மாற்றங்கள் கோரப்பட்டன', suspended: 'இடைநிறுத்தப்பட்டது', archived: 'வெளியீடு நீக்கப்பட்டது' },
    accountSettings: 'கணக்கு அமைப்புகள்', memberSince: 'சமூகத்தில் இணைந்த நாள்', security: 'கடவுச்சொல் மற்றும் பாதுகாப்பு', resetPassword: 'கடவுச்சொல்லை மீட்டமை',
    resetHint: 'பாதுகாப்பான கடவுச்சொல் மீட்டமைப்பு இணைப்பை மின்னஞ்சலில் பெறுங்கள்.', signOut: 'வெளியேறு', signingOut: 'வெளியேறுகிறது…',
    invalidName: 'உங்கள் பெயரை உள்ளிடவும்.', invalidNameLength: 'பெயர் 160 எழுத்துகளுக்குள் இருக்க வேண்டும்.',
  },
} as const;

interface AccountProfileValues {
  full_name: string;
  phone: string;
  preferred_language: 'ta' | 'en';
  preferred_locality_id: string;
}

@Component({
  selector: 'app-account',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, FormFileUploadComponent, SearchableSelectComponent, MobileVerificationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly phoneVerified = computed(() => Boolean(this.auth.user()?.phone && this.auth.user()?.phone_confirmed_at));
  private readonly profiles = inject(ProfileService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly submissionService = inject(ServiceSubmissionService);
  private readonly media = inject(MediaService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  protected readonly i18n = inject(LanguageService);
  private readonly fullNameInput = viewChild<ElementRef<HTMLInputElement>>('fullNameInput');

  protected readonly form = this.formBuilder.group({
    full_name: ['', [Validators.required, Validators.maxLength(160)]],
    phone: ['', Validators.maxLength(40)],
    preferred_language: 'ta' as 'ta' | 'en',
    preferred_locality_id: '',
  });
  protected readonly copy = computed(() => this.i18n.language() === 'ta' ? ACCOUNT_COPY.ta : ACCOUNT_COPY.en);
  protected readonly profileLoading = signal(true);
  protected readonly activityLoading = signal(true);
  protected readonly profileError = signal<string | null>(null);
  protected readonly activityError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editing = signal(false);
  protected readonly signingOut = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly messageIsError = signal(false);
  protected readonly signOutError = signal<string | null>(null);
  protected readonly places = signal<readonly SearchableSelectOption[]>([]);
  private readonly savedProfileValues = signal<AccountProfileValues | null>(null);
  protected readonly submissions = signal<SubmissionRow[]>([]);
  protected readonly displayName = signal('');
  protected readonly avatarUrl = signal<string | null>(null);
  protected readonly initials = computed(() => {
    const name = this.displayName().trim() || this.auth.user()?.email?.split('@')[0] || 'CDM360';
    const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part.charAt(0).toLocaleUpperCase()).join('') || 'CD';
  });
  protected readonly totalSubmissions = computed(() => this.submissions().length);
  protected readonly publishedListings = computed(() => this.submissions().filter((submission) => submission.status === 'published').length);
  protected readonly pendingApprovals = computed(() => this.submissions().filter((submission) =>
    submission.status === 'pending_review' || submission.service_listing_revisions?.some((revision) => revision.status === 'pending_review'),
  ).length);
  protected readonly recentSubmissions = computed(() => this.submissions().slice(0, 3));
  protected readonly approvalSteps = [1, 2, 3] as const;
  ngOnInit(): void {
    void this.loadProfile();
    void this.loadActivity();
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.message.set(null);
    try {
      const profile = await this.profiles.save(this.form.getRawValue());
      const savedValues: AccountProfileValues = {
        full_name: profile.full_name ?? '',
        phone: profile.phone ?? '',
        preferred_language: profile.preferred_language,
        preferred_locality_id: profile.preferred_locality_id ?? '',
      };
      this.form.reset(savedValues);
      this.savedProfileValues.set(savedValues);
      this.displayName.set(savedValues.full_name);
      this.editing.set(false);
      this.messageIsError.set(false);
      this.message.set(this.copy().saved);
    } catch (error) {
      this.messageIsError.set(true);
      this.message.set(error instanceof Error ? error.message : this.copy().saveFailed);
    } finally {
      this.saving.set(false);
    }
  }

  protected async loadProfile(): Promise<void> {
    this.profileLoading.set(true);
    this.profileError.set(null);
    try {
      const metadataName = this.auth.user()?.user_metadata?.['full_name'];
      const fallbackName = typeof metadataName === 'string' ? metadataName : null;
      const [profile, locations] = await Promise.all([this.profiles.ensure(fallbackName), this.directory.locations()]);
      const savedValues: AccountProfileValues = {
        full_name: profile.full_name ?? '',
        phone: profile.phone ?? '',
        preferred_language: profile.preferred_language,
        preferred_locality_id: profile.preferred_locality_id ?? '',
      };
      this.form.reset(savedValues);
      this.savedProfileValues.set(savedValues);
      this.displayName.set(savedValues.full_name);
      this.editing.set(false);
      this.places.set(locationSearchOptions(locations, profile.preferred_language));
      void this.refreshAvatar();
    } catch (error) {
      this.profileError.set(error instanceof Error ? error.message : this.copy().profileLoadFailed);
    } finally {
      this.profileLoading.set(false);
    }
  }

  protected async loadActivity(): Promise<void> {
    this.activityLoading.set(true);
    this.activityError.set(null);
    try {
      this.submissions.set(await this.submissionService.listMine());
    } catch (error) {
      this.activityError.set(error instanceof Error ? error.message : this.copy().loadingActivity);
    } finally {
      this.activityLoading.set(false);
    }
  }

  protected async refreshAvatar(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) {
      this.avatarUrl.set(null);
      return;
    }
    try {
      const gallery = await this.media.getMediaGallery('profile', userId);
      this.avatarUrl.set(gallery[0]?.url ?? null);
    } catch {
      this.avatarUrl.set(null);
    }
  }

  protected onNameInput(): void {
    this.displayName.set(this.form.controls.full_name.value);
  }

  protected startEditing(): void {
    if (this.profileLoading() || this.profileError()) return;
    this.message.set(null);
    this.editing.set(true);
    this.fullNameInput()?.nativeElement.focus();
  }

  protected cancelEdit(): void {
    const savedValues = this.savedProfileValues();
    if (savedValues) {
      this.form.reset(savedValues);
      this.displayName.set(savedValues.full_name);
    }
    this.message.set(null);
    this.editing.set(false);
  }

  protected statusLabel(status: SubmissionStatus): string {
    return this.copy().statuses[status];
  }

  protected approvalStep(status: SubmissionStatus): number {
    if (status === 'draft') return 1;
    if (status === 'pending_review') return 2;
    if (status === 'published') return 3;
    return 0;
  }

  protected async signOut(): Promise<void> {
    this.signOutError.set(null);
    this.signingOut.set(true);
    try {
      await this.auth.signOut();
    } catch (error) {
      this.signOutError.set(error instanceof Error ? error.message : 'Unable to sign out. Please try again.');
    } finally {
      this.signingOut.set(false);
      await this.router.navigateByUrl('/auth/sign-in', { replaceUrl: true });
    }
  }
}
