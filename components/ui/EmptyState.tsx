import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../app/theme';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionTitle?: string;
  onAction?: () => void;
  /** Ionicons name. Legacy emoji values are ignored in favor of the default. */
  icon?: React.ComponentProps<typeof Ionicons>['name'] | string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionTitle,
  onAction,
  icon,
}) => {
  const theme = useAppTheme();
  const iconName = (typeof icon === 'string' && /^[a-z0-9-]+$/.test(icon) ? icon : 'albums-outline') as any;

  return (
    <View style={[styles.container, { borderColor: theme.colors.borderStrong, borderRadius: theme.radii.card }]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primarySoft }]}>
        <Ionicons name={iconName} size={28} color={theme.colors.primary} />
      </View>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: theme.colors.muted }]}>{description}</Text>
      {actionTitle && onAction && (
        <Button title={actionTitle} onPress={onAction} variant="primary" style={styles.actionBtn} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 28,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginVertical: 16,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  description: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  actionBtn: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 22 },
});
