'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import MenuIcon from '@mui/icons-material/Menu';
import type { ReactNode } from 'react';
import { SavedConversationsMenu } from '@/components/chat/saved-conversations-menu';
import { listNavPages, listReviewParts, tierAllowsAccess } from '@/lib/page-catalog';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setDrawerOpen } from '@/store/ui-slice';
import { useListPagesQuery } from '@/store/apis/content-api';

const DRAWER_WIDTH = 280;

const linkSx = { textDecoration: 'none', color: 'inherit', display: 'block' };

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const drawerOpen = useAppSelector((s) => s.ui.drawerOpen);
  const { tier, user, groups } = useAppSelector((s) => s.auth);
  useListPagesQuery();

  // Brand config (loaded on mount — public endpoint, no auth needed)
  const [brandText, setBrandText] = useState('Red Ruby');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  useEffect(() => {
    fetch('/api/brand-config')
      .then((r) => r.json())
      .then((d) => {
        if (d.brandLogoUrl) setBrandLogoUrl(d.brandLogoUrl);
        if (d.brandLogoText) setBrandText(d.brandLogoText);
      })
      .catch(() => {
        // defaults — never break the UI for a missing config
      });
  }, []);

  const navPages = listNavPages(tier, groups ?? []);
  const reviewParts = tierAllowsAccess(tier, 'google') ? listReviewParts() : [];
  const showConfigLink = tierAllowsAccess(tier, 'pin');

  const closeDrawer = () => dispatch(setDrawerOpen(false));
  const toggleDrawer = () => dispatch(setDrawerOpen(!drawerOpen));

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <AppBar position="sticky" elevation={0} color="transparent">
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: 52 }}>
          <Link href="/dashboard" style={linkSx}>
            {brandLogoUrl ? (
              <Box
                component="img"
                src={brandLogoUrl}
                alt={brandText}
                sx={{ height: 32, width: 'auto', maxWidth: 180, objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 800,
                  color: 'text.primary',
                }}
              >
                {brandText}
              </Typography>
            )}
          </Link>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <SavedConversationsMenu />
            <IconButton
              aria-label="Open navigation"
              onClick={toggleDrawer}
              sx={{ color: 'text.secondary' }}
            >
              <MenuIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        slotProps={{ paper: { sx: { width: DRAWER_WIDTH, maxWidth: '80vw' } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2.5, pb: 2 }}>
          <Avatar
            src={user?.picture ?? undefined}
            sx={{ width: 36, height: 36, bgcolor: 'rgba(235, 61, 40, 0.15)', color: 'primary.main' }}
          >
            {user?.name?.[0] ?? 'R'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name ?? 'Guest'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email ?? `Tier: ${tier}`}
            </Typography>
          </Box>
        </Box>
        <Divider />
        <List sx={{ flex: 1, py: 1 }}>
          {navPages.map((page) => {
            const href = `/${page.slug}` as Route;
            return (
              <Link key={page.slug} href={href} style={linkSx} onClick={closeDrawer}>
                <ListItemButton
                  selected={isActive(href)}
                  sx={{
                    borderLeft: '3px solid transparent',
                    '&.Mui-selected': {
                      borderLeftColor: 'primary.main',
                      bgcolor: 'rgba(235, 61, 40, 0.06)',
                    },
                  }}
                >
                  <ListItemText primary={page.navLabel ?? page.title} />
                </ListItemButton>
              </Link>
            );
          })}
          {showConfigLink ? (
            <Link href="/config" style={linkSx} onClick={closeDrawer}>
              <ListItemButton
                selected={pathname === '/config'}
                sx={{
                  borderLeft: '3px solid transparent',
                  '&.Mui-selected': {
                    borderLeftColor: 'primary.main',
                    bgcolor: 'rgba(235, 61, 40, 0.06)',
                  },
                }}
              >
                <ListItemText primary="Config" />
              </ListItemButton>
            </Link>
          ) : null}
          {reviewParts.length > 0 ? (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" sx={{ px: 3, py: 1, color: 'text.secondary' }}>
                Business review
              </Typography>
              {reviewParts.map((part) => {
                const href = `/review/${part.partSlug}` as Route;
                return (
                  <Link key={part.partSlug} href={href} style={linkSx} onClick={closeDrawer}>
                    <ListItemButton selected={pathname === href} sx={{ pl: 3 }}>
                      <ListItemText
                        primary={part.title}
                        slotProps={{
                          primary: { variant: 'body2', sx: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
                        }}
                      />
                    </ListItemButton>
                  </Link>
                );
              })}
            </>
          ) : null}
        </List>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {tier === 'public' ? (
            <Button
              component="a"
              href={`/api/auth?action=google&redirect=${encodeURIComponent(pathname || '/dashboard')}`}
              variant="outlined"
              size="small"
              fullWidth
            >
              Sign in with Google
            </Button>
          ) : (
            <Button
              component="a"
              href="/api/auth?action=logout"
              variant="outlined"
              size="small"
              color="inherit"
              fullWidth
            >
              Sign out
            </Button>
          )}
          <Box sx={{ display: 'flex', gap: 2 }}>
          <Link href="/terms-of-service" style={linkSx} onClick={closeDrawer}>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              Terms
            </Typography>
          </Link>
          <Link href="/privacy-policy" style={linkSx} onClick={closeDrawer}>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              Privacy
            </Typography>
          </Link>
          </Box>
        </Box>
      </Drawer>

      <Box component="div" sx={{ flex: 1 }}>
        {children}
      </Box>
    </Box>
  );
}
