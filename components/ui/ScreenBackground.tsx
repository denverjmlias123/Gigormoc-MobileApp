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

  // Primary atmospheric gradient: seamless, soothing transition across slate, sky, and calm periwinkle
  const baseGradient = isClient
    ? (['#C6D6EA', '#D2E1F3', '#C2D4EB', '#C8D7EC'] as [string, string, string, string])
    : (['#C9DAEF', '#D5E4F5', '#C8DCF0', '#CBDDF2'] as [string, string, string, string]);

  // Ambient cross-wash: continuous GPU gradient interpolation with ZERO hard circular edges
  const ambientWash = isClient
    ? (['rgba(37, 99, 235, 0.12)', 'rgba(245, 158, 11, 0.06)', 'transparent', 'rgba(16, 185, 129, 0.10)'] as [string, string, string, string])
    : (['rgba(79, 70, 229, 0.12)', 'rgba(245, 158, 11, 0.06)', 'transparent', 'rgba(16, 185, 129, 0.10)'] as [string, string, string, string]);

  // Secondary soft ambient mist layer for depth
  const mistWash = [
    'transparent',
    'rgba(195, 215, 240, 0.15)',
    'rgba(175, 200, 230, 0.25)',
  ] as [string, string, string];

  return (
    <View style={[styles.container, style]}>
      {/* 1. Base Continuous Ambient Gradient */}
      <LinearGradient
        colors={baseGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 2. Soft Continuous Atmospheric Color Wash (Zero hard disks/edges) */}
      {aurora && (
        <>
          <LinearGradient
            colors={ambientWash}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={mistWash}
            start={{ x: 0.5, y: 0.3 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
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
});
