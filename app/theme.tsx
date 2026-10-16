import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

/**
 * Gigormoc design tokens.
 *
 * One blue family, two personalities:
 *  - freelancer ("find_work"): bright cobalt, energetic, built for discovering gigs
 *  - client ("hire"):          deep navy, steadier, built for managing hires
 * Screens read colors from useAppTheme(); the palette switches with profile.active_mode.
 */

type Palette = {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  primaryText: string; // text/icon color placed on top of `primary`
  accent: string;
  heroBg: string; // large header surfaces
  heroText: string;
  heroMuted: string;
  heroChip: string; // translucent chip on hero
};

const freelancerPalette: Palette = {
  primary: '#2F55F4',
  primaryDark: '#1B34B8',
  primarySoft: '#D8E4F8',
  primaryText: '#FFFFFF',
  accent: '#22C7FF',
  heroBg: '#2F55F4',
  heroText: '#FFFFFF',
  heroMuted: '#D3DCFF',
  heroChip: 'rgba(255,255,255,0.18)',
};

const clientPalette: Palette = {
  primary: '#2A47C9',
  primaryDark: '#0B1445',
  primarySoft: '#D5E2F6',
  primaryText: '#FFFFFF',
  accent: '#6C8CFF',
  heroBg: '#0B1445',
  heroText: '#FFFFFF',
  heroMuted: '#B4C0EC',
  heroChip: 'rgba(255,255,255,0.14)',
};

const base = {
  bg: '#DDE7F5',
  background: '#DDE7F5',
  surface: '#E5EEFA',
  surfaceAlt: '#D6E3F4',
  text: '#0C1233',
  muted: '#54617F',
  border: '#BFD0E8',
  borderStrong: '#9EB4D9',
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
  colors: { ...base, ...(mode === 'client' ? clientPalette : freelancerPalette) },
  spacing: { xs: 4, s: 8, sm: 12, m: 16, l: 24, xl: 32, xxl: 48 },
  // Radii step up with importance: inputs < chips < buttons < cards < sheets.
  radii: { chip: 10, input: 14, button: 16, card: 22, sheet: 32, pill: 9999 },
  // Responsive helpers: content never stretches past `maxWidth` on web/tablet.
  layout: { maxWidth: 960, wideBreakpoint: 900 },
  gradients: {
    brand: 'linear-gradient(135deg, #2F55F4 0%, #6C4DFF 100%)',
    ink: 'linear-gradient(160deg, #0B1445 0%, #070B26 100%)',
    sunrise: 'linear-gradient(135deg, #FFB524 0%, #FF6B8A 100%)',
    primary: (mode === 'client' ? ['#2A47C9', '#172554'] : ['#2F55F4', '#4F46E5']) as [string, string],
    hero: (mode === 'client' ? ['#0B1445', '#172554'] : ['#2F55F4', '#3730A3']) as [string, string],
    surface: ['rgba(229, 238, 250, 0.90)', 'rgba(216, 228, 246, 0.85)'] as [string, string],
    emerald: ['#059669', '#10B981'] as [string, string],
  },
  glass: {
    surface: 'rgba(224, 234, 248, 0.82)',
    surfaceSubtle: 'rgba(214, 226, 244, 0.70)',
    border: 'rgba(180, 198, 230, 0.75)',
    borderSubtle: 'rgba(168, 188, 224, 0.55)',
    highlight: 'rgba(228, 238, 254, 0.60)',
    darkSurface: 'rgba(11, 20, 69, 0.88)',
    darkBorder: 'rgba(147, 169, 219, 0.25)',
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
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 2,
      boxShadow: '0 1px 2px rgba(12, 18, 51, 0.04), 0 8px 24px rgba(12, 18, 51, 0.06)',
    } as any,
    neoGlass: {
      shadowColor: '#0C1233',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 16,
      elevation: 3,
      boxShadow: '0 6px 18px -4px rgba(12, 18, 51, 0.08), 0 2px 6px rgba(12, 18, 51, 0.04)',
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
      shadowColor: mode === 'client' ? '#2A47C9' : '#2F55F4',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 5,
      boxShadow: '0 10px 30px rgba(47, 85, 244, 0.45)',
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

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  const mode: AppMode = profile?.active_mode === 'hire' ? 'client' : 'freelancer';
  const value = useMemo(() => (mode === 'client' ? clientTheme : lightFreelancerTheme), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export default theme;
