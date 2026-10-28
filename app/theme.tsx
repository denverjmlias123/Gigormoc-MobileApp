import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';

/**
 * Gigormoc design tokens.
 *
 * Distinct dual-role personalities:
 *  - freelancer ("find_work"): Electric Cobalt + Emerald Mint accents, energetic, built for discovering gigs
 *  - client ("hire"):          Executive Deep Ormoc Navy + Warm Amber/Gold accents, steady, built for managing hires
 * Screens read colors from useAppTheme(); the palette switches with profile.active_mode.
 */

type Palette = {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  primaryText: string; // text/icon color placed on top of `primary`
  accent: string;
  roleAccent: string;
  roleAccentSoft: string;
  heroBg: string; // large header surfaces
  heroText: string;
  heroMuted: string;
  heroChip: string; // translucent chip on hero
};

const freelancerPalette: Palette = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primarySoft: '#DBEAFE',
  primaryText: '#FFFFFF',
  accent: '#10B981',
  roleAccent: '#059669',
  roleAccentSoft: '#D1FAE5',
  heroBg: '#1D4ED8',
  heroText: '#FFFFFF',
  heroMuted: '#DBEAFE',
  heroChip: 'rgba(255,255,255,0.18)',
};

const clientPalette: Palette = {
  primary: '#1E3A8A',
  primaryDark: '#0B1445',
  primarySoft: '#E0E7FF',
  primaryText: '#FFFFFF',
  accent: '#F59E0B',
  roleAccent: '#D97706',
  roleAccentSoft: '#FEF3C7',
  heroBg: '#0B1445',
  heroText: '#FFFFFF',
  heroMuted: '#C7D2FE',
  heroChip: 'rgba(255,255,255,0.14)',
};

const base = {
  bg: '#EAF0FA',
  background: '#EAF0FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2FA',
  insetBg: '#F4F7FC',
  insetBorder: '#E2E9F5',
  cardHeaderBg: '#F9FBFF',
  focusRing: 'rgba(37, 99, 235, 0.32)',
  text: '#0C1233',
  muted: '#5C6788',
  border: '#DCE4F2',
  borderStrong: '#B9C6E0',
  // Brand extras used by the first screen and highlights
  ink: '#070B26', // deepest navy, used for immersive surfaces
  spark: '#FFB524', // warm highlight (ratings, "new" dots)
  sparkSoft: '#FFF3D6',
  violet: '#7C5CFF',
  success: '#12805C',
  successSoft: '#DDF5EA',
  successText: '#0D5E43',
  warning: '#B45309',
  warningSoft: '#FEF1D6',
  warningText: '#92400E',
  primaryContrast: '#FFFFFF',
  danger: '#D92D3E',
  dangerSoft: '#FDE8EA',
  dangerText: '#A31F2D',
  overlay: 'rgba(7,11,38,0.48)',
};

export type AppMode = 'freelancer' | 'client';

