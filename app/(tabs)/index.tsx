import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { gigsService } from '../../services/gigs';
import { GigCard, GigSummary } from '../../components/ui/GigCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { strings } from '../../constants/strings';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, profile } = useAuth();

  const isFindWork = profile?.active_mode === 'find_work';
  const isHire = profile?.active_mode === 'hire';

  const [availableGigs, setAvailableGigs] = useState<GigSummary[]>([]);
  const [myGigs, setMyGigs] = useState<GigSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHomeData = async () => {
    setLoading(true);
    try {
      if (isHire && user) {
        const gigs = await gigsService.getMyGigs(user.id);
        setMyGigs(gigs);
      } else {
        const gigs = await gigsService.getGigs();
        setAvailableGigs(gigs);
      }
    } catch {
      // Keep empty list on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomeData();
  }, [profile?.active_mode, user]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.greetingCol}>
          <Text style={[styles.greeting, { color: theme.colors.muted }]}>Maayong adlaw,</Text>
          <Text style={[styles.name, { color: theme.colors.text }]}>
            {profile?.display_name || user?.user_metadata?.display_name || 'Ormocanon'}
          </Text>
        </View>

        {/* Current Mode Label (No quick switch toggle per docs/DESIGN.md) */}
        <TouchableOpacity
          style={[styles.modePill, { backgroundColor: theme.colors.primarySoft }]}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.7}
        >
          <Text style={[styles.modePillText, { color: theme.colors.primary }]}>
            {isFindWork ? '🛠️ Find Work' : isHire ? '💼 Hire Someone' : 'Select Mode'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Banner if profile missing photo */}
        {!profile?.avatar_path && (
          <View style={[styles.banner, { backgroundColor: '#EFF6FF', borderColor: theme.colors.primarySoft }]}>
            <Text style={[styles.bannerText, { color: theme.colors.text }]}>
              💡 Complete your profile photo and skills to qualify for gig applications.
            </Text>
            <TouchableOpacity onPress={() => router.push('/profile/edit')}>
              <Text style={[styles.bannerAction, { color: theme.colors.primary }]}>Add Photo →</Text>
            </TouchableOpacity>
          </View>
        )}

        {isHire ? (
          /* Hire Someone Mode View */
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {strings.gigs.myGigs}
              </Text>
              <Button
                title="+ Post a Gig"
                onPress={() => router.push('/gigs/post')}
                variant="primary"
                style={styles.postBtn}
              />
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
            ) : myGigs.length === 0 ? (
              <EmptyState
                title={strings.gigs.noMyGigsTitle}
                description={strings.gigs.noMyGigsDesc}
                actionTitle={strings.gigs.postGig}
                onAction={() => router.push('/gigs/post')}
              />
            ) : (
              myGigs.map((gig) => (
                <GigCard
                  key={gig.id}
                  gig={gig}
                  onPress={() => router.push({ pathname: '/gigs/[id]', params: { id: gig.id } })}
                />
              ))
            )}
          </View>
        ) : (
          /* Find Work Mode View */
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {strings.gigs.availableGigs}
              </Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/gigs')}>
                <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 14 }}>
                  View All →
                </Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
            ) : availableGigs.length === 0 ? (
              <EmptyState
                title={strings.gigs.noGigsTitle}
                description={strings.gigs.noGigsDesc}
                actionTitle="Refresh Gigs"
                onAction={loadHomeData}
              />
            ) : (
              availableGigs.slice(0, 5).map((gig) => (
                <GigCard
                  key={gig.id}
                  gig={gig}
                  onPress={() => router.push({ pathname: '/gigs/[id]', params: { id: gig.id } })}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  greetingCol: {
    flex: 1,
  },
  greeting: {
    fontSize: 13,
    marginBottom: 2,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
  },
  modePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  banner: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  bannerText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  bannerAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  postBtn: {
    minHeight: 38,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
