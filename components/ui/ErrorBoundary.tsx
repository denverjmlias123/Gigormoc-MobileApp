import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createRequestId } from '../../lib/errors';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  requestId: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      requestId: '',
    };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return {
      hasError: true,
      requestId: createRequestId(),
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[ErrorBoundary ${this.state.requestId}] Unhandled UI error:`, error, info.componentStack);
  }

  handleReload = (): void => {
    this.setState({ hasError: false, requestId: '' });
    if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
      window.location.reload();
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container} accessibilityRole="alert">
          <View style={styles.card}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              We ran into an unexpected display issue. Your data is safe—please reload to continue.
            </Text>
            {Boolean(this.state.requestId) && (
              <Text style={styles.refCode}>Support ID: {this.state.requestId}</Text>
            )}
            <Button title="Something went wrong. Reload" onPress={this.handleReload} variant="primary" />
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#DDE7F5',
  },
  card: {
    maxWidth: 420,
    width: '100%',
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#E5EEFA',
    borderWidth: 1,
    borderColor: '#BFD0E8',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 12,
  },
  refCode: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 20,
  },
});
