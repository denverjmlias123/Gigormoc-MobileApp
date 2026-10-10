import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../app/theme';
import { Button } from './Button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'We couldn\'t load this. Check your connection and try again.',
  onRetry,
}) => {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.dangerSoft, borderRadius: theme.radii.card }]}>
      <Ionicons name="cloud-offline-outline" size={32} color={theme.colors.dangerText} style={styles.icon} />
      <Text style={[styles.title, { color: theme.colors.dangerText }]}>Something went wrong</Text>
      <Text style={[styles.message, { color: theme.colors.dangerText }]}>{message}</Text>
      {onRetry && <Button title="Try again" onPress={onRetry} variant="danger" style={styles.retryBtn} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: 'center', marginVertical: 16 },
  icon: { marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  retryBtn: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 22 },
});
