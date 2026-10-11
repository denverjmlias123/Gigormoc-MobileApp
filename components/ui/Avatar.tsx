import React, { useState, useEffect } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../app/theme';

interface AvatarProps {
  name?: string | null;
  imageUri?: string | null;
  size?: number;
  onHero?: boolean;
  onPress?: () => void;
  editable?: boolean;
}

/** Avatar component showing uploaded photo if present, otherwise initials (never stock faces). */
export const Avatar: React.FC<AvatarProps> = ({
  name,
  imageUri,
  size = 44,
  onHero = false,
  onPress,
  editable = false,
}) => {
  const theme = useAppTheme();
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [imageUri]);

  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

  const content = (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {imageUri && imageUri.trim() !== '' && !imgError ? (
        <Image
          key={imageUri}
          source={{ uri: imageUri }}
          onError={() => setImgError(true)}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: onHero ? 2 : 1,
            borderColor: onHero ? theme.colors.heroChip : theme.colors.border,
          }}
          accessibilityLabel={name ? `${name}'s profile photo` : 'Profile photo'}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: onHero ? theme.colors.heroChip : theme.colors.primarySoft,
          }}
          accessibilityLabel={name ? `${name}'s initials avatar` : 'Initials avatar'}
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
      )}

      {editable ? (
        <View
          style={[
            styles.cameraBadge,
            {
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.surface,
            },
          ]}
        >
          <Ionicons name="camera" size={14} color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
        hitSlop={8}
      >
        {content}
      </Pressable>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
