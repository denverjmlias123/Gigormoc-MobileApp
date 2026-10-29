import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Platform,
  ScrollView,
  useWindowDimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, lightFreelancerTheme, useResponsiveLayout } from '../theme';
import { useAuth } from '../../hooks/useAuth';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const USE_NATIVE = Platform.OS !== 'web';
const gradient = (value: string, fallback: string) =>
  ({ backgroundColor: fallback, backgroundImage: value, experimental_backgroundImage: value } as any);

const BRAND = 'linear-gradient(135deg, #3A5DFF 0%, #7C5CFF 100%)';
const INK = 'linear-gradient(165deg, #0E1A5C 0%, #070B26 62%)';

/** Gentle fade + rise on mount, staggered by `delay`. */
function useEntrance(delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 650,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE,
    }).start();
  }, [v, delay]);
  return {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  };
}

// Animated preview cards
function GigPreview({ compact }: { compact?: boolean }) {
  const c = lightFreelancerTheme.colors;
  return (
    <View style={[styles.glassCard, compact && { padding: 14 }]}>
      <View style={styles.rowBetween}>
        <View style={[styles.tag, { backgroundColor: c.primarySoft }]}>
          <Text style={[styles.tagText, { color: c.primary }]}>Home services</Text>
        </View>
        <View style={styles.openDot}>
          <View style={styles.openDotInner} />
          <Text style={styles.openText}>Open</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>Aircon cleaning, 2 units</Text>
      <Text style={styles.cardPrice}>₱1,200 – ₱1,800</Text>
      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <Ionicons name="location-outline" size={14} color="#5C6788" />
          <Text style={styles.metaText}>Cogon, Ormoc</Text>
        </View>
        <View style={styles.meta}>
          <Ionicons name="time-outline" size={14} color="#5C6788" />
          <Text style={styles.metaText}>Apply by Oct 20</Text>
        </View>
      </View>
    </View>
  );
}

function ProposalPreview() {
  return (
    <View style={[styles.glassCard, styles.smallCard]}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>MS</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.smallTitle}>Maria S. sent a proposal</Text>
        <View style={styles.meta}>
          <Ionicons name="star" size={12} color="#FFB524" />
          <Text style={styles.metaText}>4.9 · 32 gigs done</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#8A94B5" />
    </View>
  );
}

function MilestonePreview() {
  return (
    <View style={[styles.glassCard, styles.smallCard, { backgroundColor: '#12C48B', borderColor: 'rgba(255,255,255,0.35)' }]}>
      <View style={[styles.avatarCircle, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.smallTitle, { color: '#FFFFFF' }]}>Milestone approved</Text>
        <Text style={[styles.metaText, { color: '#D9FFF0' }]}>₱900 confirmed received</Text>
      </View>
    </View>
  );
}

function Showcase({ wide }: { wide: boolean }) {
  const enter = useEntrance(250);

  return (
    <Animated.View style={[{ width: '100%', maxWidth: 460, alignSelf: 'center', gap: 12 }, enter]}>
      <GigPreview compact={!wide} />
      <ProposalPreview />
      <MilestonePreview />
    </Animated.View>
  );
}

function PrimaryCta({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed, hovered }: any) => [
        styles.cta,
        {
          backgroundColor: '#2563EB',
          borderRadius: 12,
        },
        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
        hovered && { opacity: 0.94 },
        pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] },
      ]}
    >
      <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
      <Text style={styles.ctaText}>{title}</Text>
      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
    </Pressable>
  );
}

function GhostCta({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed, hovered }: any) => [
        styles.cta,
        styles.ghost,
        { borderRadius: 12 },
        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
        hovered && { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.36)' },
        pressed && { backgroundColor: 'rgba(255,255,255,0.18)' },
      ]}
    >
      <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
      <Text style={styles.ctaText}>{title}</Text>
    </Pressable>
  );
}