const buildTheme = (mode: AppMode) => ({
  mode,
  isClient: mode === 'client',
  isFreelancer: mode === 'freelancer',
  modeLabel: mode === 'client' ? 'Hiring' : 'Freelancing',
  colors: {
    ...base,
    bg: mode === 'client' ? '#EDF2F9' : '#EAF1FB',
    background: mode === 'client' ? '#EDF2F9' : '#EAF1FB',
    ...(mode === 'client' ? clientPalette : freelancerPalette),
  },
  spacing: { xs: 4, s: 8, sm: 12, m: 16, l: 24, xl: 32, xxl: 48 },
  // Radii step up with importance: inputs < chips < buttons < cards < sheets.
  radii: { chip: 10, input: 14, button: 16, card: 22, sheet: 32, pill: 9999 },
  // Responsive helpers: content never stretches past `maxWidth` on web/tablet.
  layout: { maxWidth: 1120, formMaxWidth: 640, wideBreakpoint: 900, desktopBreakpoint: 1024 },
  gradients: {
    brand: 'linear-gradient(135deg, #2563EB 0%, #6C4DFF 100%)',
    ink: 'linear-gradient(160deg, #0B1445 0%, #070B26 100%)',
    sunrise: 'linear-gradient(135deg, #FFB524 0%, #FF6B8A 100%)',
    primary: (mode === 'client' ? ['#1E3A8A', '#0B1445'] : ['#2563EB', '#4F46E5']) as [string, string],
    accent: (mode === 'client' ? ['#D97706', '#F59E0B'] : ['#059669', '#10B981']) as [string, string],
    hero: (mode === 'client' ? ['#0B1445', '#1E3A8A'] : ['#1D4ED8', '#3730A3']) as [string, string],
    surface: ['#FFFFFF', '#F8FAFE'] as [string, string],
    emerald: ['#059669', '#10B981'] as [string, string],
    danger: ['#DC2626', '#B91C1C'] as [string, string],
  },
  glass: {
    surface: '#FFFFFF',
    surfaceSubtle: 'rgba(255, 255, 255, 0.92)',
    border: '#DCE4F2',
    borderSubtle: 'rgba(220, 228, 242, 0.65)',
    highlight: '#FFFFFF',
    darkSurface: 'rgba(11, 20, 69, 0.85)',
    darkBorder: 'rgba(255, 255, 255, 0.15)',
  },
  type: {
    display: { fontSize: 34, lineHeight: 40, fontWeight: '800' as const, letterSpacing: -1 },
    title: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const, letterSpacing: -0.4 },
    heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const, letterSpacing: -0.2 },
    body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
    bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
    small: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
  },
  shadow: {
    card: {
      shadowColor: '#0C1233',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 10,
      elevation: 2,
      boxShadow: '0 1px 2px rgba(12, 18, 51, 0.04), 0 8px 24px rgba(12, 18, 51, 0.06)',
    } as any,
    neoGlass: {
      shadowColor: '#0C1233',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
      elevation: 3,
      boxShadow: '0 2px 4px rgba(12, 18, 51, 0.03), 0 8px 24px rgba(12, 18, 51, 0.06)',
    } as any,
    raised: {
      shadowColor: '#0C1233',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 28,
      elevation: 6,
      boxShadow: '0 4px 8px rgba(12, 18, 51, 0.06), 0 20px 40px rgba(12, 18, 51, 0.14)',
    } as any,
    glow: {
      shadowColor: mode === 'client' ? '#1E3A8A' : '#2563EB',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 5,
      boxShadow:
        mode === 'client'
          ? '0 10px 28px rgba(30, 58, 138, 0.38)'
          : '0 10px 28px rgba(37, 99, 235, 0.42)',
    } as any,
    stickyDock: {
      shadowColor: '#0C1233',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 8,
      boxShadow: '0 -4px 20px rgba(12, 18, 51, 0.06)',
    } as any,
  },
});

export type Theme = ReturnType<typeof buildTheme>;
export type AppTheme = Theme;

export const lightFreelancerTheme = buildTheme('freelancer');
export const clientTheme = buildTheme('client');

// Static default (used before a profile exists, and by non-React callers).
export const theme = lightFreelancerTheme;

export const ThemeContext = createContext<Theme>(theme);

export const useAppTheme = () => useContext(ThemeContext);

export const useResponsiveLayout = () => {
  const { width, height } = useWindowDimensions();
  let insets = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    insets = useSafeAreaInsets();
  } catch {
    // Fallback when rendered outside SafeAreaProvider
  }
  const isWeb = Platform.OS === 'web';
  const isPhone = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;
  const isWide = width >= 900;

  return {
    width,
    height,
    isWeb,
    isPhone,
    isTablet,
    isDesktop,
    isWide,
    insets,
    topSpace: isWeb ? 24 : Math.max(insets.top + 10, 48),
    bottomSpace: isWeb ? 24 : Math.max(insets.bottom + 12, 20),
    topPad: isWeb ? 24 : Math.max(insets.top + 10, 48),
    bottomPad: isWeb ? 24 : Math.max(insets.bottom + 12, 20),
    pagePadding: isPhone ? 16 : 24,
  };
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  const mode: AppMode = profile?.active_mode === 'hire' ? 'client' : 'freelancer';
  const value = useMemo(() => (mode === 'client' ? clientTheme : lightFreelancerTheme), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export default theme;
