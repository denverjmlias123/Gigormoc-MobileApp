import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { adminService } from '../../services/admin';
import { strings } from '../../constants/strings';
import { Button } from '../../components/ui/Button';

export default function AdminLayout() {
  const theme = useAppTheme();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'allowed' | 'denied' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const check = useCallback(async () => {
    setState('loading');
    try {
      const allowed = await adminService.isAdmin();
      setState(allowed ? 'allowed' : 'denied');
      if (!allowed) router.replace('/(tabs)/profile');
    } catch {
      setState('error');
    }
  }, [router, attempt]);
  useEffect(() => { void check(); }, [check]);

  if (state !== 'allowed') return (
    <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
      {state === 'loading' ? <ActivityIndicator color={theme.colors.primary} /> : (
        <>
          <Text style={[theme.type.body, { color: theme.colors.text, textAlign: 'center' }]}>
            {state === 'denied' ? strings.admin.accessDenied : strings.errors.serverError}
          </Text>
          {state === 'error' ? <Button title={strings.admin.retry} onPress={() => setAttempt((n) => n + 1)} /> : null}
        </>
      )}
    </View>
  );
  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({ center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 } });
