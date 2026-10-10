import { supabase } from '../lib/supabase';

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
  bio: string | null;
  avatar_path: string | null;
  area: string | null;
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
}

export const authService = {
  async signUp({ email, password, displayName, dob, termsVersion = 'v1.0' }: SignUpParams) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          dob,
          terms_version: termsVersion,
        },
      },
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async signIn({ email, password }: SignInParams) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
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
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
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

  async updateProfile(userId: string, updates: Partial<Pick<Profile, 'display_name' | 'bio' | 'avatar_path' | 'area' | 'onboarding_complete'>>) {
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

