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
  primary: '#1F5FFF',
  primaryDark: '#1239B3',
  primarySoft: '#E4ECFF',
  primaryText: '#FFFFFF',
  accent: '#00A3FF',
  heroBg: '#1F5FFF',
  heroText: '#FFFFFF',
  heroMuted: '#CFDDFF',
  heroChip: 'rgba(255,255,255,0.18)',
};

const clientPalette: Palette = {
  primary: '#1B4DB1',
  primaryDark: '#0A1F4D',
  primarySoft: '#E6ECF8',
  primaryText: '#FFFFFF',
  accent: '#4F8BFF',
  heroBg: '#0A1F4D',
  heroText: '#FFFFFF',
  heroMuted: '#AFC2E8',
  heroChip: 'rgba(255,255,255,0.14)',
};

const base = {
  bg: '#F4F7FC',
  background: '#F4F7FC',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2FA',
  text: '#0B1B3A',
  muted: '#5B6B8C',
  border: '#DCE4F2',
  borderStrong: '#B9C6E0',
  success: '#12805C',
  successSoft: '#DDF5EA',
  successText: '#0D5E43',
  warning: '#B45309',
  warningSoft: '#FEF1D6',
  danger: '#D92D3E',
  dangerSoft: '#FDE8EA',
  dangerText: '#A31F2D',
  overlay: 'rgba(11,27,58,0.42)',
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
  radii: { chip: 10, input: 12, button: 14, card: 20, sheet: 28, pill: 9999 },
  type: {
    display: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const, letterSpacing: -0.8 },
    title: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const, letterSpacing: -0.4 },
    heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const, letterSpacing: -0.2 },
    body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
    bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
    small: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
  },
  shadow: {
    card: { boxShadow: '0 2px 12px rgba(11, 27, 58, 0.07)' } as any,
    raised: { boxShadow: '0 8px 24px rgba(11, 27, 58, 0.14)' } as any,
  },
});

export type Theme = ReturnType<typeof buildTheme>;

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
