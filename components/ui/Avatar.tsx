import React from 'react';
import { View, Text } from 'react-native';
import { useAppTheme } from '../../app/theme';

interface AvatarProps {
  name?: string | null;
  size?: number;
  onHero?: boolean;
}

/** Initials avatar. Photos are loaded by screens that already hold a signed URL. */
export const Avatar: React.FC<AvatarProps> = ({ name, size = 44, onHero = false }) => {
  const theme = useAppTheme();
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: onHero ? theme.colors.heroChip : theme.colors.primarySoft,
      }}
      accessibilityLabel={name ? `${name}'s avatar` : 'Avatar'}
    >
      <Text
        style={{
          fontSize: size * 0.38,
          fontWeight: '800',
          color: onHero ? theme.colors.heroText : theme.colors.primary,
        }}
      >
        {initials}
      </Text>
    </View>
  );
};
