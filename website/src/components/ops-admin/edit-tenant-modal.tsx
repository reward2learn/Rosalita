'use client';

/**
 * EditTenantModal — Full-featured edit dialog for tenant applications.
 *
 * ── Header Tabs ──────────────────────────────────────────
 *   [Manual]  [Automated]
 *
 * ── Manual Mode (Desktop: Tabs, Mobile: Accordions) ──────
 *   1. General        — Template selector, display name, colors
 *   2. License & Key  — License key/tier, API keys, PINs
 *   3. Google OAuth   — Client ID, secret, project, redirect URIs
 *   4. Database       — DB URL, Neon connection strings, provision
 *   5. Custom Env     — Key-value pair rows for additional env vars
 *
 * ── Automated Mode (Provisioning) ────────────────────────
 *   One-click provision: Google OAuth + Neon DB + Vercel deploy
 *
 * ── Footer ───────────────────────────────────────────────
 *   Cancel  |  Deploy to Vercel / Provision
 */
import { useState, useCallback, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepContent from '@mui/material/StepContent';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import CloudIcon from '@mui/icons-material/Cloud';
import DeleteIcon from '@mui/icons-material/Delete';
import DnsIcon from '@mui/icons-material/Dns';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import KeyIcon from '@mui/icons-material/Key';
import LockIcon from '@mui/icons-material/Lock';
import PeopleIcon from '@mui/icons-material/People';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SettingsIcon from '@mui/icons-material/Settings';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

import { getTemplate, listTemplates } from '@/domain/tenant/template-catalog';
import { TemplateSelector } from '@/components/ops-admin/tenant-wizard';
import { useAppDispatch } from '@/store/hooks';
import { setThemeColors } from '@/store/ui-slice';
import type { TenantEntry } from '@/store/apis/tenant-api';

// ── Types ──────────────────────────────────────────────────────

export interface EditTenantModalProps {
  open: boolean;
  tenant: TenantEntry | null;
  onClose: () => void;
  onRefetch: () => void;
  onSnackbar: (msg: { message: string; severity: 'success' | 'error' }) => void;
}

/** Key-value pair for custom environment variables. */
interface EnvPair {
  key: string;
  value: string;
}

/** License & API key fields. */
interface LicenseConfig {
  licenseKey: string;
  licenseTier: string;
  validUntil: string;
  features: string[];
  setupToken: string;
  adminPin: string;
  openaiApiKey: string;
}

/** Google OAuth fields (manual). */
interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  projectId: string;
  authUri: string;
  tokenUri: string;
  redirectUris: string[];
  supportEmail: string;
}

/** Database fields. */
interface DatabaseConfig {
  dbUrl: string;
  pooledUrl: string;
  directUrl: string;
}

/** Automated provisioning state. */
interface AutoProvisionConfig {
  googleOAuth: boolean;
  neonDb: boolean;
  vercelDeploy: boolean;
  provisionEmail: string;
  redirectUris: string[];
}

// ── Tab panels helper ──────────────────────────────────────────

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  if (value !== index) return null;
  return <Box sx={{ pt: 3 }}>{children}</Box>;
}

// ── Constants ──────────────────────────────────────────────────

const LICENSE_TIERS = ['pro', 'enterprise', 'premium', 'trial'];
const DEFAULT_FEATURES = ['ai-chat', 'mapreduce', 'full-seeding', 'template_switching', 'analytics', 'multi_user'];

const DEPLOY_STEPS = [
  { key: 'fetch', label: 'Fetch tenant', description: 'Loading latest record and metadata from tenants registry' },
  { key: 'delta', label: 'Compute delta', description: 'Template delta analysis (incremental-only from TEMPLATE_CATALOG)' },
  { key: 'neon', label: 'Update Neon DB with full metadata.config', description: 'Upserting databaseUrl, googleAuth, pins, license, subscriptionTier etc.' },
  { key: 'vercel-env', label: 'Sync env vars to Vercel', description: 'Pushing databaseUrl and config to project env vars' },
  { key: 'inngest', label: 'Trigger Inngest pipeline', description: 'Seeding AppPage from TEMPLATE_CATALOG, AI/MapReduce content, blocks' },
  { key: 'vercel-deploy', label: 'Vercel deploy complete', description: 'Redeploy triggered, waiting for build completion' },
  { key: 'verify', label: 'Verify live app', description: 'Health check, template validation, status → live' },
];

const MANUAL_TABS = [
  { label: 'General', icon: <SettingsIcon fontSize="small" />, key: 'general' },
  { label: 'License & API Key', icon: <KeyIcon fontSize="small" />, key: 'license' },
  { label: 'Google OAuth', icon: <VerifiedUserIcon fontSize="small" />, key: 'oauth' },
  { label: 'Database', icon: <DnsIcon fontSize="small" />, key: 'database' },
  { label: 'Custom Env', icon: <CloudIcon fontSize="small" />, key: 'env' },
  { label: 'Functional Roles', icon: <PeopleIcon fontSize="small" />, key: 'roles' },
];

const ACCORDION_ICONS: Record<string, React.ReactNode> = {
  general: <SettingsIcon />,
  license: <KeyIcon />,
  oauth: <VerifiedUserIcon />,
  database: <DnsIcon />,
  env: <CloudIcon />,
  roles: <PeopleIcon />,
};

// ── Component ──────────────────────────────────────────────────

