import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, clientTheme } from '../theme';
import { Button } from '../../components/ui/Button';

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const navy = clientTheme.colors.heroBg;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Brand panel: navy, anchored to the top, rounded where it meets the form */}
      <View style={[styles.hero, { backgroundColor: navy }]}>
        <View style={styles.brandRow}>
          <View style={[styles.mark, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="flash" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.brand}>Gigormoc</Text>
        </View>

        <Text style={styles.headline}>Good work, close to home.</Text>
        <Text style={styles.sub}>
          Find gigs from Ormoc City clients, or hire local freelancers. Adults 18+ only.
        </Text>

        <View style={styles.pair}>
          <View style={[styles.pairCard, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="search" size={20} color="#FFFFFF" />
            <Text style={styles.pairTitle}>Find work</Text>
            <Text style={styles.pairText}>Browse gigs and send proposals</Text>
          </View>
          <View style={[styles.pairCard, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <Ionicons name="people" size={20} color="#FFFFFF" />
            <Text style={styles.pairTitle}>Hire talent</Text>
            <Text style={styles.pairText}>Post a gig and pick a freelancer</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Button title="Create account" onPress={() => router.push('/(auth)/signup-step1')} />
        <Button title="Log in" variant="secondary" onPress={() => router.push('/(auth)/login')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    flex: 1,
    paddingTop: 72,
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  headline: { color: '#FFFFFF', fontSize: 38, lineHeight: 44, fontWeight: '800', letterSpacing: -1, marginTop: 32 },
  sub: { color: '#AFC2E8', fontSize: 16, lineHeight: 23, marginTop: 12, maxWidth: 320 },
  pair: { flexDirection: 'row', gap: 12, marginTop: 32 },
  pairCard: { flex: 1, borderRadius: 20, padding: 16, gap: 4 },
  pairTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginTop: 6 },
  pairText: { color: '#D6E2FF', fontSize: 13, lineHeight: 18 },
  actions: { padding: 24, paddingBottom: 36, gap: 12 },
});
