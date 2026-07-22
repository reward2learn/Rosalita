'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FormControlLabel from '@mui/material/FormControlLabel';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import { NavIcon, NAV_ICON_NAMES } from '@/components/shared/nav-icon';

// ── Types ──────────────────────────────────────────────

interface NavItem {
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
  children: NavItem[];
}

interface FlatItem {
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
}

// ── Helpers ────────────────────────────────────────────

function flattenTree(items: NavItem[], depth = 0): (FlatItem & { depth: number })[] {
  const result: (FlatItem & { depth: number })[] = [];
  for (const item of items) {
    result.push({ ...item, depth });
    if (item.children.length > 0) {
      result.push(...flattenTree(item.children, depth + 1));
    }
  }
  return result;
}

function buildTree(items: FlatItem[]): NavItem[] {
  const map = new Map<string, NavItem>();
  const roots: NavItem[] = [];
  for (const item of items) map.set(item.id, { ...item, children: [] });
  for (const item of map.values()) {
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children.push(item);
    } else {
      roots.push(item);
    }
  }
  return roots;
}

/** Collect all descendant IDs of a given parent (recursive). */
function collectDescendantIds(items: (FlatItem & { depth: number })[], parentId: string): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.parentId === parentId) {
      ids.push(item.id);
      ids.push(...collectDescendantIds(items, item.id));
    }
  }
  return ids;
}

// ── Component ──────────────────────────────────────────

