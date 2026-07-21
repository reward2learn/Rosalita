'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SaveIcon from '@mui/icons-material/Save';
import ImageIcon from '@mui/icons-material/Image';
import DeleteIcon from '@mui/icons-material/Delete';
import PaletteIcon from '@mui/icons-material/Palette';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface BrandConfig {
  brandLogoText: string;
  brandLogoUrl: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  updatedAt?: string;
}

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

function isValidHex(c: string): boolean {
  return HEX_REGEX.test(c);
}

export function BrandConfigTab() {
  const [config, setConfig] = useState<BrandConfig>({
    brandLogoText: '',
    brandLogoUrl: '',
    brandPrimaryColor: '#eb3d28',
    brandSecondaryColor: '#0af9fe',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/brand-config');
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const payload = await res.json();
      if (payload.success) {
        setConfig(payload.data);
        setLogoPreview(payload.data.brandLogoUrl || null);
      } else {
        throw new Error(payload.error ?? 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    // Validate hex colors
    if (!isValidHex(config.brandPrimaryColor)) {
      setError('Primary color must be a valid hex color (e.g. #eb3d28)');
      setSaving(false);
      return;
    }
    if (!isValidHex(config.brandSecondaryColor)) {
      setError('Secondary color must be a valid hex color (e.g. #0af9fe)');
      setSaving(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('brandLogoText', config.brandLogoText);
      formData.append('brandPrimaryColor', config.brandPrimaryColor);
      formData.append('brandSecondaryColor', config.brandSecondaryColor);

      // Include the logo URL if we have one (either existing or newly uploaded)
      if (logoPreview && logoPreview.startsWith('data:')) {
        formData.append('brandLogoUrl', logoPreview);
      } else if (config.brandLogoUrl && config.brandLogoUrl.startsWith('data:')) {
        formData.append('brandLogoUrl', config.brandLogoUrl);
      }

      const res = await fetch('/api/admin/brand-config', {
        method: 'PUT',
        body: formData,
      });

      const payload = await res.json();
      if (payload.success) {
        setConfig(payload.data);
        setLogoPreview(payload.data.brandLogoUrl || null);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        throw new Error(payload.error ?? 'Save failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [config.brandLogoText, config.brandPrimaryColor, config.brandSecondaryColor, logoPreview]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Logo image must be under 2 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLogoPreview(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleRemoveLogo = useCallback(() => {
    setLogoPreview(null);
    setConfig((prev) => ({ ...prev, brandLogoUrl: '' }));
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Brand Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure the logo, colors, and branding displayed across the application.
          Changes take effect immediately.
        </Typography>

        <Stack spacing={3}>
          {/* ── Logo text ─────────────────────────────── */}
          <TextField
            label="Logo Text"
            placeholder="e.g. Red Ruby Bali"
            value={config.brandLogoText}
            onChange={(e) => setConfig((prev) => ({ ...prev, brandLogoText: e.target.value }))}
            fullWidth
            helperText="This text appears in the top-left header when no logo image is set."
          />

          {/* ── Logo image upload ─────────────────────── */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Logo Image
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
              Upload a logo image (PNG, JPG, SVG, WebP — max 2 MB). Replaces the text logo in the header.
            </Typography>

            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Avatar
                src={logoPreview ?? undefined}
                variant="rounded"
                sx={{
                  width: 60,
                  height: 60,
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                  '& img': { objectFit: 'contain' },
                }}
              >
                <ImageIcon color="disabled" />
              </Avatar>

              <Button variant="outlined" component="label" startIcon={<ImageIcon />}>
                {logoPreview ? 'Replace Image' : 'Upload Logo'}
                <input
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />
              </Button>

              {logoPreview ? (
                <Button variant="text" color="error" startIcon={<DeleteIcon />} onClick={handleRemoveLogo}>
                  Remove
                </Button>
              ) : null}
            </Stack>

            {/* Live preview */}
            {config.brandLogoText || logoPreview ? (
              <Paper
                variant="outlined"
                sx={{
                  mt: 2,
                  p: 2,
                  bgcolor: 'background.default',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                  Preview:
                </Typography>
                {logoPreview ? (
                  <Box
                    component="img"
                    src={logoPreview}
                    alt="Logo preview"
                    sx={{ height: 28, width: 'auto', maxWidth: 160, objectFit: 'contain' }}
                  />
                ) : (
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: config.brandPrimaryColor }}>
                    {config.brandLogoText || '(no logo text set)'}
                  </Typography>
                )}
              </Paper>
            ) : null}
          </Box>

          {/* ── Brand colors ──────────────────────────── */}
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              <PaletteIcon color="primary" />
              <Typography variant="subtitle2">Brand Colors</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              These colors are used as the application&apos;s primary and secondary theme colors
              (buttons, links, highlights, accents). Enter hex values (e.g. <code>#eb3d28</code>).
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {/* Primary color */}
              <Box sx={{ flex: 1 }}>
                <TextField
                  label="Primary Color"
                  placeholder="#eb3d28"
                  value={config.brandPrimaryColor}
                  onChange={(e) => setConfig((prev) => ({ ...prev, brandPrimaryColor: e.target.value }))}
                  error={config.brandPrimaryColor.length > 0 && !isValidHex(config.brandPrimaryColor)}
                  helperText={
                    config.brandPrimaryColor.length > 0 && !isValidHex(config.brandPrimaryColor)
                      ? 'Invalid hex color'
                      : 'Used for buttons, links, and highlights'
                  }
                  fullWidth
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '4px',
                              bgcolor: isValidHex(config.brandPrimaryColor) ? config.brandPrimaryColor : '#eb3d28',
                              border: '1px solid',
                              borderColor: 'divider',
                              flexShrink: 0,
                            }}
                          />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                {/* Native color picker */}
                <input
                  type="color"
                  value={isValidHex(config.brandPrimaryColor) ? config.brandPrimaryColor : '#eb3d28'}
                  onChange={(e) => setConfig((prev) => ({ ...prev, brandPrimaryColor: e.target.value }))}
                  style={{
                    width: '100%',
                    height: 32,
                    marginTop: 4,
                    padding: 0,
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 6,
                    background: 'none',
                    cursor: 'pointer',
                  }}
                />
              </Box>

              {/* Secondary color */}
              <Box sx={{ flex: 1 }}>
                <TextField
                  label="Secondary Color"
                  placeholder="#0af9fe"
                  value={config.brandSecondaryColor}
                  onChange={(e) => setConfig((prev) => ({ ...prev, brandSecondaryColor: e.target.value }))}
                  error={config.brandSecondaryColor.length > 0 && !isValidHex(config.brandSecondaryColor)}
                  helperText={
                    config.brandSecondaryColor.length > 0 && !isValidHex(config.brandSecondaryColor)
                      ? 'Invalid hex color'
                      : 'Used for accents and secondary elements'
                  }
                  fullWidth
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '4px',
                              bgcolor: isValidHex(config.brandSecondaryColor) ? config.brandSecondaryColor : '#0af9fe',
                              border: '1px solid',
                              borderColor: 'divider',
                              flexShrink: 0,
                            }}
                          />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <input
                  type="color"
                  value={isValidHex(config.brandSecondaryColor) ? config.brandSecondaryColor : '#0af9fe'}
                  onChange={(e) => setConfig((prev) => ({ ...prev, brandSecondaryColor: e.target.value }))}
                  style={{
                    width: '100%',
                    height: 32,
                    marginTop: 4,
                    padding: 0,
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 6,
                    background: 'none',
                    cursor: 'pointer',
                  }}
                />
              </Box>
            </Stack>

            {/* Color preview bar */}
            <Paper
              variant="outlined"
              sx={{
                mt: 2,
                p: 2,
                bgcolor: 'background.default',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Preview:
              </Typography>
              <Box
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 1,
                  bgcolor: isValidHex(config.brandPrimaryColor) ? config.brandPrimaryColor : '#eb3d28',
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                Primary Button
              </Box>
              <Box
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: isValidHex(config.brandSecondaryColor) ? config.brandSecondaryColor : '#0af9fe',
                  color: isValidHex(config.brandSecondaryColor) ? config.brandSecondaryColor : '#0af9fe',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                Secondary Accent
              </Box>
            </Paper>
          </Box>

          {/* ── Status alerts ─────────────────────────── */}
          {error ? (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          ) : null}

          {success ? (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              Brand configuration saved. Refresh any page to see the changes.
            </Alert>
          ) : null}

          {/* ── Save button ───────────────────────────── */}
          <Box>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
              sx={{ py: 1.25 }}
            >
              {saving ? 'Saving...' : 'Save Brand Configuration'}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}