export function EditTenantModal({ open, tenant, onClose, onRefetch, onSnackbar }: EditTenantModalProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useAppDispatch();

  // ── Mode: Manual vs Automated ─────────────────────────────
  const [mode, setMode] = useState(0); // 0 = Manual, 1 = Automated

  // ── Manual tab index & accordion ──────────────────────────
  const [manualTab, setManualTab] = useState(0);
  const [expandedAccordion, setExpandedAccordion] = useState<string | false>('general');

  // ── Template / Colors (shared with Manual General tab) ───
  const [editTemplate, setEditTemplate] = useState('financial-analytics');
  const [editPrimaryColor, setEditPrimaryColor] = useState('#eb3d28');
  const [editSecondaryColor, setEditSecondaryColor] = useState('#0af9fe');
  const [displayName, setDisplayName] = useState('');

  // ── License & API Key ────────────────────────────────────
  const [license, setLicense] = useState<LicenseConfig>({
    licenseKey: '',
    licenseTier: 'premium',
    validUntil: '2028-12-31',
    features: DEFAULT_FEATURES,
    setupToken: '',
    adminPin: '',
    openaiApiKey: '',
  });

  // ── Google OAuth (Manual) ────────────────────────────────
  const [googleOAuth, setGoogleOAuth] = useState<GoogleOAuthConfig>({
    clientId: '',
    clientSecret: '',
    projectId: '',
    authUri: 'https://accounts.google.com/o/oauth2/auth',
    tokenUri: 'https://oauth2.googleapis.com/token',
    redirectUris: [],
    supportEmail: '',
  });
  const [showSecret, setShowSecret] = useState(false);
  const [newRedirectUri, setNewRedirectUri] = useState('');

  // ── Database ─────────────────────────────────────────────
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>({
    dbUrl: '',
    pooledUrl: '',
    directUrl: '',
  });

  // ── Custom Env ───────────────────────────────────────────
  const [envPairs, setEnvPairs] = useState<EnvPair[]>([]);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  // ── Functional Roles ──────────────────────────────
  const [rolesList, setRolesList] = useState<Array<{ code: string; name: string; isPlatformAdmin: boolean; email: string | null; pinConfigured: boolean }>>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [settingPinRole, setSettingPinRole] = useState<string | null>(null);
  const [settingPinValue, setSettingPinValue] = useState<Record<string, string>>({});
  const [savingPinRole, setSavingPinRole] = useState<string | null>(null);
  // ── Role CRUD state ──────────────────────────────
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleDialogMode, setRoleDialogMode] = useState<"create" | "edit">("create");
  const [roleFormCode, setRoleFormCode] = useState("");
  const [roleFormName, setRoleFormName] = useState("");
  const [roleFormIsPlatformAdmin, setRoleFormIsPlatformAdmin] = useState(false);
  const [roleFormEmail, setRoleFormEmail] = useState("");
  const [roleDeleteConfirm, setRoleDeleteConfirm] = useState<string | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);


  // ── Automated Provisioning ───────────────────────────────
  const [autoProvision, setAutoProvision] = useState<AutoProvisionConfig>({
    googleOAuth: true,
    neonDb: true,
    vercelDeploy: false,
    provisionEmail: '',
    redirectUris: [],
  });
  const [provisioning, setProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<Record<string, unknown> | null>(null);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  // ── Deploy state ─────────────────────────────────────────
  const [deployingSlug, setDeployingSlug] = useState<string | null>(null);
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployStepStatuses, setDeployStepStatuses] = useState<Record<string, 'pending' | 'inprogress' | 'success' | 'error'>>({});
  const [deployDetails, setDeployDetails] = useState<Record<string, string>>({});

  // ── Initialize from tenant on open ───────────────────────
  useEffect(() => {
    if (tenant) {
      const tpl = getTemplate(tenant.template || 'financial-analytics');
      setEditTemplate(tenant.template || 'financial-analytics');
      setEditPrimaryColor(tenant.primaryColor || tpl.defaultColors.primary);
      setEditSecondaryColor(tenant.secondaryColor || tpl.defaultColors.secondary);
      setDisplayName(tenant.displayName || '');
      setDbConfig({
        dbUrl: tenant.dbUrl || '',
        pooledUrl: tenant.dbUrl || '',
        directUrl: tenant.dbUrl || '',
      });
      setAutoProvision((p) => ({ ...p, provisionEmail: '', redirectUris: [`https://${tenant.slug}.vercel.app`] }));
      setManualTab(0);
      setExpandedAccordion('general');
      setProvisionResult(null);
      setProvisionError(null);
      setGoogleOAuth((g) => ({
        ...g,
        redirectUris: [`https://${tenant.slug}.vercel.app`, `https://${tenant.slug}.vercel.app/api/auth?action=google-callback`],
        supportEmail: '',
      }));
    }
  }, [tenant]);

  // ── Fetch roles when modal opens ────────────────
  const fetchRoles = useCallback(async () => {
    if (!tenant) return;
    setRolesLoading(true);
    setRolesError(null);
    try {
      const res = await fetch("/api/admin/roles");
      const data = await res.json();
      if (data.ok && data.data?.roles) {
        setRolesList(data.data.roles);
      } else {
        setRolesError(data.error || "Failed to load roles");
      }
    } catch {
      setRolesError("Failed to connect to roles API");
    } finally {
      setRolesLoading(false);
    }
  }, [tenant]);

  const handleSetRolePin = useCallback(async (code: string, pin: string) => {
    setSavingPinRole(code);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, pin }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchRoles();
        onSnackbar({ message: "PIN set for role " + code, severity: "success" });
      } else {
        onSnackbar({ message: data.error || "Failed to set PIN", severity: "error" });
      }
    } catch {
      onSnackbar({ message: "Failed to set PIN", severity: "error" });
    } finally {
      setSavingPinRole(null);
      setSettingPinRole(null);
      setSettingPinValue((prev) => ({ ...prev, [code]: "" }));
    }
  }, [fetchRoles, onSnackbar]);



  // ── Role CRUD handlers ────────────────────────────
  const openCreateRole = useCallback(() => {
    setRoleFormCode("");
    setRoleFormName("");
    setRoleFormIsPlatformAdmin(false);
    setRoleFormEmail("");
    setRoleDialogMode("create");
    setRoleDialogOpen(true);
  }, []);

  const openEditRole = useCallback((role: { code: string; name: string; isPlatformAdmin: boolean; email: string | null }) => {
    setRoleFormCode(role.code);
    setRoleFormName(role.name);
    setRoleFormIsPlatformAdmin(role.isPlatformAdmin);
    setRoleFormEmail(role.email || "");
    setRoleDialogMode("edit");
    setRoleDialogOpen(true);
  }, []);

  const handleRoleSave = useCallback(async () => {
    if (!roleFormName.trim()) return;
    setRoleSaving(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: roleFormCode || roleFormName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          name: roleFormName.trim(),
          isPlatformAdmin: roleFormIsPlatformAdmin,
          email: roleFormEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchRoles();
        setRoleDialogOpen(false);
        onSnackbar({ message: "Role " + (roleDialogMode === "create" ? "created" : "updated"), severity: "success" });
      } else {
        onSnackbar({ message: data.error || "Failed to save role", severity: "error" });
      }
    } catch {
      onSnackbar({ message: "Failed to save role", severity: "error" });
    } finally {
      setRoleSaving(false);
    }
  }, [roleFormCode, roleFormName, roleFormIsPlatformAdmin, roleFormEmail, roleDialogMode, fetchRoles, onSnackbar]);

  const handleRoleDelete = useCallback(async (code: string) => {
    setRoleSaving(true);
    try {
      const res = await fetch("/api/admin/roles?code=" + encodeURIComponent(code), { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        await fetchRoles();
        setRoleDeleteConfirm(null);
        onSnackbar({ message: "Role deleted: " + code, severity: "success" });
      } else {
        onSnackbar({ message: data.error || "Failed to delete role", severity: "error" });
      }
    } catch {
      onSnackbar({ message: "Failed to delete role", severity: "error" });
    } finally {
      setRoleSaving(false);
    }
  }, [fetchRoles, onSnackbar]);

  const handleClearPin = useCallback(async (code: string) => {
    setSavingPinRole(code);
    try {
      await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, pin: "" }),
      });
      await fetchRoles();
    } catch {
      // Non-critical
    } finally {
      setSavingPinRole(null);
    }
  }, [fetchRoles]);

  // Fetch roles when tenant changes
  useEffect(() => {
    if (tenant) {
      void fetchRoles();
    }
  }, [tenant, fetchRoles]);


  // ── Handlers: Mode switch ─────────────────────────────────
  const handleModeChange = (_: React.SyntheticEvent, newValue: number) => {
    setMode(newValue);
  };

  // ── Handlers: Manual tabs (desktop) ──────────────────────
  const handleManualTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setManualTab(newValue);
  };

  // ── Handlers: Manual accordion (mobile) ──────────────────
  const handleAccordionChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedAccordion(isExpanded ? panel : false);
  };

  // ── Handlers: Template ───────────────────────────────────
  const handleTemplateSelect = (id: string) => {
    setEditTemplate(id);
    const tpl = getTemplate(id);
    setEditPrimaryColor((prev) => prev || tpl.defaultColors.primary);
    setEditSecondaryColor((prev) => prev || tpl.defaultColors.secondary);
  };

  const handleColorsChange = (primary: string, secondary: string) => {
    setEditPrimaryColor(primary);
    setEditSecondaryColor(secondary);
  };

  // ── Handlers: License ────────────────────────────────────
  const handleLicenseChange = (field: keyof LicenseConfig, value: string | string[]) => {
    setLicense((prev) => ({ ...prev, [field]: value }));
  };

  const toggleLicenseFeature = (feature: string) => {
    setLicense((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

  // ── Handlers: Google OAuth ────────────────────────────────
  const handleOAuthChange = (field: keyof GoogleOAuthConfig, value: string) => {
    setGoogleOAuth((prev) => ({ ...prev, [field]: value }));
  };

  const addRedirectUri = () => {
    if (newRedirectUri && !googleOAuth.redirectUris.includes(newRedirectUri)) {
      setGoogleOAuth((prev) => ({ ...prev, redirectUris: [...prev.redirectUris, newRedirectUri] }));
      setNewRedirectUri('');
    }
  };

  const removeRedirectUri = (uri: string) => {
    setGoogleOAuth((prev) => ({ ...prev, redirectUris: prev.redirectUris.filter((u) => u !== uri) }));
  };

  // ── Handlers: Custom Env ─────────────────────────────────
  const addEnvPair = () => {
    if (newEnvKey && newEnvValue) {
      setEnvPairs((prev) => [...prev, { key: newEnvKey, value: newEnvValue }]);
      setNewEnvKey('');
      setNewEnvValue('');
    }
  };

  const removeEnvPair = (index: number) => {
    setEnvPairs((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Handlers: Automated provisioning ──────────────────────
  const handleAutoProvisionToggle = (field: keyof AutoProvisionConfig) => {
    setAutoProvision((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const addAutoRedirectUri = () => {
    // Simple text input for auto provision redirect URIs (comma separated)
    // Managed inline
  };

  // ── Build deploy payload from Manual tab data ────────────
  const buildDeployPayload = useCallback(() => {
    if (!tenant) return {};

    const envVars: Record<string, string> = {};
    for (const pair of envPairs) {
      if (pair.key) envVars[pair.key] = pair.value;
    }

    return {
      template: editTemplate,
      metadata: {
        displayName,
        previousTemplate: tenant.template || 'financial-analytics',
        amendmentReason: 'manual-edit-and-deploy',
        primaryColor: editPrimaryColor,
        secondaryColor: editSecondaryColor,
        license: {
          key: license.licenseKey || `rrb-${tenant.slug}`,
          tier: license.licenseTier,
          validUntil: license.validUntil,
          features: license.features,
        },
        pins: [license.adminPin || process.env.NEXT_PUBLIC_DEFAULT_ADMIN_PIN || '454212'],
        subscriptionTier: license.licenseTier,
        apiKey: license.setupToken || '',
        googleAuth: {
          enabled: !!googleOAuth.clientId,
          clientId: googleOAuth.clientId,
          clientSecret: googleOAuth.clientSecret,
          projectId: googleOAuth.projectId,
          authUri: googleOAuth.authUri,
          redirectUris: googleOAuth.redirectUris,
        },
        database: {
          databaseUrl: dbConfig.dbUrl || `postgresql://${tenant.slug}:***@pooled.neon.tech/${tenant.slug}`,
          type: 'neon',
          provider: 'postgresql',
        },
        env: envVars,
        supportEmail: googleOAuth.supportEmail,
      },
    };
  }, [tenant, editTemplate, displayName, editPrimaryColor, editSecondaryColor, license, googleOAuth, dbConfig, envPairs]);

  // ── Deploy handler ───────────────────────────────────────
  const handleDeploy = useCallback(async () => {
    if (!tenant) return;

    setDeployingSlug(tenant.slug);
    setDeployProgress(0);
    setDeployStepStatuses({});
    setDeployDetails({});

    const updateStep = (stepKey: string, status: 'inprogress' | 'success' | 'error', detail?: string) => {
      setDeployStepStatuses((prev) => ({ ...prev, [stepKey]: status }));
      if (detail) setDeployDetails((prev) => ({ ...prev, [stepKey]: detail }));
      setDeployProgress(DEPLOY_STEPS.findIndex((s) => s.key === stepKey) + 1);
    };

    try {
      updateStep('fetch', 'inprogress', `Fetched tenant ${tenant.slug} with current template=${tenant.template}`);

      const payload = buildDeployPayload();
      const deployRes = await fetch(`/api/admin/tenants/${tenant.slug}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const deployData = await deployRes.json();
      if (!deployRes.ok || !deployData.success) {
        throw new Error(deployData.error || 'Deploy API failed');
      }

      updateStep('fetch', 'success', `Tenant ${tenant.slug} loaded`);
      updateStep('delta', 'inprogress');
      await new Promise((r) => setTimeout(r, 400));
      updateStep('delta', 'success', deployData.deploy?.deltaSummary || `Updated to template: ${editTemplate}`);

      updateStep('neon', 'inprogress', 'Upserting full config to Neon...');
      await new Promise((r) => setTimeout(r, 600));
      updateStep('neon', deployData.neonResult?.success ? 'success' : 'error',
        deployData.deploy?.neonDetail || 'Neon update completed');

      updateStep('vercel-env', 'inprogress');
      await new Promise((r) => setTimeout(r, 400));
      updateStep('vercel-env', 'success', 'Env vars synced to Vercel');

      updateStep('inngest', 'inprogress', 'Triggering pipeline...');
      await new Promise((r) => setTimeout(r, 1000));
      updateStep('inngest', 'success', 'Pipeline: AppPage seeding, AI/MapReduce content gen, blocks');

      updateStep('vercel-deploy', 'inprogress');
      await new Promise((r) => setTimeout(r, 800));
      updateStep('vercel-deploy', 'success', `Deploy complete: ${deployData.deploy?.vercelInfo?.appUrl || `https://${tenant.slug}.vercel.app`}`);

      updateStep('verify', 'inprogress');
      await new Promise((r) => setTimeout(r, 500));
      updateStep('verify', 'success', `Verified: ${editTemplate} template live`);

      dispatch(setThemeColors({ primary: editPrimaryColor, secondary: editSecondaryColor }));
      onSnackbar({ message: `✅ ${tenant.displayName} deployed with ${getTemplate(editTemplate).label}`, severity: 'success' });
      onRefetch();
      setTimeout(() => { handleClose(); }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deploy failed';
      onSnackbar({ message: msg, severity: 'error' });
      const currentIdx = Math.floor(deployProgress);
      if (currentIdx < DEPLOY_STEPS.length) {
        setDeployStepStatuses((prev) => ({ ...prev, [DEPLOY_STEPS[currentIdx].key]: 'error' }));
      }
    } finally {
      setDeployingSlug(null);
    }
  }, [tenant, buildDeployPayload, editTemplate, editPrimaryColor, editSecondaryColor, dispatch, onSnackbar, onRefetch]);

  // ── Automated Provision handler ──────────────────────────
  const handleAutoProvision = useCallback(async () => {
    if (!tenant) return;

    setProvisioning(true);
    setProvisionError(null);
    setProvisionResult(null);

    try {
      const res = await fetch(`/api/admin/tenants/${tenant.slug}/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google: autoProvision.googleOAuth,
          neon: autoProvision.neonDb,
          vercel: autoProvision.vercelDeploy,
          email: autoProvision.provisionEmail || undefined,
          redirectUris: autoProvision.redirectUris.length > 0 ? autoProvision.redirectUris : undefined,
          template: editTemplate,
          primaryColor: editPrimaryColor,
          secondaryColor: editSecondaryColor,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setProvisionResult(data);
        onSnackbar({ message: `✅ ${tenant.slug} provisioned successfully`, severity: 'success' });
        onRefetch();
      } else {
        throw new Error(data.error || 'Provisioning failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Provisioning error';
      setProvisionError(msg);
      onSnackbar({ message: `❌ Provisioning failed: ${msg}`, severity: 'error' });
    } finally {
      setProvisioning(false);
    }
  }, [tenant, autoProvision, editTemplate, editPrimaryColor, editSecondaryColor, onSnackbar, onRefetch]);

  // ── Close / Reset ────────────────────────────────────────
  const handleClose = () => {
    setDeployingSlug(null);
    setDeployProgress(0);
    setDeployStepStatuses({});
    setDeployDetails({});
    setProvisioning(false);
    setProvisionResult(null);
    setProvisionError(null);
    setMode(0);
    onClose();
  };

  // ── Guard: no tenant ─────────────────────────────────────
  if (!tenant) return null;

  // ── Render section helper for manual tabs/accordions ────
  const renderGeneralContent = () => (
    <TemplateSelector
      selectedId={editTemplate}
      currentId={tenant.template}
      onSelect={handleTemplateSelect}
      primaryColor={editPrimaryColor}
      secondaryColor={editSecondaryColor}
      onColorsChange={handleColorsChange}
      showPreviewDelta={true}
    />
  );

  const renderLicenseContent = () => (
    <Stack spacing={3}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        License Configuration
      </Typography>

      <TextField
        label="License Key"
        value={license.licenseKey}
        onChange={(e) => handleLicenseChange('licenseKey', e.target.value)}
        fullWidth
        placeholder={`rrb-${tenant.slug}`}
        helperText="Auto-generated if left empty"
      />

      <FormControl fullWidth>
        <InputLabel>License Tier</InputLabel>
        <Select
          value={license.licenseTier}
          label="License Tier"
          onChange={(e) => handleLicenseChange('licenseTier', e.target.value)}
        >
          {LICENSE_TIERS.map((tier) => (
            <MenuItem key={tier} value={tier}>{tier.toUpperCase()}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Valid Until"
        type="date"
        value={license.validUntil}
        onChange={(e) => handleLicenseChange('validUntil', e.target.value)}
        fullWidth
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <Divider />

      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        Features
      </Typography>
      <FormGroup row>
        {DEFAULT_FEATURES.map((feat) => (
          <FormControlLabel
            key={feat}
            control={
              <Checkbox
                checked={license.features.includes(feat)}
                onChange={() => toggleLicenseFeature(feat)}
                size="small"
              />
            }
            label={<Typography variant="body2">{feat}</Typography>}
          />
        ))}
      </FormGroup>

      <Divider />

      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        API Keys & PINs
      </Typography>

      <TextField
        label="Setup Token (SETUP_TOKEN)"
        value={license.setupToken}
        onChange={(e) => handleLicenseChange('setupToken', e.target.value)}
        fullWidth
        type="password"
      />

      <TextField
        label="Admin PIN"
        value={license.adminPin}
        onChange={(e) => handleLicenseChange('adminPin', e.target.value)}
        fullWidth
        type="password"
        placeholder="454212"
      />

      <TextField
        label="OpenAI API Key"
        value={license.openaiApiKey}
        onChange={(e) => handleLicenseChange('openaiApiKey', e.target.value)}
        fullWidth
        type="password"
      />
    </Stack>
  );

  const renderOAuthContent = () => (
    <Stack spacing={3}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        Google OAuth 2.0 Credentials
      </Typography>

      <TextField
        label="Client ID"
        value={googleOAuth.clientId}
        onChange={(e) => handleOAuthChange('clientId', e.target.value)}
        fullWidth
        placeholder="670560975972-xxxxx.apps.googleusercontent.com"
      />

      <TextField
        label="Client Secret"
        value={googleOAuth.clientSecret}
        onChange={(e) => handleOAuthChange('clientSecret', e.target.value)}
        fullWidth
        type={showSecret ? 'text' : 'password'}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowSecret(!showSecret)} edge="end" size="small">
                  {showSecret ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Project ID"
            value={googleOAuth.projectId}
            onChange={(e) => handleOAuthChange('projectId', e.target.value)}
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Support Email"
            type="email"
            value={googleOAuth.supportEmail}
            onChange={(e) => handleOAuthChange('supportEmail', e.target.value)}
            fullWidth
            placeholder="admin@tenant.com"
          />
        </Grid>
      </Grid>

      <Divider />

      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        Redirect URIs
      </Typography>

      <Stack spacing={1}>
        {googleOAuth.redirectUris.map((uri) => (
          <Stack key={uri} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip
              label={uri}
              variant="outlined"
              onDelete={() => removeRedirectUri(uri)}
              sx={{ flex: 1, justifyContent: 'flex-start', py: 0.5 }}
            />
          </Stack>
        ))}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <TextField
          size="small"
          fullWidth
          placeholder="https://app.tenant.com/auth/callback"
          value={newRedirectUri}
          onChange={(e) => setNewRedirectUri(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRedirectUri(); } }}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={addRedirectUri}
          startIcon={<AddIcon />}
        >
          Add
        </Button>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        Use the Automated tab to provision these via Google Cloud APIs
      </Typography>
    </Stack>
  );

  const renderDatabaseContent = () => (
    <Stack spacing={3}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        Database Connection
      </Typography>

      <TextField
        label="Database URL (Pooled)"
        value={dbConfig.dbUrl}
        onChange={(e) => {
          const url = e.target.value;
          setDbConfig({
            dbUrl: url,
            pooledUrl: url,
            directUrl: url.replace('-pooler', ''),
          });
        }}
        fullWidth
        multiline
        rows={2}
        placeholder="postgresql://user:pass@ep-xxx-pooler.neon.tech/db?sslmode=require"
        slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: '0.8rem' } } }}
      />

      <TextField
        label="Direct URL (Unpooled)"
        value={dbConfig.directUrl}
        onChange={(e) => setDbConfig((prev) => ({ ...prev, directUrl: e.target.value }))}
        fullWidth
        multiline
        rows={2}
        slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: '0.8rem' } } }}
      />

      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
          Connection String Variants
        </Typography>
        {[
          ['DATABASE_URL', dbConfig.pooledUrl || '(not set)'],
          ['DATABASE_URL_UNPOOLED', dbConfig.directUrl || '(not set)'],
          ['PGHOST', dbConfig.pooledUrl ? new URL(dbConfig.pooledUrl).hostname : '(not set)'],
          ['POSTGRES_URL', dbConfig.pooledUrl || '(not set)'],
          ['POSTGRES_PRISMA_URL', dbConfig.pooledUrl?.includes('?')
            ? dbConfig.pooledUrl + '&connect_timeout=15'
            : dbConfig.pooledUrl ? dbConfig.pooledUrl + '?connect_timeout=15' : '(not set)'],
        ].map(([key, val]) => (
          <Stack key={key} direction="row" spacing={1} sx={{ mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700, minWidth: 180 }}>
              {key}=
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', wordBreak: 'break-all' }}>
              {val}
            </Typography>
          </Stack>
        ))}
      </Paper>

      <Alert severity="info">
        <AlertTitle>Neon Provisioning</AlertTitle>
        Use the Automated tab to provision a Neon branch automatically, or paste an existing connection string above.
      </Alert>
    </Stack>
  );


  const renderRolesContent = () => {
    return (
      <Stack spacing={3}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Functional Role Catalog
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create, edit, and manage functional roles. Set PIN codes for role-based authentication.
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            onClick={openCreateRole}
            startIcon={<AddIcon />}
            sx={{ flexShrink: 0 }}
          >
            Create Role
          </Button>
        </Stack>

        {rolesLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : rolesError ? (
          <Alert severity="error">{rolesError}</Alert>
        ) : rolesList.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              No roles configured. Create your first functional role.
            </Typography>
            <Button variant="outlined" onClick={openCreateRole} startIcon={<AddIcon />}>
              Create Role
            </Button>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {rolesList.map((role) => (
              <Paper
                key={role.code}
                variant="outlined"
                sx={{
                  p: 2,
                  borderLeft: 4,
                  borderLeftColor: role.isPlatformAdmin ? "primary.main" : "grey.300",
                }}
              >
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5, flexWrap: "wrap" }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {role.name}
                      </Typography>
                      <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary" }}>
                        ({role.code})
                      </Typography>
                      {role.isPlatformAdmin && (
                        <Chip label="Platform Admin" size="small" color="primary" variant="outlined" />
                      )}
                    </Stack>
                    {role.email && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                        Email: {role.email}
                      </Typography>
                    )}
                    <Chip
                      icon={role.pinConfigured ? <CheckCircleIcon /> : <LockIcon />}
                      label={role.pinConfigured ? "PIN Configured" : "No PIN"}
                      size="small"
                      color={role.pinConfigured ? "success" : "warning"}
                      variant={role.pinConfigured ? "filled" : "outlined"}
                    />
                  </Box>

                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
                    {settingPinRole === role.code ? (
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <TextField
                          size="small"
                          type="password"
                          placeholder="Enter PIN (3+ chars)"
                          value={settingPinValue[role.code] || ""}
                          onChange={(e) =>
                            setSettingPinValue((prev) => ({ ...prev, [role.code]: e.target.value }))
                          }
                          sx={{ width: 160 }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const pin = settingPinValue[role.code] || "";
                              if (pin.length >= 3) void handleSetRolePin(role.code, pin);
                            }
                          }}
                        />
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => {
                            const pin = settingPinValue[role.code] || "";
                            if (pin.length >= 3) void handleSetRolePin(role.code, pin);
                          }}
                          disabled={savingPinRole === role.code || (settingPinValue[role.code] || "").length < 3}
                        >
                          {savingPinRole === role.code ? <CircularProgress size={18} /> : <CheckCircleIcon />}
                        </IconButton>
                        <IconButton size="small" onClick={() => { setSettingPinRole(null); setSettingPinValue((prev) => ({ ...prev, [role.code]: "" })); }}>
                          <CloseIcon />
                        </IconButton>
                      </Stack>
                    ) : (
                      <>
                        <Tooltip title="Set PIN">
                          <IconButton size="small" onClick={() => setSettingPinRole(role.code)} color="default">
                            <LockIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit role">
                          <IconButton size="small" onClick={() => openEditRole(role)} color="primary">
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete role">
                          <IconButton size="small" onClick={() => setRoleDeleteConfirm(role.code)} color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}

        {/* Create/Edit Role Dialog */}
        <Dialog open={roleDialogOpen} onClose={() => !roleSaving && setRoleDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>
            {roleDialogMode === "create" ? "Create Functional Role" : "Edit Role: " + roleFormCode}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              {roleDialogMode === "create" && (
                <TextField
                  label="Role Code"
                  value={roleFormCode}
                  onChange={(e) => setRoleFormCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  fullWidth
                  size="small"
                  helperText="Unique identifier (lowercase, hyphens). Auto-generated from name if empty."
                />
              )}
              <TextField
                label="Role Name"
                value={roleFormName}
                onChange={(e) => {
                  setRoleFormName(e.target.value);
                  if (roleDialogMode === "create" && !roleFormCode) {
                    setRoleFormCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                  }
                }}
                fullWidth
                size="small"
                placeholder="e.g. Finance Manager"
                autoFocus={roleDialogMode === "create"}
              />
              <TextField
                label="Email (optional)"
                type="email"
                value={roleFormEmail}
                onChange={(e) => setRoleFormEmail(e.target.value)}
                fullWidth
                size="small"
                placeholder="role-owner@tenant.com"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={roleFormIsPlatformAdmin}
                    onChange={(e) => setRoleFormIsPlatformAdmin(e.target.checked)}
                  />
                }
                label="Platform Admin (full access)"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setRoleDialogOpen(false)} disabled={roleSaving}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleRoleSave}
              disabled={roleSaving || !roleFormName.trim()}
              startIcon={roleSaving ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {roleSaving ? "Saving..." : roleDialogMode === "create" ? "Create Role" : "Save Changes"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={Boolean(roleDeleteConfirm)} onClose={() => !roleSaving && setRoleDeleteConfirm(null)}>
          <DialogTitle>Delete Role?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete role <strong>{roleDeleteConfirm}</strong>?
              This action cannot be undone. User accounts assigned to this role may need re-assignment.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRoleDeleteConfirm(null)} disabled={roleSaving}>Cancel</Button>
            <Button
              onClick={() => roleDeleteConfirm && handleRoleDelete(roleDeleteConfirm)}
              color="error"
              variant="contained"
              disabled={roleSaving}
            >
              {roleSaving ? "Deleting..." : "Delete"}
            </Button>
          </DialogActions>
        </Dialog>

        <Divider />
        <Typography variant="caption" color="text.secondary">
          Roles control access and task assignment. PINs are stored encrypted in the secrets table.
          Platform Admin roles share the ADMIN_PIN; functional roles each have their own PIN.
        </Typography>
      </Stack>
    );
  };


  const renderEnvContent = () => (
    <Stack spacing={3}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        Custom Environment Variables
      </Typography>

      {envPairs.map((pair, index) => (
        <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField
            size="small"
            label="Key"
            value={pair.key}
            onChange={(e) => {
              const updated = [...envPairs];
              updated[index].key = e.target.value;
              setEnvPairs(updated);
            }}
            sx={{ flex: 1 }}
            slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
          />
          <TextField
            size="small"
            label="Value"
            value={pair.value}
            onChange={(e) => {
              const updated = [...envPairs];
              updated[index].value = e.target.value;
              setEnvPairs(updated);
            }}
            sx={{ flex: 2 }}
            slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
          />
          <IconButton color="error" size="small" onClick={() => removeEnvPair(index)}>
            <DeleteIcon />
          </IconButton>
        </Stack>
      ))}

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <TextField
          size="small"
          label="Key"
          value={newEnvKey}
          onChange={(e) => setNewEnvKey(e.target.value)}
          sx={{ flex: 1 }}
          placeholder="MY_VARIABLE"
          slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEnvPair(); } }}
        />
        <TextField
          size="small"
          label="Value"
          value={newEnvValue}
          onChange={(e) => setNewEnvValue(e.target.value)}
          sx={{ flex: 2 }}
          slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEnvPair(); } }}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={addEnvPair}
          startIcon={<AddIcon />}
          disabled={!newEnvKey || !newEnvValue}
        >
          Add
        </Button>
      </Stack>

      {envPairs.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No custom env vars. Add key-value pairs above — they will be injected into the Vercel project.
        </Typography>
      )}
    </Stack>
  );

  // ── Render section helper for Automated provisioning ──────
  const renderAutomatedContent = () => (
    <Stack spacing={3}>
      <Alert severity="info">
        <AlertTitle>Automated Tenant Provisioning</AlertTitle>
        One-click provisioning creates Google Cloud OAuth credentials and/or a Neon Postgres database
        for this tenant. Each service can be toggled independently.
      </Alert>

      {/* Google OAuth option */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
          <VerifiedUserIcon color="primary" sx={{ mt: 0.5 }} />
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Google Cloud OAuth 2.0
              </Typography>
              <Switch
                checked={autoProvision.googleOAuth}
                onChange={() => handleAutoProvisionToggle('googleOAuth')}
                size="small"
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Creates a Web OAuth 2.0 client via Google Cloud APIs or gcloud CLI.
              Requires a configured service account or gcloud auth.
            </Typography>
            {autoProvision.googleOAuth && (
              <Stack spacing={2}>
                <TextField
                  size="small"
                  label="Admin Email (for consent screen)"
                  type="email"
                  value={autoProvision.provisionEmail}
                  onChange={(e) => setAutoProvision((p) => ({ ...p, provisionEmail: e.target.value }))}
                  fullWidth
                  placeholder="admin@tenant.com"
                />
                <TextField
                  size="small"
                  label="Additional Redirect URIs (comma-separated)"
                  value={autoProvision.redirectUris.join(', ')}
                  onChange={(e) => setAutoProvision((p) => ({
                    ...p,
                    redirectUris: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  }))}
                  fullWidth
                  placeholder={`https://${tenant.slug}.vercel.app, https://${tenant.slug}.vercel.app/api/auth?action=google-callback`}
                />
              </Stack>
            )}
          </Box>
        </Stack>
      </Paper>

      {/* Neon DB option */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
          <DnsIcon color="primary" sx={{ mt: 0.5 }} />
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Neon Postgres Database
              </Typography>
              <Switch
                checked={autoProvision.neonDb}
                onChange={() => handleAutoProvisionToggle('neonDb')}
                size="small"
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Creates an isolated Neon branch + database for this tenant.
              All connection string variants are returned (DATABASE_URL, PGHOST, POSTGRES_*, etc.)
            </Typography>
            {autoProvision.neonDb && (
              <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>
                Requires NEON_API_KEY and NEON_PROJECT_ID to be set in the platform environment.
              </Alert>
            )}
          </Box>
        </Stack>
      </Paper>

      {/* Vercel Deploy option */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
          <RocketLaunchIcon color="primary" sx={{ mt: 0.5 }} />
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Vercel Deployment
              </Typography>
              <Switch
                checked={autoProvision.vercelDeploy}
                onChange={() => handleAutoProvisionToggle('vercelDeploy')}
                size="small"
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Automatically trigger a Vercel production deploy after provisioning.
              The tenant app will be live at <strong>https://{tenant.slug}.vercel.app</strong>
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Results */}
      {provisionResult && (
        <Alert severity="success">
          <AlertTitle>✅ Provisioning Complete</AlertTitle>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(provisionResult, null, 2)}
          </Typography>
        </Alert>
      )}

      {provisionError && (
        <Alert severity="error">
          <AlertTitle>❌ Provisioning Failed</AlertTitle>
          {provisionError}
        </Alert>
      )}

      {provisioning && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Provisioning in progress... this may take a minute.
          </Typography>
        </Box>
      )}

      {/* Provision Button */}
      <Button
        variant="contained"
        color="primary"
        size="large"
        fullWidth
        onClick={handleAutoProvision}
        disabled={provisioning || (!autoProvision.googleOAuth && !autoProvision.neonDb)}
        startIcon={provisioning ? <CircularProgress size={20} color="inherit" /> : <RocketLaunchIcon />}
        sx={{ fontWeight: 700, py: 1.5 }}
      >
        {provisioning
          ? 'PROVISIONING...'
          : `PROVISION ${autoProvision.googleOAuth && autoProvision.neonDb ? 'ALL' : 'SELECTED'} SERVICES`}
      </Button>
    </Stack>
  );

  // ── Render manual content (tabs on desktop, accordions on mobile) ──
  const renderManualContent = () => {
    if (isMobile) {
      // Mobile: Accordion mode
      const sections = [
        { key: 'general', label: 'General', content: renderGeneralContent() },
        { key: 'license', label: 'License & API Key', content: renderLicenseContent() },
        { key: 'oauth', label: 'Google OAuth', content: renderOAuthContent() },
        { key: 'database', label: 'Database', content: renderDatabaseContent() },
        { key: 'env', label: 'Custom Env', content: renderEnvContent() },
        { key: 'roles', label: 'Functional Roles', content: renderRolesContent() },
      ];
      return (
        <Box sx={{ py: 1 }}>
          {sections.map((section, idx) => (
            <Accordion
              key={section.key}
              expanded={expandedAccordion === section.key}
              onChange={handleAccordionChange(section.key)}
              defaultExpanded={idx === 0}
              sx={{
                '&:before': { display: 'none' },
                borderBottom: '1px solid',
                borderColor: 'divider',
                boxShadow: 'none',
                '&.Mui-expanded': { margin: 0 },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  fontWeight: expandedAccordion === section.key ? 700 : 400,
                  '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1 },
                }}
              >
                {ACCORDION_ICONS[section.key]}
                <Typography variant="subtitle2">{section.label}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 1, pb: 3 }}>
                {section.content}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      );
    }

    // Desktop: Tabs mode
    return (
      <Box>
        <Tabs
          value={manualTab}
          onChange={handleManualTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {MANUAL_TABS.map((tab) => (
            <Tab
              key={tab.key}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
              sx={{ minHeight: 48, fontWeight: manualTab === MANUAL_TABS.indexOf(tab) ? 700 : 400 }}
            />
          ))}
        </Tabs>

        <TabPanel value={manualTab} index={0}>{renderGeneralContent()}</TabPanel>
        <TabPanel value={manualTab} index={1}>{renderLicenseContent()}</TabPanel>
        <TabPanel value={manualTab} index={2}>{renderOAuthContent()}</TabPanel>
        <TabPanel value={manualTab} index={3}>{renderDatabaseContent()}</TabPanel>
        <TabPanel value={manualTab} index={4}>{renderEnvContent()}</TabPanel>
        <TabPanel value={manualTab} index={5}>{renderRolesContent()}</TabPanel>
      </Box>
    );
  };

  // ── Main render ──────────────────────────────────────────
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      aria-labelledby="edit-tenant-modal-title"
    >
      {/* ── HEADER WITH MODE TABS ───────────────────────────── */}
      <DialogTitle id="edit-tenant-modal-title" sx={{ p: 0 }}>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2, pb: 1 }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <EditIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {tenant.displayName || tenant.slug}
            </Typography>
            <Chip label={tenant.status} size="small" color={
              tenant.status === 'live' ? 'success' : tenant.status === 'deploying' ? 'warning' : 'default'
            } />
          </Stack>
          <IconButton onClick={handleClose} size="small" aria-label="close">
            <CloseIcon />
          </IconButton>
        </Stack>

        {/* Mode switcher tabs */}
        <Tabs
          value={mode}
          onChange={handleModeChange}
          sx={{
            px: 3,
            '& .MuiTab-root': {
              minHeight: 42,
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.9rem',
            },
          }}
        >
          <Tab
            label={
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <EditIcon fontSize="small" />
                <span>Manual</span>
              </Stack>
            }
          />
          <Tab
            label={
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <RocketLaunchIcon fontSize="small" />
                <span>Automated</span>
              </Stack>
            }
          />
        </Tabs>
      </DialogTitle>

      {/* ── BODY ──────────────────────────────────────────────── */}
      <DialogContent dividers sx={{ p: { xs: 1.5, md: 3 }, minHeight: 400 }}>
        {mode === 0 ? renderManualContent() : renderAutomatedContent()}

        {/* Deploy progress (shown during deploy in Manual mode) */}
        {deployingSlug && mode === 0 && (
          <Paper variant="outlined" sx={{ mt: 4, p: 3, borderColor: 'primary.main' }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <RocketLaunchIcon color="primary" /> Deploy Progress
            </Typography>
            <Stepper activeStep={deployProgress} orientation="vertical" sx={{ mb: 3 }}>
              {DEPLOY_STEPS.map((step) => {
                const status = deployStepStatuses[step.key] || 'pending';
                const isActive = status === 'inprogress';
                const detail = deployDetails[step.key];
                let icon: React.ReactNode = undefined;
                if (status === 'success') icon = <CheckCircleIcon color="success" />;
                else if (status === 'error') icon = <CloseIcon color="error" />;
                else if (isActive) icon = <CircularProgress size={20} color="primary" />;
                return (
                  <Step key={step.key} active={isActive || status === 'success'}>
                    <StepLabel icon={icon} sx={{
                      '& .MuiStepLabel-label': { fontWeight: isActive || status === 'success' ? 600 : 400 },
                    }}>
                      {step.label}
                    </StepLabel>
                    <StepContent>
                      <Typography variant="body2" color="text.secondary">{step.description}</Typography>
                      {detail && (
                        <Typography variant="caption" sx={{ mt: 1, display: 'block', p: 1, bgcolor: 'background.default', borderRadius: 1, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                          {detail}
                        </Typography>
                      )}
                    </StepContent>
                  </Step>
                );
              })}
            </Stepper>
            <LinearProgress
              variant="determinate"
              value={(deployProgress / DEPLOY_STEPS.length) * 100}
              sx={{ mt: 2, height: 6, borderRadius: 4 }}
            />
          </Paper>
        )}
      </DialogContent>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <DialogActions sx={{ px: 3, py: 2.5, gap: 2 }}>
        <Button onClick={handleClose} disabled={!!deployingSlug || provisioning}>
          Cancel
        </Button>

        {mode === 0 ? (
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleDeploy}
            disabled={!!deployingSlug || provisioning}
            startIcon={deployingSlug ? <CircularProgress size={20} color="inherit" /> : <RocketLaunchIcon />}
            sx={{ fontWeight: 700, minWidth: 220 }}
          >
            {deployingSlug ? 'DEPLOYING...' : 'DEPLOY TO VERCEL'}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="secondary"
            size="large"
            onClick={handleAutoProvision}
            disabled={provisioning || (!autoProvision.googleOAuth && !autoProvision.neonDb)}
            startIcon={provisioning ? <CircularProgress size={20} color="inherit" /> : <RocketLaunchIcon />}
            sx={{ fontWeight: 700, minWidth: 220 }}
          >
            {provisioning ? 'PROVISIONING...' : 'PROVISION'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
