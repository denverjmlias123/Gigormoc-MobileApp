import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ScreenBackground } from '../../components/ui/ScreenBackground';
import { useAuth } from '../../hooks/useAuth';

export default function OnboardingLayout() {
  const { user, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // 1. If not authenticated, bounce to welcome (defensive guard)
    if (!user) {
      router.replace('/(auth)/welcome');
      return;
    }

    // 2. If onboarding is already completed, bounce to tabs
    if (profile?.onboarding_complete) {
      router.replace('/(tabs)');
      return;
    }

    // 3. Sequential sub-guard: Step 2 and Step 3 require active_mode to be selected
    const inStep2Or3 = (segments as string[]).includes('step2-skills') || (segments as string[]).includes('step3-profile');
    if (!profile?.active_mode && inStep2Or3) {
      router.replace('/(onboarding)/step1-mode');
    }
  }, [user, profile, loading, segments, router]);

  return (
    <ScreenBackground style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </ScreenBackground>
  );
}


