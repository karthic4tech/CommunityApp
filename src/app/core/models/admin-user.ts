export interface AdminUser {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  phone_confirmed_at: string | null;
  email_confirmed_at: string | null;
  providers: string[];
  avatar_path: string | null;
  preferred_language: 'ta' | 'en' | null;
  preferred_locality_id: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
}

export interface AdminUserStats { total: number; new_this_month: number; mobile_verified: number; mobile_missing: number; mobile_unverified: number; }
export interface AdminUserQuery { page?: number; per_page?: 20 | 50 | 100; search?: string; provider?: string; mobile?: 'verified' | 'missing' | 'unverified' | ''; sort?: 'created_at' | 'name' | 'last_sign_in_at'; created_from?: string; created_to?: string; }
export interface AdminUserPage { users: AdminUser[]; page: number; per_page: number; total: number; }
