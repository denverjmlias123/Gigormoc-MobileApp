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

  // Rich, calming tinted non-white aurora gradient baselines
  const baseGradient = isClient
    ? (['#CAD7EB', '#D8E4F5', '#C2D3EC'] as [string, string, string])
    : (['#CEDBF0', '#DCE8F7', '#C6D7EE'] as [string, string, string]);

  // Vibrant aurora ambient glow spheres
  const topGlowColor = isClient ? 'rgba(37, 99, 235, 0.22)' : 'rgba(79, 70, 229, 0.22)';
  const bottomGlowColor = 'rgba(16, 185, 129, 0.18)'; // Subtle emerald glow for verified growth & wealth
  const centerGlowColor = 'rgba(245, 158, 11, 0.14)'; // Soft warm amber sunset glow

  return (
    <View style={[styles.container, style]}>
      {/* 1. Base Rich Tinted Gradient Backdrop */}
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
                  ? ({ filter: 'blur(70px)', WebkitFilter: 'blur(70px)' } as any)
                  : { opacity: 0.75 }),
              },
            ]}
          />

          {/* Center-Right Warm Sunset Amber Sphere */}
          <View
            style={[
              styles.auroraSphere,
              styles.centerSphere,
              {
                backgroundColor: centerGlowColor,
                ...(Platform.OS === 'web'
                  ? ({ filter: 'blur(80px)', WebkitFilter: 'blur(80px)' } as any)
                  : { opacity: 0.6 }),
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
                  ? ({ filter: 'blur(75px)', WebkitFilter: 'blur(75px)' } as any)
                  : { opacity: 0.7 }),
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
    width: 280,
    height: 280,
  },
  centerSphere: {
    top: '38%',
    right: -60,
    width: 250,
    height: 250,
  },
  bottomSphere: {
    bottom: 50,
    left: -50,
    width: 300,
    height: 300,
  },
});
