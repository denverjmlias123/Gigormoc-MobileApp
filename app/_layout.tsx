import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useAppTheme } from './theme';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { OfflineBanner } from '../components/ui/OfflineBanner';
import { ToastProvider } from '../components/ui/Toast';
import { ConfirmDialogProvider } from '../components/ui/ConfirmDialog';

function RootNavigation() {
  const { user, profile, loading, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const theme = useAppTheme();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

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
      if (!profile.onboarding_complete) {
        if (!inOnboardingGroup) {
          router.replace('/(onboarding)/step1-mode');
        }
      } else {
        if (inAuthGroup || inOnboardingGroup) {
          router.replace('/(tabs)');
        }
      }
    }
  }, [user, profile, loading, segments]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
