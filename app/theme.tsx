import React, { createContext, useContext, ReactNode } from 'react';

export const theme = {
  colors: {
    primary: '#2563EB',
    primaryDark: '#1E40AF',
    primarySoft: '#DBEAFE',
    accent: '#F59E0B',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    bg: '#F8FAFC',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#0F172A',
    muted: '#64748B',
    border: '#E2E8F0',
  },
  spacing: {
    xs: 4,
    s: 8,
    sm: 12,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 48,
  },
  radii: {
    input: 12,
    button: 12,
    card: 16,
    pill: 9999,
  },
};

export type Theme = typeof theme;

export const ThemeContext = createContext<Theme>(theme);

export const useAppTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export default theme;
