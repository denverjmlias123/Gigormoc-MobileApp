import { supabase } from '../lib/supabase';
import { strings } from '../constants/strings';
import * as passwordPolicy from '../utils/passwordPolicy';
import * as Linking from 'expo-linking';
import { sessionService } from './sessions';

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
  status: 'active' | 'suspended' | 'deactivated' | 'deleted';
  must_change_password: boolean;
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
let signInInFlight: Promise<any> | null = null;
let signOutInFlight: Promise<void> | null = null;
let resetPasswordInFlight = false;
let updatePasswordInFlight = false;
let resendConfirmationInFlight = false;
let lastResendConfirmationAt = 0;

type LoginGuardResult = { locked?: boolean; seconds_left?: number; attempts_left?: number };

async function callLoginGuard(action: 'check' | 'failure' | 'success', email: string): Promise<LoginGuardResult> {
  const { data, error } = await supabase.functions.invoke('login-guard', { body: { action, email } });
  if (error) throw error;
  if (data?.error) {
    const guardError: any = new Error(strings.errors.generic);
    guardError.code = data.error;
    throw guardError;
  }
  return data ?? {};
}

function createLockedError(result: LoginGuardResult): Error & Record<string, unknown> {
  const error: any = new Error('Too many failed login attempts.');
  error.code = 'ACCOUNT_LOCKED';
  error.seconds_left = Math.max(0, Number(result.seconds_left) || 0);
  error.attempts_left = 0;
  return error;
}

export const RESEND_CONFIRMATION_COOLDOWN_SECONDS = 60;

