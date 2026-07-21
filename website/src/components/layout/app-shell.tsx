'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import MenuIcon from '@mui/icons-material/Menu';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FolderIcon from '@mui/icons-material/Folder';
import type { ReactNode } from 'react';
import { SavedConversationsMenu } from '@/components/chat/saved-conversations-menu';
import { listNavPages } from '@/lib/page-catalog';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setDrawerOpen } from '@/store/ui-slice';
import { useListPagesQuery } from '@/store/apis/content-api';
import { NavIcon } from '@/components/shared/nav-icon';

const DRAWER_WIDTH = 280;

const linkSx = { textDecoration: 'none', color: 'inherit', display: 'inline-flex', width: '100%' };

/** DB-driven nav item shape from GET /api/navigation */
interface DbNavItem {
  id: string;
  parentId: string | null;
  sortOrder: number;
  title: string;
  path: string;
  icon: string;
  authTier: string;
  requiredGroups: string;
  isVisible: boolean;
  isDynamic: boolean;
  isDefault: boolean;
  children: DbNavItem[];
}

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

  // DB-driven navigation (fallback: static catalog via listNavPages)
  const [dbNavItems, setDbNavItems] = useState<DbNavItem[] | null>(null);
  useEffect(() => {
    const groupsParam = encodeURIComponent((groups ?? []).join(','));
    fetch(`/api/navigation?tier=${tier}&groups=${groupsParam}`)
      .then((r) => r.json())
      .then((d) => { if (d.items) setDbNavItems(d.items); })
      .catch(() => { /* fallback to static catalog */ });
  }, [tier, groups]);

  // Use DB nav if loaded, otherwise fall back to static catalog
  const navItems = dbNavItems ?? listNavPages(tier, groups ?? []).map((p) => ({
    id: `static-${p.slug}`,
    parentId: null,
    sortOrder: 0,
    title: p.navLabel ?? p.title,
    path: `/${p.slug}`,
    icon: '',
    authTier: p.authTier,
    requiredGroups: '',
    isVisible: true,
    isDynamic: false,
    isDefault: false,
    children: [] as DbNavItem[],
  })) as (DbNavItem | (DbNavItem & { _isCatalog?: boolean }))[];



  const closeDrawer = () => dispatch(setDrawerOpen(false));
  const toggleDrawer = () => dispatch(setDrawerOpen(!drawerOpen));

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  /** Track which nav items have their children expanded (keyed by item id). */
  const [expandedNav, setExpandedNav] = useState<Record<string, boolean>>({});

  const toggleExpanded = useCallback((id: string) => {
    setExpandedNav((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  /** Recursively render nav items with expand/collapse and hierarchy. */
  const renderNavItems = (
    items: (DbNavItem | (DbNavItem & { _isCatalog?: boolean }))[],
    currentPath: string,
    onClose: () => void,
    activeCheck: (href: string) => boolean,
    linkStyle: Record<string, unknown>,
    depth: number,
  ): ReactNode[] => {
    return items.map((item) => {
      const href = item.path || '';
      const children = 'children' in item ? (item as DbNavItem).children ?? [] : [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedNav[item.id] ?? false;
      const isFolder = !href && hasChildren;
      const isActiveItem = href ? activeCheck(href) : false;

      const handleNavClick = () => {
        if (!isFolder) onClose();
      };

      return (
        <Box key={item.id} sx={{ display: 'inline-flex', flexDirection: 'column', width: '100%' }}>
          <ListItemButton
            selected={isActiveItem}
            onClick={handleNavClick}
            component={!isFolder && href ? Link : 'div'}
            href={!isFolder && href ? (href as Route) : undefined}
            style={!isFolder && href ? linkStyle : undefined}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              width: '100%',
              pl: 2 + depth * 2,
              borderLeft: '3px solid transparent',
              '&.Mui-selected': {
                borderLeftColor: 'primary.main',
                bgcolor: 'rgba(235, 61, 40, 0.06)',
              },
            }}
          >
            {/* Icon — custom nav icon OR expand/collapse chevron */}
            <ListItemIcon
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: item.icon || hasChildren ? 28 : 0,
                color: 'text.secondary',
                cursor: hasChildren ? 'pointer' : 'default',
              }}
              onClick={(e: React.MouseEvent) => {
                if (hasChildren) {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleExpanded(item.id);
                }
              }}
            >
              {item.icon ? (
                <NavIcon name={item.icon} fontSize="small" />
              ) : hasChildren ? (
                isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />
              ) : null}
            </ListItemIcon>
            {/* Title text — clicking navigates (if path set) and closes drawer */}
            <ListItemText
              primary={item.title}
              sx={{ display: 'inline-flex', alignItems: 'center', m: 0 }}
              slotProps={{
                primary: {
                  variant: hasChildren ? 'subtitle2' : 'body2',
                  sx: {
                    fontWeight: hasChildren ? 700 : 400,
                    color: hasChildren ? 'text.primary' : undefined,
                  },
                },
              }}
            />
          </ListItemButton>
          {hasChildren ? (
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <Box sx={{ ml: 0 }}>
                {renderNavItems(children, currentPath, onClose, activeCheck, linkStyle, depth + 1)}
              </Box>
            </Collapse>
          ) : null}
        </Box>
      );
    });
  };

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
          {renderNavItems(navItems, pathname, closeDrawer, isActive, linkSx, 0)}

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
