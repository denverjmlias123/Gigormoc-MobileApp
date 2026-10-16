import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../app/theme';

interface ScreenBackgroundProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  /** Whether to show the aurora ambient color mesh (default true) */
  aurora?: boolean;
}

export const ScreenBackground: React.FC<ScreenBackgroundProps> = ({
  children,
  style,
  aurora = true,
}) => {
  const theme = useAppTheme();
  const isClient = theme.isClient;

  // Base background palette: subtle pastel gradient transitions instead of stark plain white
  const baseGradient = isClient
    ? (['#EDF2FC', '#F8FAFE', '#E8EEF9'] as [string, string, string])
    : (['#EEF3FF', '#F9FAFE', '#E9F0FD'] as [string, string, string]);

  // Aurora sphere tones
  const topGlowColor = isClient ? 'rgba(42, 71, 201, 0.13)' : 'rgba(79, 70, 229, 0.14)';
  const bottomGlowColor = 'rgba(16, 185, 129, 0.10)'; // Subtle emerald glow for verified growth & wealth

  return (
    <View style={[styles.container, style]}>
      {/* 1. Base Aurora Gradient Backdrop */}
      <LinearGradient
        colors={baseGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 2. Ambient Aurora Floating Light Spheres */}
      {aurora && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Top-Right Soft Indigo/Cobalt Sphere */}
          <View
            style={[
              styles.auroraSphere,
              styles.topSphere,
              {
                backgroundColor: topGlowColor,
                ...(Platform.OS === 'web'
                  ? ({ filter: 'blur(64px)', WebkitFilter: 'blur(64px)' } as any)
                  : { opacity: 0.7 }),
              },
            ]}
          />

          {/* Bottom-Left Soft Mint/Emerald Sphere */}
          <View
            style={[
              styles.auroraSphere,
              styles.bottomSphere,
              {
                backgroundColor: bottomGlowColor,
                ...(Platform.OS === 'web'
                  ? ({ filter: 'blur(72px)', WebkitFilter: 'blur(72px)' } as any)
                  : { opacity: 0.6 }),
              },
            ]}
          />
        </View>
      )}

      {/* 3. Screen Content */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  auroraSphere: {
    position: 'absolute',
    borderRadius: 9999,
  },
  topSphere: {
    top: -50,
    right: -40,
    width: 260,
    height: 260,
  },
  bottomSphere: {
    bottom: 60,
    left: -50,
    width: 280,
    height: 280,
  },
});
