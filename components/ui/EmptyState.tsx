import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../app/theme';
import { Button } from './Button';
import { Card } from './Card';

interface EmptyStateProps {
  title: string;
  description: string;
  actionTitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Ionicons name. Legacy emoji values are ignored in favor of the default. */
  icon?: React.ComponentProps<typeof Ionicons>['name'] | string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionTitle,
  actionLabel,
  onAction,
  icon,
}) => {
  const theme = useAppTheme();
  const resolvedActionTitle = actionTitle || actionLabel;
  const iconName = (typeof icon === 'string' && /^[a-z0-9-]+$/.test(icon)
    ? icon
    : 'albums-outline') as any;

  return (
    <Card
      tone="neo-glass"
      padding="lg"
      style={[
        styles.container,
        {
          borderColor: theme.colors.borderStrong,
          borderStyle: 'dashed',
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: theme.colors.primarySoft,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Ionicons name={iconName} size={28} color={theme.colors.primary} />
      </View>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: theme.colors.muted }]}>{description}</Text>
      {resolvedActionTitle && onAction && (
        <Button
          title={resolvedActionTitle}
          onPress={onAction}
          variant="primary"
          size="md"
          rightIcon="arrow-forward"
        />
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 14,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
    maxWidth: 420,
  },
});
