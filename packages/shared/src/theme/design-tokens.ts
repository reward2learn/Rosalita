/**
 * Design Token System
 *
 * The AI agent specifies design tokens (colors, typography, spacing)
 * which get injected directly into a centralized MUI ThemeProvider,
 * globally configuring the styling baseline for the entire tenant workspace.
 */

import { createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';

export interface DesignTokens {
  /** Primary brand color (hex) */
  primaryColor: string;
  /** Secondary brand color (hex) */
  secondaryColor: string;
  /** Border radius for cards, buttons, inputs */
  borderRadius: number;
  /** Spacing density */
  spacingDensity: 'compact' | 'comfortable' | 'dense';
  /** Typography scale */
  typographyScale: 'small' | 'medium' | 'large';
  /** Color mode */
  mode: 'dark' | 'light';
}

export const DEFAULT_TOKENS: DesignTokens = {
  primaryColor: '#eb3d28',
  secondaryColor: '#0af9fe',
  borderRadius: 16,
  spacingDensity: 'comfortable',
  typographyScale: 'medium',
  mode: 'dark',
};

/**
 * Build an MUI theme from design tokens.
 * This replaces the need for custom CSS — the entire visual
 * identity is controlled via the ThemeProvider.
 */
export function buildThemeFromTokens(tokens: Partial<DesignTokens> = {}): Theme {
  const t = { ...DEFAULT_TOKENS, ...tokens };

  const spacingFactor = t.spacingDensity === 'compact' ? 6 : t.spacingDensity === 'dense' ? 4 : 8;
  const fontSize = t.typographyScale === 'small' ? 14 : t.typographyScale === 'large' ? 18 : 16;

  const baseOptions: ThemeOptions = {
    palette: {
      mode: t.mode,
      primary: { main: t.primaryColor },
      secondary: { main: t.secondaryColor },
      shape: { borderRadius: t.borderRadius },
    },
    spacing: spacingFactor,
    typography: {
      fontSize,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
  };

  // Dark mode specific overrides
  if (t.mode === 'dark') {
    baseOptions.palette = {
      ...baseOptions.palette,
      background: { default: '#0f0f14', paper: '#1a1a22' },
      text: { primary: '#f0f0f5', secondary: '#8888a0' },
      divider: 'rgba(255,255,255,0.06)',
    } as any;
  }

  return createTheme(baseOptions);
}

/**
 * Merge partial design tokens with defaults.
 * Useful when the AI provides only some tokens (e.g., just colors).
 */
export function mergeTokens(partial: Partial<DesignTokens>): DesignTokens {
  return { ...DEFAULT_TOKENS, ...partial };
}
