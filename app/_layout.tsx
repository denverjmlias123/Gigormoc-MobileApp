import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, AppState, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useAppTheme } from './theme';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { OfflineBanner } from '../components/ui/OfflineBanner';
import { ToastProvider } from '../components/ui/Toast';
import { ConfirmDialogProvider } from '../components/ui/ConfirmDialog';
import { sessionService } from '../services/sessions';

function RootNavigation() {
  const { user, profile, loading, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const theme = useAppTheme();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const inAdminGroup = segments[0] === 'admin';
    const inPasswordReset = inAuthGroup && (segments.includes('reset-password') || segments.includes('forgot-password'));

    // Recovery links establish a temporary authenticated session so the user can set a new password.
    if (inPasswordReset) return;

    if (!user) {
      // User is not authenticated -> route to welcome if trying to access tabs or onboarding
      if (!inAuthGroup) {
        router.replace('/(auth)/welcome');
      }
    } else if (!profile) {
      // User session exists locally but profile was deleted or is missing
      if (!inAuthGroup) {
        signOut().catch(() => {});
        router.replace('/(auth)/welcome');
      }
    } else {
      // User is authenticated and profile exists
      if (profile.must_change_password) {
        if (segments[0] !== 'settings' || !segments.includes('password')) router.replace('/settings/password');
      } else if (!profile.onboarding_complete) {
        if (!inOnboardingGroup) {
          router.replace('/(onboarding)/step1-mode');
        }
      } else {
        if ((inAuthGroup || inOnboardingGroup) && !inAdminGroup) {
          router.replace('/(tabs)');
        }
      }
    }
  }, [user, profile, loading, segments]);

  useEffect(() => {
    if (!user?.id) return;
    let checking = false;
    const checkSession = async () => {
      if (checking) return;
      checking = true;
      try {
        const active = await sessionService.heartbeat();
        if (!active) await signOut({ reason: 'session_expired' });
      } catch {
        // A temporary network issue should not log the user out. The next heartbeat retries.
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(() => { void checkSession(); }, 5 * 60 * 1000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkSession();
    });
    return () => {
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [user?.id]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && user?.id) {
      const onWebActivity = () => {
        void sessionService.noteActivity().catch(() => undefined);
      };
      window.addEventListener('pointerdown', onWebActivity, { passive: true });
      window.addEventListener('keydown', onWebActivity, { passive: true });
      return () => {
        window.removeEventListener('pointerdown', onWebActivity);
        window.removeEventListener('keydown', onWebActivity);
      };
    }
  }, [user?.id]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
            const target = mutation.target as HTMLElement;
            if (target && target.getAttribute('aria-hidden') === 'true') {
              const active = document.activeElement as HTMLElement | null;
              if (active && target.contains(active)) {
                active.blur?.();
              }
            }
          }
        }
      });
      observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['aria-hidden'] });
      return () => observer.disconnect();
    }
  }, []);

  const recordSessionActivity = () => {
    if (user?.id) void sessionService.noteActivity().catch(() => undefined);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root} onTouchStart={recordSessionActivity}>
      <StatusBar style="dark" />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <ConfirmDialogProvider>
              <RootNavigation />
            </ConfirmDialogProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
