import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '../../app/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** 'neo-glass' combines hardware optical blur with soft ambient depth; 'raised' floats on a soft shadow; 'outline' is flat with a border; 'gradient' uses a subtle frosted gradient. */
  tone?: 'neo-glass' | 'raised' | 'outline' | 'gradient';
}

export const Card: React.FC<CardProps> = ({ children, style, tone = 'neo-glass' }) => {
  const theme = useAppTheme();

  if (tone === 'gradient') {
    return (
      <LinearGradient
        colors={theme.gradients.surface}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.card,
          {
            borderRadius: theme.radii.card,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.glass.border,
          },
          theme.shadow.neoGlass,
          style,
        ]}
      >
        {children}
      </LinearGradient>
    );
  }

  if (tone === 'neo-glass') {
    return (
      <BlurView
        intensity={Platform.OS === 'ios' ? 50 : 35}
        tint="light"
        style={[
          styles.card,
          {
            backgroundColor: theme.glass.surface,
            borderColor: theme.glass.border,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: theme.radii.card,
            overflow: 'hidden',
          },
          theme.shadow.neoGlass,
          style,
        ]}
      >
        {children}
      </BlurView>
    );
  }

  const toneStyle =
    tone === 'raised'
      ? [{ backgroundColor: theme.colors.surface }, theme.shadow.card]
      : [{ backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }];

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: theme.radii.card,
        },
        ...toneStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 18,
    marginBottom: 12,
  },
});
