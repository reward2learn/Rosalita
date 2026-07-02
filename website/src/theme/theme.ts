'use client';

import { createTheme } from '@mui/material/styles';

/** Rosalita dark theme — tokens from style.css */
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#eb3d28',
    },
    secondary: {
      main: '#0af9fe',
    },
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
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(15,15,20,0.85)',
          backdropFilter: 'blur(12px)',
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