export function NavigationManager() {
  const [items, setItems] = useState<NavItem[]>([]);
  const [flatItems, setFlatItems] = useState<(FlatItem & { depth: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [editingItem, setEditingItem] = useState<FlatItem | null>(null);
  const [originalEditingItem, setOriginalEditingItem] = useState<FlatItem | null>(null);
  const [applyRecursive, setApplyRecursive] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // ── Multi-select ──────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchDialogMode, setBatchDialogMode] = useState<'delete' | 'parent' | 'tier' | 'groups' | null>(null);
  const [batchParentId, setBatchParentId] = useState<string>('');
  const [batchTier, setBatchTier] = useState<'public' | 'pin' | 'google'>('public');
  const [batchGroups, setBatchGroups] = useState<string[]>([]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/navigation');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      if (payload.success) {
        setItems(payload.data.items ?? []);
        setFlatItems(flattenTree(payload.data.items ?? []));
      } else {
        throw new Error(payload.error ?? 'Failed to load');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  // ── Security groups list (for Required Groups multi-select) ──
  const [allSecurityGroups, setAllSecurityGroups] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => {
    fetch('/api/admin/groups')
      .then((r) => r.json())
      .then((payload) => {
        if (payload.success && Array.isArray(payload.data?.groups)) {
          setAllSecurityGroups(payload.data.groups);
        }
      })
      .catch(() => { /* non-critical */ });
  }, []);

  // ── Create ────────────────────────────────────────────
  const [newTitle, setNewTitle] = useState('');
  const [newPath, setNewPath] = useState('');
  const [newParentId, setNewParentId] = useState<string>('');
  const [newTier, setNewTier] = useState<'public' | 'pin' | 'google'>('public');
  const [newType, setNewType] = useState<'folder' | 'page' | 'link'>('page');
  const [newRequiredGroups, setNewRequiredGroups] = useState<string[]>([]);
  const [newIcon, setNewIcon] = useState('');

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let path = newPath.trim();
      // Auto-set path based on type
      if (newType === 'folder') path = '';
      if (newType === 'page' && !path) path = `/${newTitle.trim().toLowerCase().replace(/\s+/g, '-')}`;

      const res = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          path,
          parentId: newParentId || null,
          authTier: newTier,
          icon: newIcon,
          requiredGroups: newRequiredGroups.join(','),
        }),
      });
      const payload = await res.json();
      if (payload.success) {
        setCreateDialogOpen(false);
        setNewTitle('');
        setNewPath('');
        setNewParentId('');
        setNewType('page');
        setNewRequiredGroups([]);
        setNewIcon('');
        void fetchItems();
      } else {
        throw new Error(payload.error ?? 'Create failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [newTitle, newPath, newParentId, newTier, newType, newRequiredGroups, newIcon, fetchItems]);

  // ── Edit ──────────────────────────────────────────────
  const openEdit = useCallback((item: FlatItem) => {
    setEditingItem({ ...item });
    setOriginalEditingItem({ ...item });
    setApplyRecursive(false);
    setEditDialogOpen(true);
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingItem) return;
    setSaving(true);
    setError(null);
    try {
      const itemsToSave: FlatItem[] = [editingItem];

      // When "Apply to children" is checked, cascade changed properties to all descendants
      if (applyRecursive && originalEditingItem) {
        const descIds = collectDescendantIds(flatItems, editingItem.id);
        const changedProps: Record<string, unknown> = {};
        for (const key of ['authTier', 'requiredGroups', 'isVisible', 'icon'] as const) {
          if (editingItem[key] !== originalEditingItem[key]) {
            changedProps[key] = editingItem[key];
          }
        }
        if (Object.keys(changedProps).length > 0) {
          for (const id of descIds) {
            const original = flatItems.find((i) => i.id === id);
            if (original) {
              itemsToSave.push({ ...original, ...changedProps });
            }
          }
        }
      }

      const res = await fetch('/api/admin/navigation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToSave }),
      });
      const payload = await res.json();
      if (payload.success) {
        setEditDialogOpen(false);
        setEditingItem(null);
        setOriginalEditingItem(null);
        setApplyRecursive(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        void fetchItems();
      } else {
        throw new Error(payload.error ?? 'Update failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [editingItem, originalEditingItem, applyRecursive, flatItems, fetchItems]);

  // ── Set as default route ──────────────────────────────
  const handleSetDefault = useCallback(async (item: FlatItem) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: item.id, isDefault: true }] }),
      });
      const payload = await res.json();
      if (payload.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        void fetchItems();
      } else {
        throw new Error(payload.error ?? 'Failed to set default');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [fetchItems]);

  // ── Delete ────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    if (!globalThis.window.confirm('Delete this nav item? Children will be moved to root level.')) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/navigation?ids=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const payload = await res.json();
      if (payload.success) {
        void fetchItems();
      } else {
        throw new Error(payload.error ?? 'Delete failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [fetchItems]);

  // ── Multi-select helpers ─────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const selectAll = useCallback(() => setSelectedIds(new Set(flatItems.map((i) => i.id))), [flatItems]);

  const openBatchDialog = useCallback((mode: 'delete' | 'parent' | 'tier' | 'groups') => {
    setBatchDialogMode(mode);
    setBatchParentId('');
    setBatchTier('public');
    setBatchGroups([]);
    setBatchDialogOpen(true);
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const ids = Array.from(selectedIds);
      const res = await fetch(`/api/admin/navigation?ids=${ids.map(encodeURIComponent).join(',')}`, { method: 'DELETE' });
      const payload = await res.json();
      if (payload.success) {
        setBatchDialogOpen(false);
        setSelectedIds(new Set());
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        void fetchItems();
      } else {
        throw new Error(payload.error ?? 'Batch delete failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [selectedIds, fetchItems]);

  const handleBatchAssign = useCallback(async () => {
    if (selectedIds.size === 0 || !batchDialogMode) return;
    setSaving(true);
    setError(null);
    try {
      const ids = Array.from(selectedIds);
      const updates: FlatItem[] = ids.map((id) => {
        const orig = flatItems.find((i) => i.id === id);
        if (!orig) return null as unknown as FlatItem;
        const patch: Partial<FlatItem> = {};
        if (batchDialogMode === 'parent') patch.parentId = batchParentId || null;
        if (batchDialogMode === 'tier') patch.authTier = batchTier;
        if (batchDialogMode === 'groups') patch.requiredGroups = batchGroups.join(',');
        return { ...orig, ...patch };
      }).filter(Boolean);

      const res = await fetch('/api/admin/navigation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updates }),
      });
      const payload = await res.json();
      if (payload.success) {
        setBatchDialogOpen(false);
        setSelectedIds(new Set());
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        void fetchItems();
      } else {
        throw new Error(payload.error ?? 'Batch update failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [selectedIds, batchDialogMode, batchParentId, batchTier, batchGroups, flatItems, fetchItems]);

  // ── Drag-to-reorder helpers ──────────────────────────
  const moveItem = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const updated = [...flatItems];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    // Re-assign sort orders
    const reordered = updated.map((item, i) => ({ ...item, sortOrder: i }));
    setFlatItems(reordered);
  }, [flatItems]);

  const handleDrop = useCallback(async () => {
    if (dragIndex === null || dropIndex === null || dragIndex === dropIndex) return;
    setSaving(true);
    setError(null);
    try {
      const updated = [...flatItems];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(dropIndex, 0, moved);
      const reordered = updated.map((item, i) => ({ ...item, sortOrder: i }));
      const payload = reordered.map(({ depth: _, ...rest }) => rest);

      const res = await fetch('/api/admin/navigation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      });
      const result = await res.json();
      if (result.success) {
        setFlatItems(reordered);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        throw new Error(result.error ?? 'Reorder failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
      setDragIndex(null);
      setDropIndex(null);
    }
  }, [dragIndex, dropIndex, flatItems]);

  // ── Render tree row ──────────────────────────────────
  /** Check whether any item in the list has this item as its parent. */
  const hasChildren = useCallback((itemId: string) => flatItems.some((i) => i.parentId === itemId), [flatItems]);

  function renderRow(item: FlatItem & { depth: number }, idx: number) {
    const isDrag = dragIndex === idx;
    const isDrop = dropIndex === idx;
    return (
      <Paper
        key={item.id}
        draggable
        onDragStart={() => setDragIndex(idx)}
        onDragOver={(e) => { e.preventDefault(); setDropIndex(idx); }}
        onDragEnd={handleDrop}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1.5,
          mb: 0.5,
          bgcolor: isDrag ? 'action.selected' : isDrop ? 'action.hover' : 'transparent',
          border: '1px solid',
          borderColor: isDrop ? 'primary.main' : 'divider',
          opacity: isDrag ? 0.5 : 1,
          cursor: 'grab',
          ml: item.depth * 3,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Checkbox
          size="small"
          checked={selectedIds.has(item.id)}
          onChange={() => toggleSelect(item.id)}
          onClick={(e) => e.stopPropagation()}
          sx={{ p: 0.25 }}
        />
        <DragIndicatorIcon fontSize="small" color="disabled" sx={{ cursor: 'grab', flexShrink: 0 }} />
        <Box sx={{ flexShrink: 0, color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
          {item.icon ? (
            <NavIcon name={item.icon} />
          ) : hasChildren(item.id) || (!item.path && !item.parentId) ? (
            <FolderIcon fontSize="small" />
          ) : item.path?.startsWith('http') ? (
            <Typography variant="caption" sx={{ fontSize: '0.9rem', lineHeight: 1 }}>🔗</Typography>
          ) : (
            <InsertDriveFileIcon fontSize="small" />
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.path || '(no path)'}
          </Typography>
        </Box>
        {item.isDefault ? (
          <Chip label="Default" size="small" color="primary" variant="filled" sx={{ height: 20, fontSize: '0.65rem' }} />
        ) : item.path && !item.path.startsWith('http') ? (
          <Chip
            label="Set Default"
            size="small"
            variant="outlined"
            clickable
            onClick={() => handleSetDefault(item)}
            sx={{ height: 20, fontSize: '0.65rem', cursor: 'pointer' }}
          />
        ) : null}
        <Chip label={item.authTier} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
        {item.requiredGroups ? (
          <Chip label={item.requiredGroups} size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
        ) : null}
        <IconButton size="small" onClick={() => openEdit(item)}><EditIcon fontSize="small" /></IconButton>
        <IconButton size="small" color="error" onClick={() => handleDelete(item.id)}><DeleteIcon fontSize="small" /></IconButton>
      </Paper>
    );
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Navigation Manager
          </Typography>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
            Add Item
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Drag items to reorder. Items with children act as folder headers. 
          Use the edit dialog to nest items under a parent or assign security group access.
        </Typography>

        {error ? <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert> : null}
        {success ? <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>Saved.</Alert> : null}

        {/* Batch action toolbar */}
        {selectedIds.size > 0 ? (
          <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', bgcolor: 'action.selected' }}>
            <Typography variant="caption" sx={{ fontWeight: 600, mr: 1 }}>
              {selectedIds.size} selected
            </Typography>
            <Button size="small" variant="outlined" color="error" onClick={() => openBatchDialog('delete')}>
              Delete
            </Button>
            <Button size="small" variant="outlined" onClick={() => openBatchDialog('parent')}>
              Assign Parent
            </Button>
            <Button size="small" variant="outlined" onClick={() => openBatchDialog('tier')}>
              Assign Auth Tier
            </Button>
            <Button size="small" variant="outlined" onClick={() => openBatchDialog('groups')}>
              Assign Groups
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={selectAll}>Select All</Button>
            <Button size="small" onClick={clearSelection}>Clear</Button>
          </Paper>
        ) : null}

        {flatItems.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No navigation items yet. Click "Add Item" to create the first one.
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
            {flatItems.map((item, idx) => renderRow(item, idx))}
          </Box>
        )}
      </Paper>

      {/* ── Create dialog ─────────────────────────────── */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Navigation Item</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Type selector */}
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select value={newType} label="Type" onChange={(e) => setNewType(e.target.value as 'folder' | 'page' | 'link')}>
                <MenuItem value="page">
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <InsertDriveFileIcon fontSize="small" />
                    <span>Page — internal route</span>
                  </Stack>
                </MenuItem>
                <MenuItem value="folder">
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <FolderIcon fontSize="small" />
                    <span>Folder — group children, no path</span>
                  </Stack>
                </MenuItem>
                <MenuItem value="link">
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <span>🔗</span>
                    <span>External Link — full URL</span>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={newType === 'folder' ? 'e.g. Reports' : 'e.g. Dashboard'}
              fullWidth
              required
            />

            {/* Icon selector */}
            <FormControl fullWidth size="small">
              <InputLabel id="create-icon-label">Icon (optional)</InputLabel>
              <Select
                labelId="create-icon-label"
                label="Icon (optional)"
                value={newIcon}
                onChange={(e) => setNewIcon(e.target.value)}
                renderValue={(selected) => {
                  if (!selected) return <em>— No icon —</em>;
                  return (
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <NavIcon name={selected as string} fontSize="small" />
                      <span>{selected as string}</span>
                    </Stack>
                  );
                }}
              >
                <MenuItem value=""><em>— No icon —</em></MenuItem>
                {NAV_ICON_NAMES.map((name) => (
                  <MenuItem key={name} value={name}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <NavIcon name={name} fontSize="small" />
                      <span>{name}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {newType !== 'folder' ? (
              <TextField
                label={newType === 'link' ? 'URL' : 'Path'}
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder={newType === 'link' ? 'https://example.com' : '/dashboard'}
                fullWidth
                helperText={
                  newType === 'link'
                    ? 'Full URL including https://'
                    : 'Internal route path. Leave empty to auto-generate from title.'
                }
              />
            ) : (
              <Typography variant="caption" color="text.secondary">
                Folders act as grouping headers with no navigable path. Add children to create sub-navigation.
              </Typography>
            )}

            <FormControl fullWidth size="small">
              <InputLabel>Parent Item</InputLabel>
              <Select value={newParentId} label="Parent Item" onChange={(e) => setNewParentId(e.target.value)}>
                <MenuItem value="">— Root level —</MenuItem>
                {flatItems.map((item) => (
                  <MenuItem key={item.id} value={item.id}>{'  '.repeat(item.depth)}{item.title}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Auth Tier</InputLabel>
              <Select value={newTier} label="Auth Tier" onChange={(e) => setNewTier(e.target.value as 'public' | 'pin' | 'google')}>
                <MenuItem value="public">Public</MenuItem>
                <MenuItem value="pin">PIN</MenuItem>
                <MenuItem value="google">Google</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel id="create-req-groups-label">Required Groups</InputLabel>
              <Select
                labelId="create-req-groups-label"
                label="Required Groups"
                multiple
                value={newRequiredGroups}
                onChange={(e) => setNewRequiredGroups(e.target.value as string[])}
                renderValue={(selected) =>
                  (selected as string[]).length === 0
                    ? '— None —'
                    : (selected as string[]).map((c) => allSecurityGroups.find((g) => g.code === c)?.name ?? c).join(', ')
                }
              >
                {allSecurityGroups.map((g) => (
                  <MenuItem key={g.code} value={g.code}>
                    <Checkbox checked={newRequiredGroups.includes(g.code)} size="small" />
                    <ListItemText primary={g.name} secondary={g.code} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!newTitle.trim() || saving} onClick={handleCreate}>
            {saving ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit dialog ───────────────────────────────── */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Navigation Item</DialogTitle>
        {editingItem ? (
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Title" value={editingItem.title} onChange={(e) => setEditingItem((p) => p ? { ...p, title: e.target.value } : p)} fullWidth />

              {/* Icon selector in edit dialog */}
                <FormControl fullWidth size="small">
                <InputLabel id="edit-icon-label">Icon (optional)</InputLabel>
                <Select
                  labelId="edit-icon-label"
                  label="Icon (optional)"
                  value={editingItem.icon ?? ''}
                  onChange={(e) => setEditingItem((p) => p ? { ...p, icon: e.target.value } : p)}
                  renderValue={(selected) => {
                    if (!selected) return <em>— No icon —</em>;
                    return (
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <NavIcon name={selected as string} fontSize="small" />
                        <span>{selected as string}</span>
                      </Stack>
                    );
                  }}
                >
                  <MenuItem value=""><em>— No icon —</em></MenuItem>
                  {NAV_ICON_NAMES.map((name) => (
                    <MenuItem key={name} value={name}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <NavIcon name={name} fontSize="small" />
                        <span>{name}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField label="Path" value={editingItem.path} onChange={(e) => setEditingItem((p) => p ? { ...p, path: e.target.value } : p)} fullWidth placeholder="/dashboard" />
              <FormControl fullWidth size="small">
                <InputLabel>Parent Item</InputLabel>
                <Select value={editingItem.parentId ?? ''} label="Parent Item" onChange={(e) => setEditingItem((p) => p ? { ...p, parentId: e.target.value || null } : p)}>
                  <MenuItem value="">— Root level —</MenuItem>
                  {flatItems.filter((i) => i.id !== editingItem.id).map((item) => (
                    <MenuItem key={item.id} value={item.id}>{'  '.repeat(item.depth)}{item.title}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Auth Tier</InputLabel>
                <Select value={editingItem.authTier} label="Auth Tier" onChange={(e) => setEditingItem((p) => p ? { ...p, authTier: e.target.value } : p)}>
                  <MenuItem value="public">Public</MenuItem>
                  <MenuItem value="pin">PIN</MenuItem>
                  <MenuItem value="google">Google</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel id="edit-req-groups-label">Required Groups</InputLabel>
                <Select
                  labelId="edit-req-groups-label"
                  label="Required Groups"
                  multiple
                  value={(editingItem.requiredGroups ?? '').split(',').filter(Boolean)}
                  onChange={(e) => setEditingItem((p) => p ? { ...p, requiredGroups: (e.target.value as string[]).join(',') } : p)}
                  renderValue={(selected) =>
                    (selected as string[]).length === 0
                      ? '— None —'
                      : (selected as string[]).map((c) => allSecurityGroups.find((g) => g.code === c)?.name ?? c).join(', ')
                  }
                >
                  {allSecurityGroups.map((g) => {
                    const selected = (editingItem.requiredGroups ?? '').split(',').filter(Boolean);
                    return (
                      <MenuItem key={g.code} value={g.code}>
                        <Checkbox checked={selected.includes(g.code)} size="small" />
                        <ListItemText primary={g.name} secondary={g.code} />
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
              {/* Apply changes recursively to all children */}
              {editingItem && flatItems.some((i) => i.parentId === editingItem.id) ? (
                <FormControlLabel
                  control={
                    <Switch
                      checked={applyRecursive}
                      onChange={(e) => setApplyRecursive(e.target.checked)}
                    />
                  }
                  label="Apply to all children recursively"
                />
              ) : null}

              <FormControlLabel control={<Switch checked={editingItem.isVisible} onChange={(e) => setEditingItem((p) => p ? { ...p, isVisible: e.target.checked } : p)} />} label="Visible in navigation" />
              <FormControlLabel control={<Switch checked={editingItem.isDynamic} onChange={(e) => setEditingItem((p) => p ? { ...p, isDynamic: e.target.checked } : p)} />} label="Dynamic route /[slug]" />
            </Stack>
          </DialogContent>
        ) : null}
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={saving} onClick={handleEditSave} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Batch action dialog ────────────────────────── */}
      <Dialog open={batchDialogOpen} onClose={() => setBatchDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {batchDialogMode === 'delete' ? `Delete ${selectedIds.size} item(s)?` :
           batchDialogMode === 'parent' ? `Assign parent to ${selectedIds.size} item(s)` :
           batchDialogMode === 'tier' ? `Assign auth tier to ${selectedIds.size} item(s)` :
           batchDialogMode === 'groups' ? `Assign groups to ${selectedIds.size} item(s)` : ''}
        </DialogTitle>
        <DialogContent dividers>
          {batchDialogMode === 'delete' ? (
            <Typography variant="body2" color="text.secondary">
              This will delete {selectedIds.size} navigation item(s). Children of deleted items will be moved to root level.
            </Typography>
          ) : null}

          {batchDialogMode === 'parent' ? (
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel>Parent Item</InputLabel>
              <Select value={batchParentId} label="Parent Item" onChange={(e) => setBatchParentId(e.target.value)}>
                <MenuItem value="">— Root level —</MenuItem>
                {flatItems
                  .filter((i) => !selectedIds.has(i.id))
                  .map((item) => (
                    <MenuItem key={item.id} value={item.id}>{'  '.repeat(item.depth)}{item.title}</MenuItem>
                  ))
                }
              </Select>
            </FormControl>
          ) : null}

          {batchDialogMode === 'tier' ? (
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel>Auth Tier</InputLabel>
              <Select value={batchTier} label="Auth Tier" onChange={(e) => setBatchTier(e.target.value as 'public' | 'pin' | 'google')}>
                <MenuItem value="public">Public</MenuItem>
                <MenuItem value="pin">PIN</MenuItem>
                <MenuItem value="google">Google</MenuItem>
              </Select>
            </FormControl>
          ) : null}

          {batchDialogMode === 'groups' ? (
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel id="batch-groups-label">Required Groups</InputLabel>
              <Select
                labelId="batch-groups-label"
                label="Required Groups"
                multiple
                value={batchGroups}
                onChange={(e) => setBatchGroups(e.target.value as string[])}
                renderValue={(selected) =>
                  (selected as string[]).length === 0
                    ? '— None —'
                    : (selected as string[]).map((c) => allSecurityGroups.find((g) => g.code === c)?.name ?? c).join(', ')
                }
              >
                {allSecurityGroups.map((g) => (
                  <MenuItem key={g.code} value={g.code}>
                    <Checkbox checked={batchGroups.includes(g.code)} size="small" />
                    <ListItemText primary={g.name} secondary={g.code} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color={batchDialogMode === 'delete' ? 'error' : 'primary'}
            disabled={saving}
            onClick={batchDialogMode === 'delete' ? handleBatchDelete : handleBatchAssign}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {saving ? 'Saving...' : batchDialogMode === 'delete' ? 'Delete' : 'Apply'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
