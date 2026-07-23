'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import MenuIcon from '@mui/icons-material/Menu';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FolderIcon from '@mui/icons-material/Folder';
import type { ReactNode } from 'react';
import { SavedConversationsMenu } from '@/components/chat/saved-conversations-menu';
import { getReviewPartDisplayTitle, listNavPages, resolvePage, resolveReviewPart } from '@/lib/page-catalog';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setDrawerOpen } from '@/store/ui-slice';
import { useListPagesQuery } from '@/store/apis/content-api';
import { useGetBrandConfigQuery } from '@/store/apis/brand-config-api';
import { useGetNavigationQuery } from '@/store/apis/navigation-api';
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

  // Brand config via RTK Query
  const { data: brandData } = useGetBrandConfigQuery();
  const brandText = brandData?.data?.brandLogoText ?? 'Red Ruby';
  const brandLogoUrl = brandData?.data?.brandLogoUrl ?? '';

  // DB-driven navigation via RTK Query (fallback: static catalog via listNavPages)
  const groupsParam = encodeURIComponent((groups ?? []).join(','));
  const { data: navData } = useGetNavigationQuery({ tier, groups: groupsParam });

  const dbNavItems: DbNavItem[] | undefined = navData?.data?.items as DbNavItem[] | undefined;

  // Use DB nav if loaded, otherwise fall back to static catalog
  const navItems = ((dbNavItems as DbNavItem[]) ?? listNavPages(tier, groups ?? []).map((p) => ({
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
  }))) as (DbNavItem | (DbNavItem & { _isCatalog?: boolean }))[];



  const closeDrawer = () => dispatch(setDrawerOpen(false));
  const toggleDrawer = () => dispatch(setDrawerOpen(!drawerOpen));

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  /** Resolve breadcrumb trail from the current pathname. */
  const getBreadcrumbs = useCallback((p: string) => {
    const segments = p.split('/').filter(Boolean);
    const crumbs: { label: string; href: string }[] = [];
    let accumulated = '';
    for (const segment of segments) {
      accumulated += '/' + segment;
      const page = resolvePage(segment);
      if (page) {
        crumbs.push({ label: page.title, href: accumulated });
      } else {
        const part = resolveReviewPart(segment);
        if (part) {
          crumbs.push({ label: getReviewPartDisplayTitle(part.title), href: accumulated });
        } else {
          crumbs.push({
            label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
            href: accumulated,
          });
        }
      }
    }
    return crumbs;
  }, []);

  const breadcrumbs = useMemo(() => getBreadcrumbs(pathname), [pathname, getBreadcrumbs]);

  /** Search query for filtering nav items inside the drawer. */
  const [searchQuery, setSearchQuery] = useState('');

  /** Recursively filter nav items by search query (match title, keep parent if any child matches). */
  const filterNavItems = useCallback(
    (items: (DbNavItem | (DbNavItem & { _isCatalog?: boolean }))[], query: string): (DbNavItem | (DbNavItem & { _isCatalog?: boolean }))[] => {
      if (!query) return items;
      const lower = query.toLowerCase();
      return items.reduce<(DbNavItem | (DbNavItem & { _isCatalog?: boolean }))[]>((acc, item) => {
        const matches = item.title.toLowerCase().includes(lower);
        const children = 'children' in item ? (item as DbNavItem).children ?? [] : [];
        const filteredChildren = children.length > 0 ? filterNavItems(children, query) : [];
        if (matches || filteredChildren.length > 0) {
          acc.push({ ...item, children: filteredChildren } as DbNavItem & { _isCatalog?: boolean });
        }
        return acc;
      }, []);
    },
    [],
  );

  const filteredNavItems = useMemo(
    () => filterNavItems(navItems, searchQuery),
    [navItems, searchQuery, filterNavItems],
  );

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
        <Toolbar sx={{ minHeight: 52 }}>
          {/* Hamburger toggle — left aligned */}
          <IconButton
            aria-label="Open navigation"
            onClick={toggleDrawer}
            sx={{ color: 'text.secondary', mr: 1 }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo image + brand text always visible side by side */}
          <Link href="/dashboard" style={{ ...linkSx, alignItems: 'center', gap: 1 }}>
            {brandLogoUrl && (
              <Box
                component="img"
                src={brandLogoUrl}
                alt={brandText}
                sx={{ height: 28, width: 'auto', maxWidth: 120, objectFit: 'contain', display: 'block' }}
              />
            )}
            <Typography
              variant="subtitle1"
              sx={{ pl: 1, fontWeight: 800, color: 'text.primary', whiteSpace: 'nowrap' }}
            >
              {brandText}
            </Typography>
          </Link>

          {/* Breadcrumbs trail */}
          {breadcrumbs.length > 0 && (
            <Breadcrumbs
              separator={<NavigateNextIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
              sx={{ ml: 2, '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' } }}
            >
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return isLast ? (
                  <Typography
                    key={crumb.href}
                    variant="caption"
                    sx={{ color: 'text.secondary', fontWeight: 500, whiteSpace: 'nowrap' }}
                  >
                    {crumb.label}
                  </Typography>
                ) : (
                  <Link
                    key={crumb.href}
                    href={crumb.href as Route}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.disabled',
                        '&:hover': { color: 'text.primary' },
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {crumb.label}
                    </Typography>
                  </Link>
                );
              })}
            </Breadcrumbs>
          )}

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Right-aligned controls */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <SavedConversationsMenu />
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
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
        <Box sx={{ px: 2, py: 1 }}>
          <TextField
            placeholder="Search pages..."
            variant="outlined"
            size="small"
            fullWidth
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined fontSize="small" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.04)',
              },
            }}
          />
        </Box>
        <List sx={{ flex: 1, py: 1 }}>
          {renderNavItems(filteredNavItems, pathname, closeDrawer, isActive, linkSx, 0)}
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
