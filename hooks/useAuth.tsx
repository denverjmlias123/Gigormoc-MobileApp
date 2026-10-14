import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, registerSessionExpiredHandler } from '../lib/supabase';
import { performSharedCleanup } from '../lib/sessionCleanup';
import { authService, Profile } from '../services/auth';
import { strings } from '../constants/strings';
import { sessionService } from '../services/sessions';

export interface SignOutOptions {
  scope?: 'local' | 'global';
  reason?: 'user' | 'session_expired';
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  authNotice: string | null;
  clearAuthNotice: () => void;
  refreshProfile: () => Promise<Profile | null>;
  signOut: (options?: SignOutOptions) => Promise<void>;
  runSharedCleanup: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  authNotice: null,
  clearAuthNotice: () => {},
  refreshProfile: async () => null,
  signOut: async () => {},
  runSharedCleanup: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const signOutInFlightRef = useRef<Promise<void> | null>(null);
  const hadActiveSessionRef = useRef<boolean>(false);
  const handledSignedOutRef = useRef<boolean>(false);

  const clearAuthNotice = () => setAuthNotice(null);

  const runSharedCleanup = async () => {
    try {
      await supabase.removeAllChannels();
    } catch {
      // Ignore
    }
    await performSharedCleanup({ clearAuthStorage: false });
  };

  const clearAuth = async (options?: SignOutOptions) => {
    if (signOutInFlightRef.current) {
      return signOutInFlightRef.current;
    }

    signOutInFlightRef.current = (async () => {
      try {
        handledSignedOutRef.current = true;
        try {
          await supabase.removeAllChannels();
        } catch {
          // Ignore
        }
        try {
          await authService.signOut({ scope: options?.scope ?? 'local' });
        } catch {
          // Ignore
        }
        await performSharedCleanup({ clearAuthStorage: true });

        setSession(null);
        setUser(null);
        setProfile(null);

        if (options?.reason === 'session_expired') {
          setAuthNotice(strings.errors.sessionExpired);
        } else if (hadActiveSessionRef.current) {
          setAuthNotice(strings.errors.loggedOutNotice);
        }
        hadActiveSessionRef.current = false;
      } finally {
        signOutInFlightRef.current = null;
      }
    })();

    return signOutInFlightRef.current;
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
        await clearAuth({ reason: 'session_expired' });
        setLoading(false);
        return;
      }

      // 2. Fetch profile from database before setting session/user so there is no flash of stale data
      const p = await authService.getCurrentProfile(userData.user.id);
      if (!p || p.status === 'suspended' || p.status === 'deactivated' || p.status === 'deleted') {
        await clearAuth({ reason: 'user' });
        if (p && (p.status === 'suspended' || p.status === 'deactivated' || p.status === 'deleted')) {
          setAuthNotice(strings.errors.accountSuspended);
        }
        setLoading(false);
        return;
      }

      const sessionActive = await sessionService.ensureCurrentSession();
      if (!sessionActive) {
        await clearAuth({ reason: 'session_expired' });
        setLoading(false);
        return;
      }

      hadActiveSessionRef.current = true;
      handledSignedOutRef.current = false;
      setSession(currentSession);
      setUser(userData.user);
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
        await clearAuth({ reason: 'session_expired' });
      } else {
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    registerSessionExpiredHandler(async () => {
      if (!mounted) return;
      await clearAuth({ reason: 'session_expired' });
    });

    // Check initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      syncUserState(s);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT' || !s) {
        if (!handledSignedOutRef.current && hadActiveSessionRef.current) {
          handledSignedOutRef.current = true;
          hadActiveSessionRef.current = false;
          await performSharedCleanup({ clearAuthStorage: true });
          setAuthNotice(strings.errors.loggedOutNotice);
        }
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
      registerSessionExpiredHandler(null);
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async (): Promise<Profile | null> => {
    const activeUserId = user?.id || session?.user?.id;
    if (!activeUserId) {
      return null;
    }
    try {
      const p = await authService.getCurrentProfile(activeUserId);
      if (!p) {
        await clearAuth({ reason: 'user' });
        return null;
      }
      setProfile(p);
      return p;
    } catch (err: any) {
      const isAuthError =
        err?.status === 401 ||
        err?.status === 403 ||
        err?.code === 'PGRST301' ||
        err?.message?.toLowerCase().includes('jwt') ||
        err?.message?.toLowerCase().includes('sub claim') ||
        err?.message?.toLowerCase().includes('user not found');
      if (isAuthError) {
        await clearAuth({ reason: 'session_expired' });
      }
      return null;
    }
  };

  const signOut = async (options?: SignOutOptions) => {
    await clearAuth(options);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        authNotice,
        clearAuthNotice,
        refreshProfile,
        signOut,
        runSharedCleanup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

