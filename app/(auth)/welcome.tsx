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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, lightFreelancerTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const USE_NATIVE = Platform.OS !== 'web';
// RN supports CSS-style gradients through backgroundImage on recent versions and web.
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

/** Slow looping float used by the preview cards. */
function useFloat(amplitude: number, duration: number, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay]);
  return { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -amplitude] }) }] };
}

/* ---------- Preview cards (illustrative preview content) ---------- */

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
    <View style={[styles.glassCard, styles.smallCard, { backgroundColor: '#12C48B' }]}>
      <View style={[styles.avatarCircle, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.smallTitle, { color: '#FFFFFF' }]}>Milestone approved</Text>
        <Text style={[styles.metaText, { color: '#D9FFF0' }]}>₱900 released</Text>
      </View>
    </View>
  );
}

function Showcase({ wide }: { wide: boolean }) {
  const f1 = useFloat(8, 3200);
  const f2 = useFloat(10, 3800, 400);
  const f3 = useFloat(7, 3000, 900);
  const enter = useEntrance(250);
  const h = wide ? 440 : 250;

  return (
    <Animated.View style={[{ height: h, width: '100%', maxWidth: 440, alignSelf: 'center' }, enter]}>
      <Animated.View style={[styles.abs, wide ? { top: 20, left: 10, right: 40 } : { top: 0, left: 0, right: 24 }, f1]}>
        <GigPreview compact={!wide} />
      </Animated.View>
      <Animated.View style={[styles.abs, wide ? { top: 210, right: 0, left: 70 } : { top: 128, right: 0, left: 44 }, f2]}>
        <ProposalPreview />
      </Animated.View>
      <Animated.View style={[styles.abs, wide ? { top: 300, left: 0, right: 110 } : { top: 190, left: 0, right: 90 }, f3]}>
        <MilestonePreview />
      </Animated.View>
    </Animated.View>
  );
}

/* ---------- Actions & trust ---------- */

function PrimaryCta({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.cta, gradient(BRAND, '#3A5DFF'), lightFreelancerTheme.shadow.glow, pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] }]}
    >
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
      style={({ pressed }) => [styles.cta, styles.ghost, pressed && { backgroundColor: 'rgba(255,255,255,0.14)' }]}
    >
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
        <View style={[styles.mark, gradient(BRAND, '#3A5DFF')]}>
          <Ionicons name="flash" size={20} color="#FFFFFF" />
        </View>
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
    <View style={[styles.root, gradient(INK, '#070B26')]}>
      {/* Ambient light */}
      <View pointerEvents="none" style={[styles.orb, { top: -120, right: -100, width: 380, height: 380, backgroundColor: '#5B3DFF', opacity: 0.35 }]} />
      <View pointerEvents="none" style={[styles.orb, { bottom: -140, left: -120, width: 420, height: 420, backgroundColor: '#1F7BFF', opacity: 0.28 }]} />

      <ScrollView
        contentContainerStyle={[styles.scroll, wide && styles.scrollWide]}
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
            <View style={{ marginTop: 28 }}>
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
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: Platform.OS === 'web' ? 32 : 64, paddingBottom: 32, justifyContent: 'center' },
  scrollWide: { paddingHorizontal: 56, paddingVertical: 48 },
  mobileCol: { width: '100%', maxWidth: 520, alignSelf: 'center', flexGrow: 1, justifyContent: 'space-between' },
  wideGrid: { flexDirection: 'row', alignItems: 'center', gap: 56, width: '100%', maxWidth: 1160, alignSelf: 'center' },
  wideLeft: { flex: 1.05 },
  wideRight: { flex: 0.95 },
  copyWide: { marginBottom: 8 },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 36 },
  mark: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#FFFFFF', fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: 'rgba(159,178,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(159,178,255,0.28)',
    marginBottom: 18,
  },
  pillText: { color: '#C9D4FF', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2 },
  headline: { color: '#FFFFFF', fontSize: 44, lineHeight: 48, fontWeight: '800', letterSpacing: -1.6 },
  headlineWide: { fontSize: 64, lineHeight: 68, letterSpacing: -2.4 },
  headlineAccent: { color: '#8FA6FF' },
  sub: { color: '#AEB9E3', fontSize: 16.5, lineHeight: 25, marginTop: 16, maxWidth: 470 },

  actions: { marginTop: 28, gap: 18 },
  actionsWide: { marginTop: 36, maxWidth: 520 },
  ctaCol: { gap: 12 },
  ctaRowWide: { flexDirection: 'row', gap: 12 },
  cta: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaText: { color: '#FFFFFF', fontSize: 16.5, fontWeight: '800', letterSpacing: -0.1 },
  ghost: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)' },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 8 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { color: '#8E9BC9', fontSize: 12.5, fontWeight: '600' },
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
  noticeText: { flex: 1, color: '#E3E9FF', fontSize: 13, fontWeight: '600' },

  // Preview cards
  abs: { position: 'absolute' },
  glassCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 24px 48px rgba(3, 6, 28, 0.45)' } as any)
      : { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 12 }),
  },
  smallCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  tagText: { fontSize: 11.5, fontWeight: '800' },
  openDot: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  openDotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#12C48B' },
  openText: { color: '#0D7A58', fontSize: 12, fontWeight: '800' },
  cardTitle: { color: '#0C1233', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  cardPrice: { color: '#2F55F4', fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginVertical: 6 },
  metaRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#5C6788', fontSize: 12.5, fontWeight: '600' },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E8EDFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#2F55F4', fontWeight: '800', fontSize: 13 },
  smallTitle: { color: '#0C1233', fontSize: 14, fontWeight: '800', marginBottom: 2 },
});
