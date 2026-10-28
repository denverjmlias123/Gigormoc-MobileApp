import React from 'react';
import { Stack } from 'expo-router';
import { ScreenBackground } from '../../components/ui/ScreenBackground';

export default function OnboardingLayout() {
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