export const authService = {
  normalizeEmail,
  validateEmailInput,
  isDuplicateEmailAuthResult,
  validatePassword: passwordPolicy.validatePassword,
  validatePasswordConfirmation: passwordPolicy.validatePasswordConfirmation,

  async getLoginGuardState(email: string): Promise<LoginGuardResult> {
    const normalizedEmail = normalizeEmail(email);
    const validation = validateEmailInput(normalizedEmail);
    if (!validation.valid) return { locked: false, attempts_left: 3, seconds_left: 0 };
    return callLoginGuard('check', normalizedEmail);
  },

  assertPasswordPolicy(password: string, email = '', displayName = '') {
    const result = passwordPolicy.validatePassword(password, email, displayName);
    if (!result.valid) {
      const policyErr: any = new Error(strings.auth.passwordInvalid);
      policyErr.code = 'WEAK_PASSWORD';
      policyErr.failedRules = result.failed;
      throw policyErr;
    }
  },

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
      invalidErr.field = 'email';
      throw invalidErr;
    }

    this.assertPasswordPolicy(password, normalizedEmail, displayName);

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
        dupErr.field = 'email';
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
    if (signInInFlight) {
      return signInInFlight;
    }

    const normalizedEmail = normalizeEmail(email);
    const emailCheck = validateEmailInput(normalizedEmail);
    if (!emailCheck.valid) {
      const invalidErr: any = new Error(emailCheck.message || strings.auth.invalidEmailFormat);
      invalidErr.code = 'INVALID_EMAIL';
      invalidErr.field = 'email';
      throw invalidErr;
    }

    signInInFlight = (async () => {
      try {
        const gate = await callLoginGuard('check', normalizedEmail);
        if (gate.locked) throw createLockedError(gate);

        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) {
          const lower = String(error.message || '').toLowerCase();
          if (lower.includes('email not confirmed') || (error as any).code === 'email_not_confirmed') {
            const unconfErr: any = new Error(strings.errors.emailNotConfirmed);
            unconfErr.code = 'EMAIL_NOT_CONFIRMED';
            unconfErr.field = 'email';
            throw unconfErr;
          }
          if (lower.includes('invalid login credentials') || (error as any).code === 'invalid_credentials') {
            const failure: any = new Error(strings.errors.wrongCredentials);
            failure.code = 'INVALID_CREDENTIALS';
            try {
              const result = await callLoginGuard('failure', normalizedEmail);
              if (result.locked) throw createLockedError(result);
              failure.attempts_left = result.attempts_left;
            } catch (guardError: any) {
              if (guardError?.code === 'ACCOUNT_LOCKED') throw guardError;
              // Preserve the generic credential error when recording an attempt is unavailable.
            }
            throw failure;
          }
          throw error;
        }

        try {
          await callLoginGuard('success', normalizedEmail);
          await sessionService.startSession();
        } catch (sessionError) {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
          throw sessionError;
        }
        return data;
      } finally {
        signInInFlight = null;
      }
    })();

    return signInInFlight;
  },

  async signOut(options?: { scope?: 'local' | 'global' }) {
    if (signOutInFlight) {
      return signOutInFlight;
    }

    signOutInFlight = (async () => {
      // Start audit writes before clearing the local token. They are best-effort so an offline
      // device still exits immediately and clears its session and private cache.
      void (async () => {
        const currentSessionId = await sessionService.getCurrentSessionId();
        if (!currentSessionId) return;
        if (options?.scope === 'global') {
          await sessionService.endOtherSessions(currentSessionId);
        }
        await sessionService.endCurrentSession(options?.scope === 'global' ? 'revoked' : 'logout', currentSessionId);
      })().catch(() => undefined);

      try {
        // 1. Always clear local session first so logout works even when offline
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch (localErr: any) {
          console.warn('Supabase local signOut warning:', localErr?.message);
        }

        // 2. Best-effort global revoke when requested (never blocks local logout if offline)
        if (options?.scope === 'global') {
          try {
            await supabase.auth.signOut({ scope: 'global' });
          } catch {
            // Best-effort server revoke; local session is already cleared
          }
        }
      } finally {
        signOutInFlight = null;
      }
    })();

    return signOutInFlight;
  },

  async resetPassword(email: string) {
    if (resetPasswordInFlight) {
      return;
    }
    const normalizedEmail = normalizeEmail(email);
    const emailCheck = validateEmailInput(normalizedEmail);
    if (!emailCheck.valid) {
      const invalidErr: any = new Error(emailCheck.message || strings.auth.invalidEmailFormat);
      invalidErr.code = 'INVALID_EMAIL';
      invalidErr.field = 'email';
      throw invalidErr;
    }

    resetPasswordInFlight = true;
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: Linking.createURL('reset-password'),
      });
      if (error) {
        throw error;
      }
      return data;
    } finally {
      resetPasswordInFlight = false;
    }
  },

  async updatePassword({
    password,
    currentPassword,
    nonce,
    email = '',
    displayName = '',
  }: { password: string; currentPassword?: string; nonce?: string; email?: string; displayName?: string }) {
    if (updatePasswordInFlight) {
      const busyErr: any = new Error('Password update is already in progress.');
      busyErr.code = 'PASSWORD_UPDATE_IN_PROGRESS';
      throw busyErr;
    }
    this.assertPasswordPolicy(password, email, displayName);
    updatePasswordInFlight = true;
    try {
      const { data, error } = await supabase.auth.updateUser({
        password,
        ...(currentPassword ? { current_password: currentPassword } : {}),
        ...(nonce ? { nonce } : {}),
      });
      if (error) throw error;
      return data;
    } finally {
      updatePasswordInFlight = false;
    }
  },

  async requestPasswordReauthentication() {
    const { error } = await supabase.auth.reauthenticate();
    if (error) throw error;
  },

  async resendConfirmationEmail(email: string) {
    if (resendConfirmationInFlight) {
      return;
    }
    const normalizedEmail = normalizeEmail(email);
    const emailCheck = validateEmailInput(normalizedEmail);
    if (!emailCheck.valid) {
      const invalidErr: any = new Error(emailCheck.message || strings.auth.invalidEmailFormat);
      invalidErr.code = 'INVALID_EMAIL';
      invalidErr.field = 'email';
      throw invalidErr;
    }

    const elapsedSeconds = Math.floor((Date.now() - lastResendConfirmationAt) / 1000);
    if (lastResendConfirmationAt > 0 && elapsedSeconds < RESEND_CONFIRMATION_COOLDOWN_SECONDS) {
      const remaining = RESEND_CONFIRMATION_COOLDOWN_SECONDS - elapsedSeconds;
      const rateErr: any = new Error(`Too many tries. Please wait ${remaining} seconds.`);
      rateErr.code = 'RATE_LIMITED';
      rateErr.retryAfterSeconds = remaining;
      throw rateErr;
    }

    resendConfirmationInFlight = true;
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
      });
      if (error) {
        throw error;
      }
      lastResendConfirmationAt = Date.now();
    } finally {
      resendConfirmationInFlight = false;
    }
  },

  resetResendCooldownForTesting() {
    lastResendConfirmationAt = 0;
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

