import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { authService, Profile } from '../services/auth';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const clearAuth = async () => {
    try {
      await supabase.removeAllChannels();
    } catch {
      // Ignore
    }
    try {
      await authService.signOut();
    } catch {
      // Ignore
    }
    try {
      await AsyncStorage.clear();
    } catch {
      // Ignore
    }
    if (typeof window !== 'undefined' && window?.localStorage) {
      try {
        Object.keys(window.localStorage).forEach((key) => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            window.localStorage.removeItem(key);
          }
        });
      } catch {
        // Ignore
      }
    }
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const syncUserState = async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      // 1. Verify user with Supabase server (in case user was deleted in Supabase)
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        // User was deleted from Supabase Auth or token is invalid
        await clearAuth();
        setLoading(false);
        return;
      }

      setSession(currentSession);
      setUser(userData.user);

      // 2. Fetch profile from database
      const p = await authService.getCurrentProfile(userData.user.id);
      if (!p) {
        // User exists in auth but profile was deleted or missing -> stale/deleted account
        await clearAuth();
        setLoading(false);
        return;
      }

      setProfile(p);
    } catch (err: any) {
      const isAuthError =
        err?.status === 401 ||
        err?.status === 403 ||
        err?.code === 'PGRST301' ||
        err?.message?.toLowerCase().includes('jwt') ||
        err?.message?.toLowerCase().includes('sub claim') ||
        err?.message?.toLowerCase().includes('user not found');

      if (isAuthError) {
        await clearAuth();
      } else {
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      syncUserState(s);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT' || !s) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else {
        await syncUserState(s);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) {
      try {
        const p = await authService.getCurrentProfile(user.id);
        if (!p) {
          await clearAuth();
        } else {
          setProfile(p);
        }
      } catch (err: any) {
        const isAuthError =
          err?.status === 401 ||
          err?.status === 403 ||
          err?.code === 'PGRST301' ||
          err?.message?.toLowerCase().includes('jwt') ||
          err?.message?.toLowerCase().includes('sub claim') ||
          err?.message?.toLowerCase().includes('user not found');
        if (isAuthError) {
          await clearAuth();
        }
      }
    }
  };

  const signOut = async () => {
    await clearAuth();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
