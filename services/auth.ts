import { supabase } from '../lib/supabase';
import { strings } from '../constants/strings';

export interface SignUpParams {
  email: string;
  password: string;
  displayName: string;
  dob: string; // YYYY-MM-DD
  termsVersion?: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface Profile {
  id: string;
  display_name: string;
  headline: string;
  bio: string | null;
  avatar_path: string | null;
  area: string | null;
  preferred_contact: string;
  languages: string[];
  work_types: string[];
  availability: 'available_now' | 'part_time' | 'weekends' | 'not_taking_work' | null;
  experience_years: 'lt_1' | '1_3' | '3_5' | '5_plus' | null;
  starting_rate_note: string;
  client_type: 'individual' | 'business' | 'organization' | 'other' | null;
  business_name: string;
  about_hiring: string;
  active_mode: 'find_work' | 'hire' | null;
  mode_changed_at: string | null;
  onboarding_complete: boolean;
  freelancer_rating_avg: number;
  freelancer_rating_count: number;
  client_rating_avg: number;
  client_rating_count: number;
  freelancer_completed_gigs: number;
  client_completed_gigs: number;
  rating_avg: number;
  rating_count: number;
  completed_gigs: number;
  status: 'active' | 'suspended' | 'deactivated';
  created_at: string;
  updated_at?: string;
}

const COMMON_EMAIL_DOMAIN_TYPOS = new Set([
  'gmial.com',
  'gamil.com',
  'gmal.com',
  'gmai.com',
  'gmail.con',
  'gmail.co',
  'yaho.com',
  'yahooo.com',
  'yahoo.con',
  'hotmial.com',
  'outlok.com',
]);

export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

export function validateEmailInput(rawEmail: string): { valid: boolean; message?: string } {
  const normalized = normalizeEmail(rawEmail);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
    return { valid: false, message: strings.auth.invalidEmailFormat };
  }
  const domain = normalized.split('@')[1] || '';
  if (COMMON_EMAIL_DOMAIN_TYPOS.has(domain)) {
    return { valid: false, message: strings.auth.disposableEmailTypo };
  }
  return { valid: true };
}

export function isDuplicateEmailAuthResult(error: any, data?: any): boolean {
  if (error) {
    const code = String(error.code || '').toLowerCase();
    const msg = String(error.message || '').toLowerCase();
    if (
      code === 'user_already_exists' ||
      code === 'email_exists' ||
      msg.includes('user already registered') ||
      msg.includes('already registered') ||
      msg.includes('already been registered') ||
      msg.includes('email already exists')
    ) {
      return true;
    }
  }

  // Supabase Auth returns a user with an empty identities array when email confirmation is enabled and the email is already registered
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return true;
  }

  return false;
}

let signUpInFlight = false;

export const authService = {
  normalizeEmail,
  validateEmailInput,
  isDuplicateEmailAuthResult,

  async signUp({ email, password, displayName, dob, termsVersion = 'v1.0' }: SignUpParams) {
    if (signUpInFlight) {
      const busyErr: any = new Error('Sign up is already in progress.');
      busyErr.code = 'SIGNUP_IN_PROGRESS';
      throw busyErr;
    }

    const normalizedEmail = normalizeEmail(email);
    const emailCheck = validateEmailInput(normalizedEmail);
    if (!emailCheck.valid) {
      const invalidErr: any = new Error(emailCheck.message || strings.auth.invalidEmailFormat);
      invalidErr.code = 'INVALID_EMAIL';
      throw invalidErr;
    }

    signUpInFlight = true;
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            dob,
            terms_version: termsVersion,
          },
        },
      });

      if (isDuplicateEmailAuthResult(error, data)) {
        const dupErr: any = new Error(strings.auth.duplicateEmailMessage);
        dupErr.code = 'EMAIL_ALREADY_REGISTERED';
        throw dupErr;
      }

      if (error) {
        throw error;
      }

      return data;
    } finally {
      signUpInFlight = false;
    }
  },

  async signIn({ email, password }: SignInParams) {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('Supabase signOut warning:', error.message);
      }
    } catch (e: any) {
      console.warn('Supabase signOut exception:', e?.message);
    }
  },

  async resetPassword(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);
    if (error) {
      throw error;
    }
    return data;
  },

  async getCurrentProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as Profile | null;
  },

  async chooseInitialMode(targetMode: 'find_work' | 'hire'): Promise<void> {
    const { error } = await supabase.rpc('choose_initial_mode', {
      target_mode: targetMode,
    });

    if (error) {
      throw error;
    }
  },

  async updateProfile(
    userId: string,
    updates: Partial<Pick<Profile, 'display_name' | 'bio' | 'avatar_path' | 'area' | 'onboarding_complete'>>
  ) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as Profile;
  },

  async completeOnboarding(): Promise<void> {
    const { error } = await supabase.rpc('complete_onboarding');
    if (error) {
      throw error;
    }
  },
};
