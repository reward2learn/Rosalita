'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';

export interface BrandColors {
  primary: string;
  secondary: string;
}

const FALLBACK_COLORS: BrandColors = { primary: '#eb3d28', secondary: '#0af9fe' };

/**
 * Build an MUI dark theme using the given brand colors.
 * Falls back to the default Red Ruby palette when brand config is not yet loaded.
 */
function buildTheme(brand: BrandColors) {
  return createTheme({
    palette: {
      mode: 'dark',
      primary: { main: brand.primary },
      secondary: { main: brand.secondary },
      background: {
        default: '#0f0f14',
        paper: '#1a1a22',
      },
      text: {
        primary: '#f0f0f5',
        secondary: '#8888a0',
      },
      divider: 'rgba(255,255,255,0.06)',
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: 'rgba(15,15,20,0.85)',
            backdropFilter: 'blur(0px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: '#1a1a22',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
          },
        },
      },
    },
  });
}

export function ThemeRegistry({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandColors>(FALLBACK_COLORS);

  useEffect(() => {
    fetch('/api/brand-config')
      .then((r) => r.json())
      .then((d) => {
        const primary = d.brandPrimaryColor && /^#[0-9a-fA-F]{6}$/.test(d.brandPrimaryColor)
          ? d.brandPrimaryColor
          : FALLBACK_COLORS.primary;
        const secondary = d.brandSecondaryColor && /^#[0-9a-fA-F]{6}$/.test(d.brandSecondaryColor)
          ? d.brandSecondaryColor
          : FALLBACK_COLORS.secondary;
        setBrand({ primary, secondary });
      })
      .catch(() => {
        // keep defaults
      });
  }, []);

  const theme = useMemo(() => buildTheme(brand), [brand]);

  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