const trust: { icon: IconName; label: string }[] = [
  { icon: 'shield-checkmark-outline', label: 'Adults 18+ only' },
  { icon: 'location-outline', label: 'Ormoc City locals' },
  { icon: 'wallet-outline', label: 'Pay by milestone' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { authNotice, clearAuthNotice } = useAuth();
  const { width } = useWindowDimensions();
  const { topSpace, bottomSpace } = useResponsiveLayout();
  const wide = width >= theme.layout.wideBreakpoint;

  const eBrand = useEntrance(0);
  const eHead = useEntrance(120);
  const eActions = useEntrance(380);

  const goSignup = () => {
    clearAuthNotice();
    router.push('/(auth)/signup-step1');
  };
  const goLogin = () => {
    clearAuthNotice();
    router.push('/(auth)/login');
  };

  const copy = (
    <View style={wide ? styles.copyWide : undefined}>
      <Animated.View style={[styles.brandRow, eBrand]}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logoMark}
          resizeMode="contain"
          accessibilityLabel="Gigormoc logo"
        />
        <Text style={styles.brand}>Gigormoc</Text>
      </Animated.View>

      <Animated.View style={eHead}>
        <View style={styles.pill}>
          <Ionicons name="location" size={13} color="#9FB2FF" />
          <Text style={styles.pillText}>Made for Ormoc City</Text>
        </View>
        <Text style={[styles.headline, wide && styles.headlineWide]}>
          Good work,{'\n'}
          <Text style={styles.headlineAccent}>close to home.</Text>
        </Text>
        <Text style={styles.sub}>
          Find gigs from Ormoc clients, or hire trusted local freelancers — chat, agree on milestones and get paid, all in one place.
        </Text>
      </Animated.View>
    </View>
  );

  const actions = (
    <Animated.View style={[styles.actions, wide && styles.actionsWide, eActions]}>
      {authNotice ? (
        <Pressable onPress={clearAuthNotice} accessibilityRole="alert" style={styles.notice}>
          <Ionicons name="information-circle" size={18} color="#9FB2FF" />
          <Text style={styles.noticeText}>{authNotice}</Text>
          <Ionicons name="close" size={16} color="#9FB2FF" />
        </Pressable>
      ) : null}
      <View style={wide ? styles.ctaRowWide : styles.ctaCol}>
        <View style={wide ? { flex: 1 } : undefined}>
          <PrimaryCta title="Create account" onPress={goSignup} />
        </View>
        <View style={wide ? { flex: 1 } : undefined}>
          <GhostCta title="Log in" onPress={goLogin} />
        </View>
      </View>
      <View style={styles.trustRow}>
        {trust.map((t) => (
          <View key={t.label} style={styles.trustItem}>
            <Ionicons name={t.icon} size={15} color="#9FB2FF" />
            <Text style={styles.trustText}>{t.label}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.root, { backgroundColor: '#070B26' }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: wide ? 48 : topSpace + 12, paddingBottom: wide ? 48 : bottomSpace + 16 },
          wide && styles.scrollWide,
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {wide ? (
          <View style={styles.wideGrid}>
            <View style={styles.wideLeft}>
              {copy}
              {actions}
            </View>
            <View style={styles.wideRight}>
              <Showcase wide />
            </View>
          </View>
        ) : (
          <View style={styles.mobileCol}>
            {copy}
            <View style={{ marginTop: 24 }}>
              <Showcase wide={false} />
            </View>
            {actions}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 9999, ...(Platform.OS === 'web' ? ({ filter: 'blur(70px)' } as any) : null) },
  scroll: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center' },
  scrollWide: { paddingHorizontal: 56 },
  mobileCol: { width: '100%', maxWidth: 460, alignSelf: 'center', flexGrow: 1, justifyContent: 'space-between' },
  wideGrid: { flexDirection: 'row', alignItems: 'center', gap: 56, width: '100%', maxWidth: 1120, alignSelf: 'center' },
  wideLeft: { flex: 1.05 },
  wideRight: { flex: 0.95 },
  copyWide: { marginBottom: 8 },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32 },
  logoMark: { width: 40, height: 40 },
  brand: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: 'rgba(159,178,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(159,178,255,0.24)',
    marginBottom: 16,
  },
  pillText: { color: '#C9D4FF', fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  headline: { color: '#FFFFFF', fontSize: 40, lineHeight: 46, fontWeight: '800', letterSpacing: -1.2 },
  headlineWide: { fontSize: 56, lineHeight: 62, letterSpacing: -1.8 },
  headlineAccent: { color: '#8FA6FF' },
  sub: { color: '#AEB9E3', fontSize: 16, lineHeight: 24, fontWeight: '400', marginTop: 14, maxWidth: 460 },

  actions: { marginTop: 32, gap: 16 },
  actionsWide: { marginTop: 36, maxWidth: 460 },
  ctaCol: { gap: 12 },
  ctaRowWide: { flexDirection: 'row', gap: 12 },
  cta: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: -0.1 },
  ghost: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8, marginTop: 4 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { color: '#8E9BC9', fontSize: 13, fontWeight: '500' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(159,178,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(159,178,255,0.3)',
  },
  noticeText: { flex: 1, color: '#E3E9FF', fontSize: 13, fontWeight: '500' },

  // Preview cards
  abs: { position: 'absolute' },
  glassCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  smallCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  tagText: { fontSize: 11, fontWeight: '700' },
  openDot: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  openDotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#12C48B' },
  openText: { color: '#0D7A58', fontSize: 12, fontWeight: '700' },
  cardTitle: { color: '#0C1233', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  cardPrice: {
    color: '#2563EB',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginVertical: 4,
    fontVariant: ['tabular-nums'],
  },
  metaRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#5C6788', fontSize: 12, fontWeight: '500' },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8EDFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#2F55F4', fontWeight: '700', fontSize: 13 },
  smallTitle: { color: '#0C1233', fontSize: 14, fontWeight: '600', marginBottom: 2 },
});
