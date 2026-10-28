import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
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

  // Primary atmospheric gradient: distinct role mood for Client (steady slate-navy) vs Freelancer (energetic sky-cobalt)
  const baseGradient = isClient
    ? (['#DCE5F2', '#E8EEF7', '#DFE7F4', '#E4ECF7'] as [string, string, string, string])
    : (['#DCEBFA', '#E6F1FC', '#DDF0FA', '#E3EFFB'] as [string, string, string, string]);

  // Ambient cross-wash: continuous GPU gradient interpolation with ZERO hard circular edges
  const ambientWash = isClient
    ? (['rgba(30, 58, 138, 0.12)', 'rgba(245, 158, 11, 0.08)', 'transparent', 'rgba(217, 119, 6, 0.07)'] as [string, string, string, string])
    : (['rgba(37, 99, 235, 0.12)', 'rgba(16, 185, 129, 0.09)', 'transparent', 'rgba(59, 130, 246, 0.08)'] as [string, string, string, string]);

  // Secondary soft ambient mist layer for depth
  const mistWash = isClient
    ? (['transparent', 'rgba(203, 213, 225, 0.18)', 'rgba(186, 200, 224, 0.26)'] as [string, string, string])
    : (['transparent', 'rgba(191, 219, 254, 0.18)', 'rgba(167, 243, 208, 0.18)'] as [string, string, string]);

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
