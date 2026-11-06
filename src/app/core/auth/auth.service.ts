import { Injectable, computed, inject, signal } from '@angular/core';
import { Session, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { SupabaseService } from '../services/supabase.service';

const ADMIN_ROLE_CODES = ['super_admin', 'district_admin', 'moderator'] as const;

interface UserRoleRow {
  role_code: string;
}

export interface SignUpResult {
  emailVerificationRequired: boolean;
  hasSession: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly sessionState = signal<Session | null>(null);
  private readonly rolesState = signal<readonly string[]>([]);
  private readonly loadingState = signal(true);
  private readonly errorState = signal<string | null>(null);
  private readonly initialization: Promise<void>;
  private googleSignInRequest: Promise<void> | null = null;

  readonly session = this.sessionState.asReadonly();
  readonly user = computed<User | null>(() => this.sessionState()?.user ?? null);
  readonly roles = this.rolesState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionState() !== null);
  readonly isAdmin = computed(() => this.rolesState().length > 0);
  readonly emailVerified = computed(() => Boolean(this.user()?.email_confirmed_at));
  readonly phoneVerified = computed(() => Boolean(this.user()?.phone && this.user()?.phone_confirmed_at));

  constructor() {
    this.initialization = this.initialize();
  }

  async ready(): Promise<void> {
    await this.initialization;
  }

  async refreshAuthorization(): Promise<void> {
    await this.ready();
    await this.loadRoles(this.sessionState());
  }

  async signUp(fullName: string, email: string, password: string): Promise<SignUpResult> {
    this.errorState.set(null);
    try {
      const redirectTo = this.authRedirectUrl();
      const { data, error } = await this.supabase.client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
          data: { full_name: fullName.trim() },
        },
      });
      if (error) throw error;
      if (data.session) {
        this.sessionState.set(data.session);
        await this.loadRoles(data.session);
      }
      return {
        emailVerificationRequired: !data.session || !data.user?.email_confirmed_at,
        hasSession: Boolean(data.session),
      };
    } catch (error) {
      const message = this.mapAuthError(error, 'Unable to create your account.');
      this.errorState.set(message);
      throw new Error(message);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    this.errorState.set(null);
    try {
      const { data, error } = await this.supabase.client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error || !data.session) throw error ?? new Error('Sign-in failed.');
      this.sessionState.set(data.session);
      await this.loadRoles(data.session);
    } catch (error) {
      const message = this.mapAuthError(error, 'Unable to sign in. Check your credentials and try again.');
      this.errorState.set(message);
      throw new Error(message);
    }
  }

  async signInAdmin(email: string, password: string): Promise<void> {
    await this.signIn(email, password);
    await this.refreshAuthorization();
    if (this.isAdmin()) return;
    await this.signOut();
    const message = 'This account does not have administrator access.';
    this.errorState.set(message);
    throw new Error(message);
  }

  async signInWithGoogle(): Promise<void> {
    if (this.googleSignInRequest) return this.googleSignInRequest;
    this.errorState.set(null);
    this.googleSignInRequest = this.startGoogleSignIn();
    try { await this.googleSignInRequest; } finally { this.googleSignInRequest = null; }
  }

  async sendPhoneOtp(phone: string): Promise<void> {
    this.errorState.set(null);
    try {
      const { error } = await this.supabase.client.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
    } catch (error) {
      const message = this.mapPhoneAuthError(error, 'We could not send a verification code. Please try again.');
      this.errorState.set(message);
      throw new Error(message);
    }
  }

  async verifyPhoneOtp(phone: string, token: string): Promise<void> {
    this.errorState.set(null);
    try {
      const { data, error } = await this.supabase.client.auth.verifyOtp({ phone, token, type: 'sms' });
      if (error || !data.session) throw error ?? new Error('Verification did not return a session.');
      this.sessionState.set(data.session);
      await this.loadRoles(data.session);
    } catch (error) {
      const message = this.mapPhoneAuthError(error, 'That verification code is not valid. Please check it and try again.');
      this.errorState.set(message);
      throw new Error(message);
    }
  }

  async sendPhoneChangeOtp(phone: string): Promise<void> {
    this.errorState.set(null);
    try {
      const { error } = await this.supabase.client.auth.updateUser({ phone });
      if (error) throw error;
    } catch (error) {
      const message = this.mapPhoneAuthError(error, 'We could not send a verification code. Please try again.');
      this.errorState.set(message);
      throw new Error(message);
    }
  }

  async verifyPhoneChangeOtp(phone: string, token: string): Promise<void> {
    this.errorState.set(null);
    try {
      const { error } = await this.supabase.client.auth.verifyOtp({ phone, token, type: 'phone_change' });
      if (error) throw error;
      const { data: refreshed, error: refreshError } = await this.supabase.client.auth.refreshSession();
      if (refreshError || !refreshed.session) throw refreshError ?? new Error('Verification session unavailable.');
      this.sessionState.set(refreshed.session);
      await this.loadRoles(refreshed.session);
    } catch (error) {
      const message = this.mapPhoneAuthError(error, 'That verification code is not valid. Please check it and try again.');
      this.errorState.set(message);
      throw new Error(message);
    }
  }

  private async startGoogleSignIn(): Promise<void> {
    try {
      const origin = globalThis.location?.origin;
      const redirectTo = origin ? `${origin}/auth/callback` : '/auth/callback';
      const { error } = await this.supabase.client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (error) {
      const message = this.mapAuthError(error, 'Google sign-in is not available. Check the Supabase provider configuration.');
      this.errorState.set(message);
      throw new Error(message);
    }
  }

  async resendVerification(email: string): Promise<void> {
    this.errorState.set(null);
    try {
      const redirectTo = this.authRedirectUrl();
      const { error } = await this.supabase.client.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      });
      if (error) throw error;
    } catch (error) {
      const message = this.mapAuthError(error, 'Unable to resend the verification email. Please wait and try again.');
      this.errorState.set(message);
      throw new Error(message);
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    this.errorState.set(null);
    try {
      const redirectTo = environment.supabasePasswordResetRedirectUrl || (globalThis.location?.origin ? `${globalThis.location.origin}/auth/reset-password` : undefined);
      const { error } = await this.supabase.client.auth.resetPasswordForEmail(email.trim(), redirectTo ? { redirectTo } : undefined);
      if (error) throw error;
    } catch (error) {
      const message = this.mapAuthError(error, 'Unable to start password recovery. Please try again.');
      this.errorState.set(message);
      throw new Error(message);
    }
  }

  async updatePassword(password: string): Promise<void> {
    this.errorState.set(null);
    try {
      const { error } = await this.supabase.client.auth.updateUser({ password });
      if (error) throw error;
    } catch (error) {
      const message = this.mapAuthError(error, 'Unable to update your password.');
      this.errorState.set(message);
      throw new Error(message);
    }
  }

  async signOut(): Promise<void> {
    this.errorState.set(null);
    try {
      // Revoke every active Supabase session, not only this browser session.
      const { error } = await this.supabase.client.auth.signOut({ scope: 'global' });
      if (error) throw error;
    } catch {
      this.errorState.set('Unable to sign out. Please try again.');
      throw new Error('Unable to sign out.');
    } finally {
      this.sessionState.set(null);
      this.rolesState.set([]);
      this.clearClientStorage();
    }
  }

  private clearClientStorage(): void {
    // Supabase owns the auth token storage. Clearing both stores also removes
    // any pending callback state or cached user-specific browser data.
    try { globalThis.localStorage?.clear(); } catch { /* Storage may be blocked by browser privacy settings. */ }
    try { globalThis.sessionStorage?.clear(); } catch { /* Storage may be blocked by browser privacy settings. */ }
  }

  private async initialize(): Promise<void> {
    try {
      const { data, error } = await this.supabase.client.auth.getSession();
      if (error) throw error;
      this.sessionState.set(data.session);
      await this.loadRoles(data.session);
      this.supabase.client.auth.onAuthStateChange((_event, session) => {
        this.sessionState.set(session);
        queueMicrotask(() => void this.loadRoles(session));
      });
    } catch {
      this.sessionState.set(null);
      this.rolesState.set([]);
      this.errorState.set('Authentication is currently unavailable.');
    } finally {
      this.loadingState.set(false);
    }
  }

  private async loadRoles(session: Session | null): Promise<boolean> {
    if (!session) {
      this.rolesState.set([]);
      return false;
    }
    try {
      const { data, error } = await this.supabase.client
        .from('user_roles')
        .select('role_code')
        .eq('user_id', session.user.id)
        .in('role_code', [...ADMIN_ROLE_CODES])
        .returns<UserRoleRow[]>();
      if (error) throw error;
      const roles = (data ?? []).map(row => row.role_code).filter(role => ADMIN_ROLE_CODES.includes(role as typeof ADMIN_ROLE_CODES[number]));
      this.rolesState.set(roles);
      return roles.length > 0;
    } catch (error) {
      console.warn('Unable to verify administrator role.', { code: error && typeof error === 'object' && 'code' in error ? error.code : undefined });
      this.rolesState.set([]);
      this.errorState.set('Administrator access could not be verified.');
      return false;
    }
  }

  private authRedirectUrl(): string | undefined {
    if (environment.supabaseAuthRedirectUrl) return environment.supabaseAuthRedirectUrl;
    const origin = globalThis.location?.origin;
    return origin ? `${origin}/auth/verify-email` : undefined;
  }

  private mapAuthError(error: unknown, fallback: string): string {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('already registered') || message.includes('already exists')) return 'An account with this email already exists.';
    if (message.includes('invalid login') || message.includes('invalid credentials')) return 'The email or password is incorrect.';
    if (message.includes('password')) return 'The password does not meet the required rules.';
    if (message.includes('email')) return 'Please check the email address and try again.';
    return fallback;
  }

  private mapPhoneAuthError(error: unknown, fallback: string): string {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('rate') || message.includes('too many') || message.includes('limit')) return 'Too many requests. Please wait a moment before trying again.';
    if (message.includes('expired')) return 'This verification code has expired. Request a new code.';
    if (message.includes('invalid') || message.includes('token') || message.includes('otp')) return 'That verification code is incorrect or expired. Please try again.';
    if (message.includes('provider') || message.includes('sms') || message.includes('phone') || message.includes('not configured')) {
      return 'SMS login is not configured yet. Please enable Phone Auth and configure an SMS provider in Supabase.';
    }
    if (message.includes('network') || message.includes('fetch')) return 'Unable to connect. Check your internet connection and try again.';
    return fallback;
  }
}
