import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useAppTheme } from '../../app/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** 'raised' floats on a soft shadow; 'outline' is flat with a border. */
  tone?: 'raised' | 'outline';
}

export const Card: React.FC<CardProps> = ({ children, style, tone = 'raised' }) => {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.card,
        },
        tone === 'raised' ? theme.shadow.card : { borderWidth: 1, borderColor: theme.colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 12,
  },
});
