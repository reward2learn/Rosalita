'use client';

import { useCallback, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  getTemplate,
  listTemplates,
  isSlugAvailable,
  type TemplateDefinition,
} from '@/domain/tenant/template-catalog';
import {
  useCreateTenantMutation,
} from '@/store/apis/tenant-api';

const STEPS = ['Business Info', 'Template', 'Branding', 'Review'];

interface WizardState {
  slug: string;
  displayName: string;
  template: string;
  primaryColor: string;
  secondaryColor: string;
}

const INITIAL_STATE: WizardState = {
  slug: '',
  displayName: '',
  template: 'default',
  primaryColor: '#eb3d28',
  secondaryColor: '#0af9fe',
};

export function TenantWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [createTenant, { isLoading, isError, error, isSuccess, data }] = useCreateTenantMutation();

  const handleOpen = () => { setOpen(true); setStep(0); setState(INITIAL_STATE); };
  const handleClose = () => { if (!isLoading) { setOpen(false); setStep(0); } };

  const update = useCallback((patch: Partial<WizardState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      // Auto-derive colors from template
      if (patch.template && !patch.primaryColor) {
        const tpl = getTemplate(patch.template);
        next.primaryColor = tpl.defaultColors.primary;
        next.secondaryColor = tpl.defaultColors.secondary;
      }
      return next;
    });
  }, []);

  const validateSlug = (slug: string): string | null => {
    if (!slug) return 'Business name is required';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'Use lowercase letters, numbers, and hyphens only';
    if (slug.length < 2) return 'Must be at least 2 characters';
    if (!isSlugAvailable(slug)) return 'This name is reserved or unavailable';
    return null;
  };

  const handleNext = () => {
    if (step === 0) {
      const err = validateSlug(state.slug);
      if (err) { setSlugError(err); return; }
      if (!state.displayName.trim()) { setSlugError('Display name is required'); return; }
      setSlugError(null);
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => s - 1);

  const handleCreate = async () => {
    const result = await createTenant({
      slug: state.slug,
      displayName: state.displayName.trim(),
      template: state.template,
      primaryColor: state.primaryColor,
      secondaryColor: state.secondaryColor,
    }).unwrap();
    if (result.success) {
      setStep(4); // Show success
    }
  };

  const templates = listTemplates();
  const selectedTemplate = getTemplate(state.template);

  return (
    <>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={handleOpen}
        sx={{ fontWeight: 600 }}
      >
        New Tenant
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Create New Tenant Application
        </DialogTitle>
        <DialogContent dividers>
          <Stepper activeStep={step} sx={{ mb: 4 }}>
            {STEPS.map((label) => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>

          {/* Step 0: Business Info */}
          {step === 0 ? (
            <Stack spacing={3}>
              <Typography variant="body2" color="text.secondary">
                Choose a unique business name for your application. This will be used as your subdomain
                (e.g. <strong>mybusiness.vercel.app</strong>) and appears in page titles and headers.
              </Typography>
              <TextField
                label="Business Slug"
                placeholder="my-business-name"
                value={state.slug}
                onChange={(e) => {
                  const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                  setState((p) => ({ ...p, slug: v }));
                  if (slugError) setSlugError(null);
                }}
                error={Boolean(slugError)}
                helperText={slugError ?? 'Lowercase letters, numbers, and hyphens. This becomes your subdomain.'}
                fullWidth
                autoFocus
                slotProps={{
                  input: {
                    startAdornment: (
                      <Typography variant="body2" color="text.disabled" sx={{ mr: 0.5 }}>
                        https://
                      </Typography>
                    ),
                    endAdornment: (
                      <Typography variant="body2" color="text.disabled">
                        .vercel.app
                      </Typography>
                    ),
                  },
                }}
              />
              <TextField
                label="Display Name"
                placeholder="My Business Name"
                value={state.displayName}
                onChange={(e) => setState((p) => ({ ...p, displayName: e.target.value }))}
                fullWidth
                helperText="Human-readable name shown in the header and page titles."
              />
            </Stack>
          ) : null}

          {/* Step 1: Template */}
          {step === 1 ? (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Select a template that matches your business type. Each template includes
                pre-configured pages, navigation, and default settings.
              </Typography>
              <Grid container spacing={2}>
                {templates.map((tpl) => {
                  const selected = state.template === tpl.id;
                  return (
                    <Grid key={tpl.id} size={{ xs: 12, sm: 6 }}>
                      <Card
                        variant="outlined"
                        sx={{
                          borderColor: selected ? 'primary.main' : 'divider',
                          borderWidth: selected ? 2 : 1,
                          bgcolor: selected ? 'rgba(235,61,40,0.06)' : undefined,
                        }}
                      >
                        <CardActionArea onClick={() => update({ template: tpl.id })}>
                          <CardContent>
                            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                {tpl.label}
                              </Typography>
                              {selected ? (
                                <CheckCircleIcon color="primary" fontSize="small" />
                              ) : null}
                            </Stack>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              {tpl.description}
                            </Typography>
                            <Stack direction="row" spacing={0.5} sx={{ mt: 1.5, flexWrap: 'wrap' }} useFlexGap>
                              {tpl.defaultPages.slice(0, 4).map((p) => (
                                <Chip key={p.slug} label={p.title} size="small" variant="outlined" />
                              ))}
                              {tpl.defaultPages.length > 4 ? (
                                <Chip label={`+${tpl.defaultPages.length - 4} more`} size="small" variant="outlined" />
                              ) : null}
                            </Stack>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Stack>
          ) : null}

          {/* Step 2: Branding */}
          {step === 2 ? (
            <Stack spacing={3}>
              <Typography variant="body2" color="text.secondary">
                Customize the brand colors for your application. These are used for buttons, links, and accents.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    label="Primary Color"
                    value={state.primaryColor}
                    onChange={(e) => setState((p) => ({ ...p, primaryColor: e.target.value }))}
                    fullWidth
                    helperText="Used for buttons, links, and highlights"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <Box sx={{ width: 24, height: 24, borderRadius: 1, bgcolor: state.primaryColor, border: '1px solid', borderColor: 'divider', mr: 1 }} />
                        ),
                      },
                    }}
                  />
                  <Box sx={{ mt: 0.5 }}>
                    <input
                      type="color"
                      value={state.primaryColor}
                      onChange={(e) => setState((p) => ({ ...p, primaryColor: e.target.value }))}
                      style={{ width: '100%', height: 32, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, background: 'none', cursor: 'pointer' }}
                    />
                  </Box>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    label="Secondary Color"
                    value={state.secondaryColor}
                    onChange={(e) => setState((p) => ({ ...p, secondaryColor: e.target.value }))}
                    fullWidth
                    helperText="Used for accents and secondary elements"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <Box sx={{ width: 24, height: 24, borderRadius: 1, bgcolor: state.secondaryColor, border: '1px solid', borderColor: 'divider', mr: 1 }} />
                        ),
                      },
                    }}
                  />
                  <Box sx={{ mt: 0.5 }}>
                    <input
                      type="color"
                      value={state.secondaryColor}
                      onChange={(e) => setState((p) => ({ ...p, secondaryColor: e.target.value }))}
                      style={{ width: '100%', height: 32, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, background: 'none', cursor: 'pointer' }}
                    />
                  </Box>
                </Box>
              </Stack>
              {/* Preview */}
              <Paper variant="outlined" sx={{ p: 2.5, bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                  Preview
                </Typography>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Box sx={{ px: 2, py: 1, borderRadius: 1, bgcolor: state.primaryColor, color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
                    Primary Button
                  </Box>
                  <Box sx={{ px: 2, py: 1, borderRadius: 1, border: '1px solid', borderColor: state.secondaryColor, color: state.secondaryColor, fontSize: '0.8rem', fontWeight: 700 }}>
                    Secondary
                  </Box>
                  <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: state.primaryColor }} />
                  <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: state.secondaryColor }} />
                </Stack>
              </Paper>
            </Stack>
          ) : null}

          {/* Step 3: Review */}
          {step === 3 ? (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Review your tenant configuration before creating.
              </Typography>
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Slug</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{state.slug}.vercel.app</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Display Name</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{state.displayName}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Template</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {selectedTemplate.label} — {selectedTemplate.defaultPages.length} pages, {selectedTemplate.defaultNavItems.length} nav items
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      size="small"
                      label={`Primary: ${state.primaryColor}`}
                      sx={{ bgcolor: state.primaryColor, color: '#fff' }}
                    />
                    <Chip
                      size="small"
                      label={`Secondary: ${state.secondaryColor}`}
                      sx={{ bgcolor: state.secondaryColor, color: '#000' }}
                    />
                  </Stack>
                </Stack>
              </Paper>
            </Stack>
          ) : null}

          {/* Step 4: Success */}
          {step === 4 ? (
            <Stack spacing={2} sx={{ textAlign: 'center', py: 3 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 64, mx: 'auto' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Tenant Created!
              </Typography>
              <Typography variant="body1" color="text.secondary">
                <strong>{state.displayName}</strong> has been registered. It will appear in the tenant list below with <Chip label="draft" size="small" color="info" /> status.
              </Typography>
              {data?.data?.tenant?.id ? (
                <Typography variant="body2" color="text.secondary">
                  Tenant ID: {data.data.tenant.id}
                </Typography>
              ) : null}
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => { setStep(0); setState(INITIAL_STATE); }}
                >
                  Create Another
                </Button>
                <Button
                  variant="contained"
                  onClick={handleClose}
                >
                  View Tenant List
                </Button>
              </Stack>
            </Stack>
          ) : null}

          {/* Error display */}
          {isError && error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {'data' in error ? (error.data as { error?: string })?.error ?? 'Creation failed' : 'Creation failed'}
            </Alert>
          ) : null}
        </DialogContent>

        {step < 4 ? (
          <DialogActions>
            {step > 0 ? (
              <Button onClick={handleBack} disabled={isLoading}>
                Back
              </Button>
            ) : (
              <Button onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            {step < 3 ? (
              <Button variant="contained" onClick={handleNext}>
                Continue
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                onClick={() => void handleCreate()}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : undefined}
              >
                {isLoading ? 'Creating...' : 'Create Tenant'}
              </Button>
            )}
          </DialogActions>
        ) : null}
      </Dialog>
    </>
  );
}
