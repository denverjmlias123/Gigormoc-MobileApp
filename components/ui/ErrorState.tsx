import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../app/theme';
import { Button } from './Button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'An error occurred while loading data. Please try again.',
  onRetry,
}) => {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={[styles.title, { color: theme.colors.danger }]}>Something went wrong</Text>
      <Text style={[styles.message, { color: '#991B1B' }]}>{message}</Text>
      {onRetry && (
        <Button
          title="Try Again"
          onPress={onRetry}
          variant="danger"
          style={styles.retryBtn}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: 16,
  },
  icon: {
    fontSize: 32,
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    minHeight: 40,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
});
