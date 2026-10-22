import { TestBed } from '@angular/core/testing';
import { Session } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { AuthService } from './auth.service';
import { SupabaseService } from '../services/supabase.service';

describe('AuthService', () => {
  const getSession = vi.fn();
  const onAuthStateChange = vi.fn();
  const signInWithPassword = vi.fn();
  const signOut = vi.fn();
  const select = vi.fn();
  const eq = vi.fn();
  const inFilter = vi.fn();
  const returns = vi.fn();
  const from = vi.fn();

  function session(userId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'): Session {
    return {
      access_token: 'test-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      expires_at: 9999999999,
      token_type: 'bearer',
      user: { id: userId, aud: 'authenticated' },
    } as Session;
  }

  beforeEach(() => {
    vi.resetAllMocks();
    const query = { select, eq, in: inFilter, returns };
    select.mockReturnValue(query);
    eq.mockReturnValue(query);
    inFilter.mockReturnValue(query);
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    signInWithPassword.mockResolvedValue({ data: { session: session() }, error: null });
    signOut.mockResolvedValue({ error: null });
    returns.mockResolvedValue({ data: [], error: null });
    from.mockReturnValue(query);
  });

  async function createService(): Promise<AuthService> {
    TestBed.configureTestingModule({ providers: [
      { provide: SupabaseService, useValue: { client: {
        auth: { getSession, onAuthStateChange, signInWithPassword, signOut }, from,
      } } },
    ] });
    const service = TestBed.inject(AuthService);
    await service.ready();
    return service;
  }

  it('starts unauthenticated and does not grant admin access by default', async () => {
    const service = await createService();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.isAdmin()).toBe(false);
  });

  it('verifies administrator roles through the current user_roles policy', async () => {
    const currentSession = session();
    getSession.mockResolvedValue({ data: { session: currentSession }, error: null });
    returns.mockResolvedValue({ data: [{ role_code: 'moderator' }], error: null });
    const service = await createService();
    expect(service.isAuthenticated()).toBe(true);
    expect(service.isAdmin()).toBe(true);
    expect(service.roles()).toEqual(['moderator']);
    expect(from).toHaveBeenCalledWith('user_roles');
    expect(eq).toHaveBeenCalledWith('user_id', currentSession.user.id);
    expect(inFilter).toHaveBeenCalledWith('role_code', ['super_admin', 'district_admin', 'moderator']);
  });

  it('rejects a valid sign-in without an administrator role', async () => {
    const service = await createService();
    await expect(service.signIn('user@example.com', 'password')).rejects.toThrow('administrator access');
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'password' });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.isAdmin()).toBe(false);
  });

  it('accepts a sign-in with an administrator role', async () => {
    const service = await createService();
    returns.mockResolvedValue({ data: [{ role_code: 'super_admin' }], error: null });
    await service.signIn('admin@example.com', 'password');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.isAdmin()).toBe(true);
  });
});
