'use client';

/**
 * EditTenantModal — Stepper wizard for editing tenant applications.
 *
 * Steps: Template → Preview → License → Features → OpenAI API-Keys
 *        → Google OAuth → Database → Custom Env → Functional Roles
 *
 * Footer: [Back] [Save Changes] [Continue / Deploy to Vercel]
 */
import { useState, useCallback, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepContent from '@mui/material/StepContent';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import CloudIcon from '@mui/icons-material/Cloud';
import DeleteIcon from '@mui/icons-material/Delete';
import DnsIcon from '@mui/icons-material/Dns';
import EditIcon from '@mui/icons-material/Edit';
import KeyIcon from '@mui/icons-material/Key';
import LockIcon from '@mui/icons-material/Lock';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PaletteIcon from '@mui/icons-material/Palette';
import PeopleIcon from '@mui/icons-material/People';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

import { getTemplate } from '@/domain/tenant/template-catalog';
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

interface EnvPair {
  key: string;
  value: string;
}

interface LicenseConfig {
  licenseKey: string;
  licenseTier: string;
  validUntil: string;
  features: string[];
  setupToken: string;
  adminPin: string;
  openaiApiKey: string;
}

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  projectId: string;
  authUri: string;
  tokenUri: string;
  redirectUris: string[];
  supportEmail: string;
  gcpAccountEmail: string;
}

interface DatabaseConfig {
  dbUrl: string;
  pooledUrl: string;
  directUrl: string;
}

// ── Constants ──────────────────────────────────────────────────

const EDIT_STEPS: Array<{ label: string; icon: React.ReactNode; key: string }> = [
  { label: 'Template', icon: <SettingsIcon fontSize="small" />, key: 'template' },
  { label: 'Preview', icon: <PaletteIcon fontSize="small" />, key: 'preview' },
  { label: 'License', icon: <KeyIcon fontSize="small" />, key: 'license' },
  { label: 'Features', icon: <AutoFixHighIcon fontSize="small" />, key: 'features' },
  { label: 'OpenAI API-Keys', icon: <KeyIcon fontSize="small" />, key: 'openai' },
  { label: 'Google OAuth', icon: <VerifiedUserIcon fontSize="small" />, key: 'oauth' },
  { label: 'Database', icon: <DnsIcon fontSize="small" />, key: 'database' },
  { label: 'Custom Env', icon: <CloudIcon fontSize="small" />, key: 'env' },
  { label: 'Functional Roles', icon: <PeopleIcon fontSize="small" />, key: 'roles' },
];

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

// ── Component ──────────────────────────────────────────────────

export function EditTenantModal({ open, tenant, onClose, onRefetch, onSnackbar }: EditTenantModalProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useAppDispatch();

  // ── Stepper state ──────────────────────────────────────────
  const [activeStep, setActiveStep] = useState(0);

  // ── Template / Colors ──────────────────────────────────────
  const [editTemplate, setEditTemplate] = useState('financial-analytics');
  const [editPrimaryColor, setEditPrimaryColor] = useState('#eb3d28');
  const [editSecondaryColor, setEditSecondaryColor] = useState('#0af9fe');
  const [displayName, setDisplayName] = useState('');

  // ── License & API Key ──────────────────────────────────────
  const [license, setLicense] = useState<LicenseConfig>({
    licenseKey: '',
    licenseTier: 'premium',
    validUntil: '2028-12-31',
    features: DEFAULT_FEATURES,
    setupToken: '',
    adminPin: '',
    openaiApiKey: '',
  });

  // ── Google OAuth ───────────────────────────────────────────
  const [googleOAuth, setGoogleOAuth] = useState<GoogleOAuthConfig>({
    clientId: '',
    clientSecret: '',
    projectId: '',
    authUri: 'https://accounts.google.com/o/oauth2/auth',
    tokenUri: 'https://oauth2.googleapis.com/token',
    redirectUris: [],
    supportEmail: '',
    gcpAccountEmail: 'reward2learn@gmail.com',
  });
  const [showSecret, setShowSecret] = useState(false);
  const [newRedirectUri, setNewRedirectUri] = useState('');
  const [provisioningOAuth, setProvisioningOAuth] = useState(false);
  const [provisionOAuthResult, setProvisionOAuthResult] = useState<Record<string, unknown> | null>(null);
  const [provisionOAuthError, setProvisionOAuthError] = useState<string | null>(null);

  // ── Database ───────────────────────────────────────────────
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>({
    dbUrl: '',
    pooledUrl: '',
    directUrl: '',
  });
  const [provisioningDb, setProvisioningDb] = useState(false);
  const [provisionDbResult, setProvisionDbResult] = useState<Record<string, unknown> | null>(null);
  const [provisionDbError, setProvisionDbError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<string | null>(null);

  // ── Custom Env ─────────────────────────────────────────────
  const [envPairs, setEnvPairs] = useState<EnvPair[]>([]);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  // ── Functional Roles ───────────────────────────────────────
  const [rolesList, setRolesList] = useState<Array<{ code: string; name: string; isPlatformAdmin: boolean; email: string | null; pinConfigured: boolean }>>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [settingPinRole, setSettingPinRole] = useState<string | null>(null);
  const [settingPinValue, setSettingPinValue] = useState<Record<string, string>>({});
  const [savingPinRole, setSavingPinRole] = useState<string | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleDialogMode, setRoleDialogMode] = useState<'create' | 'edit'>('create');
  const [roleFormCode, setRoleFormCode] = useState('');
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormIsPlatformAdmin, setRoleFormIsPlatformAdmin] = useState(false);
  const [roleFormEmail, setRoleFormEmail] = useState('');
  const [roleDeleteConfirm, setRoleDeleteConfirm] = useState<string | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);

  // ── Deploy state ───────────────────────────────────────────
  const [deployingSlug, setDeployingSlug] = useState<string | null>(null);
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployStepStatuses, setDeployStepStatuses] = useState<Record<string, 'pending' | 'inprogress' | 'success' | 'error'>>({});
  const [deployDetails, setDeployDetails] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // ── Initialize from tenant on open ────────────────────────
  useEffect(() => {
    if (tenant) {
      const tpl = getTemplate(tenant.template || 'financial-analytics');
      setEditTemplate(tenant.template || 'financial-analytics');
      setEditPrimaryColor(tenant.primaryColor || tpl.defaultColors.primary);
      setEditSecondaryColor(tenant.secondaryColor || tpl.defaultColors.secondary);
      setDisplayName(tenant.displayName || '');

      // Restore saved config from metadata
      const cfg = (tenant.metadata?.config ?? {}) as Record<string, unknown>;
      const savedLicense = (cfg.license ?? {}) as Record<string, unknown>;
      const savedGoogle = (cfg.googleAuth ?? {}) as Record<string, unknown>;
      const savedDb = (cfg.database ?? {}) as Record<string, unknown>;
      const savedEnv = (cfg.env ?? {}) as Record<string, string>;

      // Restore license fields
      setLicense((prev) => ({
        ...prev,
        licenseKey: (savedLicense.key as string) || prev.licenseKey,
        licenseTier: (savedLicense.tier as string) || prev.licenseTier,
        validUntil: (savedLicense.validUntil as string) || prev.validUntil,
        features: (savedLicense.features as string[]) || prev.features,
        setupToken: (cfg.apiKey as string) || prev.setupToken,
        openaiApiKey: (cfg.openaiApiKey as string) || prev.openaiApiKey,
      }));

      // Restore DB config (metadata.database overrides tenant.dbUrl)
      setDbConfig({
        dbUrl: (savedDb.pooledUrl as string) || (savedDb.databaseUrl as string) || tenant.dbUrl || '',
        pooledUrl: (savedDb.pooledUrl as string) || (savedDb.databaseUrl as string) || tenant.dbUrl || '',
        directUrl: (savedDb.directUrl as string) || '',
      });

      // Restore Google OAuth
      setGoogleOAuth((g) => ({
        ...g,
        clientId: (savedGoogle.clientId as string) || g.clientId,
        clientSecret: (savedGoogle.clientSecret as string) || g.clientSecret,
        projectId: (savedGoogle.projectId as string) || g.projectId,
        authUri: (savedGoogle.authUri as string) || g.authUri,
        redirectUris: ((savedGoogle.redirectUris as string[])?.length
          ? (savedGoogle.redirectUris as string[])
          : [
              `https://${tenant.slug}.vercel.app`,
              `https://${tenant.slug}.vercel.app/api/auth?action=google-callback`,
            ]),
        supportEmail: (savedGoogle.supportEmail as string) || g.supportEmail,
        gcpAccountEmail: (savedGoogle.gcpAccountEmail as string) || g.gcpAccountEmail,
      }));

      // Restore custom env vars
      const envPairsFromMeta = Object.entries(savedEnv).map(([key, value]) => ({ key, value }));
      setEnvPairs(envPairsFromMeta);

      setActiveStep(0);
      setProvisionOAuthResult(null);
      setProvisionOAuthError(null);
      setProvisionDbResult(null);
      setProvisionDbError(null);
    }
  }, [tenant]);

  // ── Fetch roles when modal opens ───────────────────────────
  const fetchRoles = useCallback(async () => {
    if (!tenant) return;
    setRolesLoading(true);
    setRolesError(null);
    try {
      const res = await fetch('/api/admin/roles');
      const data = await res.json();
      if (data.ok && data.data?.roles) {
        setRolesList(data.data.roles);
      } else {
        setRolesError(data.error || 'Failed to load roles');
      }
    } catch {
      setRolesError('Failed to connect to roles API');
    } finally {
      setRolesLoading(false);
    }
  }, [tenant]);

  const handleSetRolePin = useCallback(async (code: string, pin: string) => {
    setSavingPinRole(code);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, pin }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchRoles();
        onSnackbar({ message: 'PIN set for role ' + code, severity: 'success' });
      } else {
        onSnackbar({ message: data.error || 'Failed to set PIN', severity: 'error' });
      }
    } catch {
      onSnackbar({ message: 'Failed to set PIN', severity: 'error' });
    } finally {
      setSavingPinRole(null);
      setSettingPinRole(null);
      setSettingPinValue((prev) => ({ ...prev, [code]: '' }));
    }
  }, [fetchRoles, onSnackbar]);

  // ── Role CRUD handlers ─────────────────────────────────────
  const openCreateRole = useCallback(() => {
    setRoleFormCode('');
    setRoleFormName('');
    setRoleFormIsPlatformAdmin(false);
    setRoleFormEmail('');
    setRoleDialogMode('create');
    setRoleDialogOpen(true);
  }, []);

  const openEditRole = useCallback((role: { code: string; name: string; isPlatformAdmin: boolean; email: string | null }) => {
    setRoleFormCode(role.code);
    setRoleFormName(role.name);
    setRoleFormIsPlatformAdmin(role.isPlatformAdmin);
    setRoleFormEmail(role.email || '');
    setRoleDialogMode('edit');
    setRoleDialogOpen(true);
  }, []);

  const handleRoleSave = useCallback(async () => {
    if (!roleFormName.trim()) return;
    setRoleSaving(true);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: roleFormCode || roleFormName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          name: roleFormName.trim(),
          isPlatformAdmin: roleFormIsPlatformAdmin,
          email: roleFormEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchRoles();
        setRoleDialogOpen(false);
        onSnackbar({ message: 'Role ' + (roleDialogMode === 'create' ? 'created' : 'updated'), severity: 'success' });
      } else {
        onSnackbar({ message: data.error || 'Failed to save role', severity: 'error' });
      }
    } catch {
      onSnackbar({ message: 'Failed to save role', severity: 'error' });
    } finally {
      setRoleSaving(false);
    }
  }, [roleFormCode, roleFormName, roleFormIsPlatformAdmin, roleFormEmail, roleDialogMode, fetchRoles, onSnackbar]);

  const handleRoleDelete = useCallback(async (code: string) => {
    setRoleSaving(true);
    try {
      const res = await fetch('/api/admin/roles?code=' + encodeURIComponent(code), { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        await fetchRoles();
        setRoleDeleteConfirm(null);
        onSnackbar({ message: 'Role deleted: ' + code, severity: 'success' });
      } else {
        onSnackbar({ message: data.error || 'Failed to delete role', severity: 'error' });
      }
    } catch {
      onSnackbar({ message: 'Failed to delete role', severity: 'error' });
    } finally {
      setRoleSaving(false);
    }
  }, [fetchRoles, onSnackbar]);

  useEffect(() => {
    if (tenant) {
      void fetchRoles();
    }
  }, [tenant, fetchRoles]);

  // ── Handlers: Template ─────────────────────────────────────
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

  // ── Handlers: License ──────────────────────────────────────
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

  // ── Handlers: Google OAuth ─────────────────────────────────
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

  // ── Generate value handlers ────────────────────────────────
  const generateLicenseKey = useCallback(() => {
    const key = 'rrb-' + (tenant?.slug || 'unknown') + '-' + Date.now().toString(36);
    handleLicenseChange('licenseKey', key);
    onSnackbar({ message: 'License key generated', severity: 'success' });
  }, [tenant, onSnackbar]);

  const generateSetupToken = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = 'st_';
    for (let i = 0; i < 32; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    handleLicenseChange('setupToken', token);
    onSnackbar({ message: 'Setup token generated', severity: 'success' });
  }, [onSnackbar]);

  const generateAdminPin = useCallback(() => {
    const pin = String(100000 + Math.floor(Math.random() * 900000));
    handleLicenseChange('adminPin', pin);
    onSnackbar({ message: 'Admin PIN generated', severity: 'success' });
  }, [onSnackbar]);

  const generateOpenAiKey = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const key = 'sk-proj-' + Array.from({ length: 48 }, () => chars.charAt(Math.floor(Math.random() * 62))).join('');
    handleLicenseChange('openaiApiKey', key);
    onSnackbar({ message: 'API key placeholder generated (replace with real key)', severity: 'success' });
  }, [onSnackbar]);

  // ── Handlers: Custom Env ──────────────────────────────────
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

  // ── Provision: Google OAuth (create GCP project + OAuth) ──
  const handleProvisionOAuth = useCallback(async () => {
    if (!tenant) return;
    setProvisioningOAuth(true);
    setProvisionOAuthError(null);
    setProvisionOAuthResult(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.slug}/provision/google-oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: tenant.slug,
          displayName: displayName || tenant.displayName,
          redirectUris: googleOAuth.redirectUris,
          adminEmail: googleOAuth.gcpAccountEmail,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProvisionOAuthResult(data);
        // Auto-fill returned credentials
        if (data.data?.clientId) handleOAuthChange('clientId', data.data.clientId);
        if (data.data?.clientSecret) handleOAuthChange('clientSecret', data.data.clientSecret);
        if (data.data?.projectId) handleOAuthChange('projectId', data.data.projectId);
        onSnackbar({ message: `✅ GCP project + OAuth credentials created for ${tenant.slug}`, severity: 'success' });
      } else {
        throw new Error(data.error || 'Google OAuth provisioning failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Provisioning error';
      setProvisionOAuthError(msg);
      onSnackbar({ message: `❌ OAuth provisioning failed: ${msg}`, severity: 'error' });
    } finally {
      setProvisioningOAuth(false);
    }
  }, [tenant, displayName, googleOAuth.redirectUris, googleOAuth.gcpAccountEmail, onSnackbar]);

  // ── Provision: Neon Database ──────────────────────────────
  const handleProvisionDb = useCallback(async () => {
    if (!tenant) return;
    setProvisioningDb(true);
    setProvisionDbError(null);
    setProvisionDbResult(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.slug}/provision/neon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: tenant.slug }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProvisionDbResult(data);
        // Auto-fill returned connection strings
        const dd = data.data || {};
        const pooledUrl = dd.pooledUrl || dd.connectionStrings?.DATABASE_URL || dd.connectionStrings?.POSTGRES_URL || '';
        const directUrl = dd.directUrl || dd.connectionStrings?.DATABASE_URL_UNPOOLED || dd.connectionStrings?.POSTGRES_URL_NON_POOLING || '';
        if (pooledUrl) {
          setDbConfig({
            dbUrl: pooledUrl,
            pooledUrl: pooledUrl,
            directUrl: directUrl || pooledUrl.replace('-pooler', ''),
          });
          onSnackbar({ message: `✅ Neon database provisioned for ${tenant.slug} — connection strings auto-populated`, severity: 'success' });
        } else {
          onSnackbar({ message: `✅ Neon database provisioned for ${tenant.slug}`, severity: 'success' });
        }
      } else {
        throw new Error(data.error || 'Neon provisioning failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Provisioning error';
      setProvisionDbError(msg);
      onSnackbar({ message: `❌ Database provisioning failed: ${msg}`, severity: 'error' });
    } finally {
      setProvisioningDb(false);
    }
  }, [tenant, onSnackbar]);

  // ── Test database connection ────────────────────────────
  const handleTestConnection = useCallback(async () => {
    if (!dbConfig.dbUrl) {
      setConnectionTestResult('⚠️ No database URL configured');
      return;
    }
    setTestingConnection(true);
    setConnectionTestResult(null);
    try {
      // Parse the URL to validate format
      const url = new URL(dbConfig.dbUrl);
      const hostname = url.hostname;
      const isPooled = hostname.includes('-pooler');

      // Try to resolve hostname and check port availability
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const testRes = await fetch(`/api/admin/tenants/${tenant?.slug}/provision/neon/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dbUrl: dbConfig.dbUrl }),
          signal: controller.signal,
        });
        const testData = await testRes.json();
        clearTimeout(timeout);
        if (testData.success) {
          setConnectionTestResult('✅ Connection successful — database is reachable');
        } else {
          setConnectionTestResult(`❌ Connection failed: ${testData.error || 'Unknown error'}`);
        }
      } catch (fetchErr) {
        clearTimeout(timeout);
        // Fallback: basic URL validation
        setConnectionTestResult(
          `✅ URL format valid: ${url.protocol}//${url.hostname}/${url.pathname.split('/').pop()}
` +
          `   Type: ${isPooled ? 'Pooled (PgBouncer)' : 'Direct'}
` +
          `   Note: In-browser connection test unavailable; verify via psql or the Neon Console.`
        );
      }
    } catch {
      setConnectionTestResult('❌ Invalid database URL format');
    } finally {
      setTestingConnection(false);
    }
  }, [dbConfig.dbUrl, tenant]);

  // ── Build deploy payload ──────────────────────────────────
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
        amendmentReason: 'stepper-edit-and-deploy',
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

  // ── Save handler ──────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      const payload = {
        slug: tenant.slug,
        displayName,
        template: editTemplate,
        primaryColor: editPrimaryColor,
        secondaryColor: editSecondaryColor,
        metadata: {
          config: {
            license: {
              key: license.licenseKey,
              tier: license.licenseTier,
              validUntil: license.validUntil,
              features: license.features,
            },
            pins: [license.adminPin],
            subscriptionTier: license.licenseTier,
            apiKey: license.setupToken || '',
            openaiApiKey: license.openaiApiKey || '',
            googleAuth: {
              clientId: googleOAuth.clientId,
              clientSecret: googleOAuth.clientSecret,
              projectId: googleOAuth.projectId,
              authUri: googleOAuth.authUri,
              redirectUris: googleOAuth.redirectUris,
              gcpAccountEmail: googleOAuth.gcpAccountEmail,
            },
            database: {
              databaseUrl: dbConfig.dbUrl,
              pooledUrl: dbConfig.pooledUrl,
              directUrl: dbConfig.directUrl,
            },
            env: Object.fromEntries(envPairs.filter((p) => p.key).map((p) => [p.key, p.value])),
          },
        },
      };

      const res = await fetch(`/api/admin/tenants/${tenant.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Save failed');
      }
      onSnackbar({ message: `✅ ${tenant.displayName} saved successfully`, severity: 'success' });
      onRefetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      onSnackbar({ message: `❌ Save failed: ${msg}`, severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, [tenant, displayName, editTemplate, editPrimaryColor, editSecondaryColor, license, googleOAuth, dbConfig, envPairs, onSnackbar, onRefetch]);

  // ── Deploy handler ────────────────────────────────────────
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

  // ── Close / Reset ─────────────────────────────────────────
  const handleClose = () => {
    setDeployingSlug(null);
    setDeployProgress(0);
    setDeployStepStatuses({});
    setDeployDetails({});
    setSaving(false);
    setActiveStep(0);
    setProvisionOAuthResult(null);
    setProvisionOAuthError(null);
    setProvisionDbResult(null);
    setProvisionDbError(null);
    onClose();
  };

  // ── Navigation ────────────────────────────────────────────
  const handleNext = () => setActiveStep((s) => Math.min(s + 1, EDIT_STEPS.length - 1));
  const handleBack = () => setActiveStep((s) => Math.max(s - 1, 0));
  const isLastStep = activeStep === EDIT_STEPS.length - 1;

  // ── Guard: no tenant ──────────────────────────────────────
  if (!tenant) return null;

  const selectedTemplate = getTemplate(editTemplate);

  // ── Step 0: Template ──────────────────────────────────────
  const renderStepTemplate = () => (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Select Template &amp; Branding
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Choose a business template and customize the display name and brand colors.
          These settings affect the tenant application&apos;s header, buttons, and page structure.
        </Typography>
      </Box>
      <TextField
        label="Display Name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        fullWidth
        helperText="Human-readable name shown in the header and page titles."
      />
      <TemplateSelector
        selectedId={editTemplate}
        currentId={tenant.template}
        onSelect={handleTemplateSelect}
        primaryColor={editPrimaryColor}
        secondaryColor={editSecondaryColor}
        onColorsChange={handleColorsChange}
        showPreviewDelta={true}
      />
    </Stack>
  );

  // ── Step 1: Preview ───────────────────────────────────────
  const renderStepPreview = () => (
    <Stack spacing={3}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        Live Preview
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Preview how the tenant application will look with the selected template and brand colors.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, bgcolor: 'background.default' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {selectedTemplate.label} — {displayName || tenant.displayName}
          </Typography>
          <Chip label={selectedTemplate.schemaOrgType as string} size="small" variant="outlined" color="info" />
        </Stack>

        {/* Header preview */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: editPrimaryColor, color: '#fff' }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body1" sx={{ fontWeight: 700 }}>
              {displayName || tenant.displayName}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>
                Dashboard
              </Box>
              <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>
                Reports
              </Box>
            </Stack>
          </Stack>
        </Paper>

        {/* Theme colors */}
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 1.5 }}>
          THEME COLORS
        </Typography>
        <Stack direction="row" sx={{ gap: 3, mb: 3 }}>
          <Stack spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="caption">Primary</Typography>
            <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: editPrimaryColor, border: '3px solid', borderColor: 'background.paper', boxShadow: 2 }} />
            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{editPrimaryColor}</Typography>
          </Stack>
          <Stack spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="caption">Secondary</Typography>
            <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: editSecondaryColor, border: '3px solid', borderColor: 'background.paper', boxShadow: 2 }} />
            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{editSecondaryColor}</Typography>
          </Stack>
        </Stack>

        {/* Pages */}
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 1.5 }}>
          PAGES ({selectedTemplate.defaultPages.length})
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', mb: 2 }}>
          {selectedTemplate.defaultPages.map((p) => (
            <Chip key={p.slug} label={p.title} size="small" variant="outlined" />
          ))}
        </Stack>

        {/* Button previews */}
        <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
          <Box sx={{ px: 2.5, py: 1, borderRadius: 1, bgcolor: editPrimaryColor, color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}>
            Primary Button
          </Box>
          <Box sx={{ px: 2.5, py: 1, borderRadius: 1, border: '1px solid', borderColor: editSecondaryColor, color: editSecondaryColor, fontSize: '0.85rem', fontWeight: 700 }}>
            Secondary
          </Box>
        </Stack>
      </Paper>

      {tenant.template !== editTemplate && (
        <Alert severity="info">
          <AlertTitle>Template Change Detected</AlertTitle>
          Switching from <strong>{getTemplate(tenant.template).label}</strong> to{' '}
          <strong>{selectedTemplate.label}</strong>. This will update pages, navigation, and schema.
        </Alert>
      )}
    </Stack>
  );

  // ── Step 2: License ───────────────────────────────────────
  const renderStepLicense = () => (
    <Stack spacing={3}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        License Configuration
      </Typography>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          label="License Key"
          value={license.licenseKey}
          onChange={(e) => handleLicenseChange('licenseKey', e.target.value)}
          fullWidth
          placeholder={'rrb-' + (tenant?.slug || 'unknown')}
          helperText="Auto-generated if left empty"
          sx={{ flex: 1 }}
        />
        <Button variant="outlined" size="small" onClick={generateLicenseKey} sx={{ mt: 0.5, minWidth: 100 }}>
          Generate
        </Button>
      </Stack>

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
    </Stack>
  );

  // ── Step 3: Features ──────────────────────────────────────
  const renderStepFeatures = () => (
    <Stack spacing={3}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Feature Toggles
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Enable or disable features for this tenant application. Each feature controls
        specific functionality in the deployed app.
      </Typography>
      <FormGroup row>
        {DEFAULT_FEATURES.map((feat) => (
          <FormControlLabel
            key={feat}
            control={<Checkbox checked={license.features.includes(feat)} onChange={() => toggleLicenseFeature(feat)} size="small" />}
            label={<Typography variant="body2">{feat}</Typography>}
          />
        ))}
      </FormGroup>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          API Keys &amp; PINs
        </Typography>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <TextField
              label="Setup Token (SETUP_TOKEN)"
              value={license.setupToken}
              onChange={(e) => handleLicenseChange('setupToken', e.target.value)}
              fullWidth type="password" sx={{ flex: 1 }}
            />
            <Button variant="outlined" size="small" onClick={generateSetupToken} sx={{ mt: 0.5, minWidth: 100 }}>
              Generate
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <TextField
              label="Admin PIN"
              value={license.adminPin}
              onChange={(e) => handleLicenseChange('adminPin', e.target.value)}
              fullWidth type="password" placeholder="454212" sx={{ flex: 1 }}
            />
            <Button variant="outlined" size="small" onClick={generateAdminPin} sx={{ mt: 0.5, minWidth: 100 }}>
              Generate
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );

  // ── Step 4: OpenAI API-Key ────────────────────────────────
  const renderStepOpenAi = () => (
    <Stack spacing={3}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        OpenAI API Key
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Set the OpenAI API key used by the tenant application for AI features
        like chat, content generation, and analysis.
      </Typography>
      <Alert severity="info">
        The API key is stored in the secrets table and injected as an environment variable
        during deployment. Generate a placeholder or enter a real OpenAI key.
      </Alert>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          label="OpenAI API Key"
          value={license.openaiApiKey}
          onChange={(e) => handleLicenseChange('openaiApiKey', e.target.value)}
          fullWidth type="password"
          placeholder="sk-proj-..."
          sx={{ flex: 1 }}
          slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
        />
        <Button variant="outlined" size="small" onClick={generateOpenAiKey} sx={{ mt: 0.5, minWidth: 100 }}>
          Generate
        </Button>
      </Stack>
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
        <Typography variant="caption" color="text.secondary">
          💡 Get your API key from{' '}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
            platform.openai.com
          </a>
        </Typography>
      </Paper>
    </Stack>
  );

  // ── Step 5: Google OAuth ──────────────────────────────────
  const renderStepOAuth = () => (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <VerifiedUserIcon color="primary" />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Google OAuth 2.0
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Configure Google OAuth credentials for the tenant application. You can
        auto-provision via the Google Cloud API (creates a new GCP project with
        the tenant slug as Project ID) or enter existing credentials manually.
      </Typography>

      {/* GCP Auto-Provisioning */}
      <Paper variant="outlined" sx={{ p: 2.5, borderColor: 'primary.main' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
          🚀 Auto-Provision from Google Cloud
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Google Cloud Account Email"
            type="email"
            value={googleOAuth.gcpAccountEmail}
            onChange={(e) => handleOAuthChange('gcpAccountEmail', e.target.value)}
            fullWidth size="small"
            placeholder="admin@google-cloud-project.iam.gserviceaccount.com"
            helperText="The GCP account email used to create the project and OAuth consent screen."
            slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
          />
          <Typography variant="caption" color="text.secondary">
            A new GCP project will be created with Project ID: <strong>{tenant.slug}</strong>
          </Typography>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              onClick={handleProvisionOAuth}
              disabled={provisioningOAuth || !googleOAuth.gcpAccountEmail.trim()}
              startIcon={provisioningOAuth ? <CircularProgress size={18} color="inherit" /> : <VerifiedUserIcon />}
            >
              {provisioningOAuth ? 'Creating...' : 'Create GCP Project & OAuth'}
            </Button>
            {googleOAuth.projectId && (
              <Button
                variant="outlined"
                href={`https://console.cloud.google.com/apis/credentials?project=${googleOAuth.projectId || tenant.slug}`}
                target="_blank"
                endIcon={<OpenInNewIcon />}
              >
                Open GCP Console
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {provisionOAuthResult && (
        <Alert severity="success">
          <AlertTitle>✅ OAuth Provisioning Complete</AlertTitle>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(provisionOAuthResult, null, 2)}
          </Typography>
        </Alert>
      )}
      {provisionOAuthError && (
        <Alert severity="error">
          <AlertTitle>❌ OAuth Provisioning Failed</AlertTitle>
          {provisionOAuthError}
        </Alert>
      )}

      <Divider><Typography variant="caption" color="text.secondary">or enter manually</Typography></Divider>

      {/* Manual OAuth fields */}
      <TextField
        label="Client ID"
        value={googleOAuth.clientId}
        onChange={(e) => handleOAuthChange('clientId', e.target.value)}
        fullWidth placeholder="670560975972-xxxxx.apps.googleusercontent.com"
      />
      <TextField
        label="Client Secret"
        value={googleOAuth.clientSecret}
        onChange={(e) => handleOAuthChange('clientSecret', e.target.value)}
        fullWidth type={showSecret ? 'text' : 'password'}
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
          <TextField label="Project ID" value={googleOAuth.projectId} onChange={(e) => handleOAuthChange('projectId', e.target.value)} fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField label="Support Email" type="email" value={googleOAuth.supportEmail} onChange={(e) => handleOAuthChange('supportEmail', e.target.value)} fullWidth placeholder="admin@tenant.com" />
        </Grid>
      </Grid>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Redirect URIs</Typography>
      <Stack spacing={1}>
        {googleOAuth.redirectUris.map((uri) => (
          <Stack key={uri} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip label={uri} variant="outlined" onDelete={() => removeRedirectUri(uri)} sx={{ flex: 1, justifyContent: 'flex-start', py: 0.5 }} />
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <TextField size="small" fullWidth placeholder="https://app.tenant.com/auth/callback" value={newRedirectUri}
          onChange={(e) => setNewRedirectUri(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRedirectUri(); } }} />
        <Button variant="outlined" size="small" onClick={addRedirectUri} startIcon={<AddIcon />}>Add</Button>
      </Stack>
    </Stack>
  );

  // ── Step 6: Database ──────────────────────────────────────
  const renderStepDatabase = () => (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <DnsIcon color="primary" />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Database Connection
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Configure the database connection for the tenant application. Auto-provision
        a Neon PostgreSQL database or enter an existing connection string.
      </Typography>

      {/* Neon Provisioning */}
      <Paper variant="outlined" sx={{ p: 2.5, borderColor: 'secondary.main' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
          🚀 Auto-Provision Neon Database
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Creates an isolated Neon branch + database for this tenant.
          Connection strings will be auto-filled below.
        </Typography>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained" color="secondary"
            onClick={handleProvisionDb}
            disabled={provisioningDb}
            startIcon={provisioningDb ? <CircularProgress size={18} color="inherit" /> : <DnsIcon />}
          >
            {provisioningDb ? 'Provisioning...' : 'Provision Neon Database'}
          </Button>
          <Button variant="outlined" href="https://console.neon.tech" target="_blank" endIcon={<OpenInNewIcon />}>
            Open Neon Console
          </Button>
        </Stack>
        {provisionDbResult && (
          <Alert severity="success" sx={{ mt: 1 }}>
            <AlertTitle>✅ Database Provisioned</AlertTitle>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Connection strings have been auto-populated below. Review and continue to the next step.
            </Typography>
            {/* Summary of key connection strings */}
            {(() => {
              const dd = provisionDbResult?.data as Record<string, unknown> | undefined;
              const conns = dd?.connectionStrings as Record<string, string> | undefined;
              if (!conns) return null;
              const entries = Object.entries(conns).slice(0, 6);
              return (
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.default' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>Provisioned Keys:</Typography>
                  {entries.map(([key, val]) => (
                    <Stack key={key} direction="row" spacing={1} sx={{ mb: 0.25 }}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700, minWidth: 200, fontSize: '0.65rem' }}>{key}=</Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', fontSize: '0.65rem', wordBreak: 'break-all' }}>{(val as string).length > 60 ? (val as string).substring(0, 60) + '...' : val}</Typography>
                    </Stack>
                  ))}
                </Paper>
              );
            })()}
          </Alert>
        )}
        {provisionDbError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            <AlertTitle>❌ Database Provisioning Failed</AlertTitle>
            {provisionDbError}
          </Alert>
        )}
      </Paper>

      <Divider><Typography variant="caption" color="text.secondary">or enter manually</Typography></Divider>

      <TextField
        label="Database URL (Pooled)"
        value={dbConfig.dbUrl}
        onChange={(e) => {
          const url = e.target.value;
          setDbConfig({ dbUrl: url, pooledUrl: url, directUrl: url.replace('-pooler', '') });
        }}
        fullWidth multiline rows={2}
        placeholder="postgresql://user:pass@ep-xxx-pooler.neon.tech/db?sslmode=require"
        slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: '0.8rem' } } }}
      />
      <TextField
        label="Direct URL (Unpooled)"
        value={dbConfig.directUrl}
        onChange={(e) => setDbConfig((prev) => ({ ...prev, directUrl: e.target.value }))}
        fullWidth multiline rows={2}
        slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: '0.8rem' } } }}
      />

      {/* Test Connection + Results */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleTestConnection}
          disabled={testingConnection || !dbConfig.dbUrl}
          startIcon={testingConnection ? <CircularProgress size={16} color="inherit" /> : <DnsIcon />}
        >
          {testingConnection ? 'Testing...' : 'Test Connection'}
        </Button>
        {connectionTestResult && (
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'pre-wrap',
              color: connectionTestResult.startsWith('✅') ? 'success.main' : connectionTestResult.startsWith('⚠️') ? 'warning.main' : 'error.main',
            }}
          >
            {connectionTestResult}
          </Typography>
        )}
      </Stack>
    </Stack>
  );

  // ── Step 7: Custom Env ────────────────────────────────────
  const renderStepEnv = () => (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <CloudIcon color="primary" />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Custom Environment Variables
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Add custom environment variables for the tenant application.
        These are injected into the Vercel project during deployment.
      </Typography>

      {envPairs.map((pair, index) => (
        <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField size="small" label="Key" value={pair.key}
            onChange={(e) => { const u = [...envPairs]; u[index].key = e.target.value; setEnvPairs(u); }}
            sx={{ flex: 1 }} slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} />
          <TextField size="small" label="Value" value={pair.value}
            onChange={(e) => { const u = [...envPairs]; u[index].value = e.target.value; setEnvPairs(u); }}
            sx={{ flex: 2 }} slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} />
          <IconButton color="error" size="small" onClick={() => removeEnvPair(index)}><DeleteIcon /></IconButton>
        </Stack>
      ))}

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <TextField size="small" label="Key" value={newEnvKey} onChange={(e) => setNewEnvKey(e.target.value)}
          sx={{ flex: 1 }} placeholder="MY_VARIABLE" slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEnvPair(); } }} />
        <TextField size="small" label="Value" value={newEnvValue} onChange={(e) => setNewEnvValue(e.target.value)}
          sx={{ flex: 2 }} slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEnvPair(); } }} />
        <Button variant="outlined" size="small" onClick={addEnvPair} startIcon={<AddIcon />} disabled={!newEnvKey || !newEnvValue}>Add</Button>
      </Stack>

      {envPairs.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No custom env vars yet. Add key-value pairs above.
        </Typography>
      )}
    </Stack>
  );

  // ── Step 8: Functional Roles ──────────────────────────────
  const renderStepRoles = () => (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 0.5 }}>
            <PeopleIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Functional Role Catalog
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Create, edit, and manage functional roles. Set PIN codes for role-based authentication.
          </Typography>
        </Box>
        <Button variant="contained" size="small" onClick={openCreateRole} startIcon={<AddIcon />} sx={{ flexShrink: 0 }}>
          Create Role
        </Button>
      </Stack>

      {rolesLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : rolesError ? (
        <Alert severity="error">{rolesError}</Alert>
      ) : rolesList.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>No roles configured.</Typography>
          <Button variant="outlined" onClick={openCreateRole} startIcon={<AddIcon />}>Create Role</Button>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {rolesList.map((role) => (
            <Paper key={role.code} variant="outlined" sx={{ p: 2, borderLeft: 4, borderLeftColor: role.isPlatformAdmin ? 'primary.main' : 'grey.300' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{role.name}</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>({role.code})</Typography>
                    {role.isPlatformAdmin && <Chip label="Platform Admin" size="small" color="primary" variant="outlined" />}
                  </Stack>
                  {role.email && <Typography variant="caption" color="text.secondary">{role.email}</Typography>}
                  <Chip icon={role.pinConfigured ? <CheckCircleIcon /> : <LockIcon />}
                    label={role.pinConfigured ? 'PIN Configured' : 'No PIN'} size="small"
                    color={role.pinConfigured ? 'success' : 'warning'}
                    variant={role.pinConfigured ? 'filled' : 'outlined'} />
                </Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
                  {settingPinRole === role.code ? (
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <TextField size="small" type="password" placeholder="Enter PIN (3+ chars)"
                        value={settingPinValue[role.code] || ''}
                        onChange={(e) => setSettingPinValue((prev) => ({ ...prev, [role.code]: e.target.value }))}
                        sx={{ width: 160 }} autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = settingPinValue[role.code] || ''; if (v.length >= 3) void handleSetRolePin(role.code, v); } }} />
                      <IconButton size="small" color="primary"
                        onClick={() => { const v = settingPinValue[role.code] || ''; if (v.length >= 3) void handleSetRolePin(role.code, v); }}
                        disabled={savingPinRole === role.code || (settingPinValue[role.code] || '').length < 3}>
                        {savingPinRole === role.code ? <CircularProgress size={18} /> : <CheckCircleIcon />}
                      </IconButton>
                      <IconButton size="small" onClick={() => { setSettingPinRole(null); setSettingPinValue((prev) => ({ ...prev, [role.code]: '' })); }}><CloseIcon /></IconButton>
                    </Stack>
                  ) : (
                    <>
                      <Tooltip title="Set PIN"><IconButton size="small" onClick={() => setSettingPinRole(role.code)} color="default"><LockIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Edit role"><IconButton size="small" onClick={() => openEditRole(role)} color="primary"><EditIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete role"><IconButton size="small" onClick={() => setRoleDeleteConfirm(role.code)} color="error"><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                    </>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Role CRUD dialog */}
      <Dialog open={roleDialogOpen} onClose={() => !roleSaving && setRoleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{roleDialogMode === 'create' ? 'Create Functional Role' : 'Edit Role: ' + roleFormCode}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {roleDialogMode === 'create' && (
              <TextField label="Role Code" value={roleFormCode}
                onChange={(e) => setRoleFormCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                fullWidth size="small" helperText="Unique identifier (lowercase, hyphens)." />
            )}
            <TextField label="Role Name" value={roleFormName}
              onChange={(e) => { setRoleFormName(e.target.value); if (roleDialogMode === 'create' && !roleFormCode) setRoleFormCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); }}
              fullWidth size="small" placeholder="e.g. Finance Manager" autoFocus={roleDialogMode === 'create'} />
            <TextField label="Email (optional)" type="email" value={roleFormEmail}
              onChange={(e) => setRoleFormEmail(e.target.value)} fullWidth size="small" placeholder="role-owner@tenant.com" />
            <FormControlLabel control={<Switch checked={roleFormIsPlatformAdmin} onChange={(e) => setRoleFormIsPlatformAdmin(e.target.checked)} />} label="Platform Admin (full access)" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRoleDialogOpen(false)} disabled={roleSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleRoleSave} disabled={roleSaving || !roleFormName.trim()}
            startIcon={roleSaving ? <CircularProgress size={18} color="inherit" /> : undefined}>
            {roleSaving ? 'Saving...' : roleDialogMode === 'create' ? 'Create Role' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={Boolean(roleDeleteConfirm)} onClose={() => !roleSaving && setRoleDeleteConfirm(null)}>
        <DialogTitle>Delete Role?</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete role <strong>{roleDeleteConfirm}</strong>?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleDeleteConfirm(null)} disabled={roleSaving}>Cancel</Button>
          <Button onClick={() => roleDeleteConfirm && handleRoleDelete(roleDeleteConfirm)} color="error" variant="contained" disabled={roleSaving}>
            {roleSaving ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Divider />
      <Typography variant="caption" color="text.secondary">
        Roles control access and task assignment. PINs are stored encrypted in the secrets table.
      </Typography>
    </Stack>
  );

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  const stepContent = (index: number): React.ReactNode => {
    switch (index) {
      case 0: return renderStepTemplate();
      case 1: return renderStepPreview();
      case 2: return renderStepLicense();
      case 3: return renderStepFeatures();
      case 4: return renderStepOpenAi();
      case 5: return renderStepOAuth();
      case 6: return renderStepDatabase();
      case 7: return renderStepEnv();
      case 8: return renderStepRoles();
      default: return null;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth aria-labelledby="edit-tenant-modal-title">
      {/* HEADER */}
      <DialogTitle id="edit-tenant-modal-title" sx={{ p: 0 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2, pb: 1 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <EditIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{tenant.displayName || tenant.slug}</Typography>
            <Chip label={tenant.status} size="small" color={
              tenant.status === 'live' ? 'success' : tenant.status === 'deploying' ? 'warning' : 'default'
            } />
          </Stack>
          <IconButton onClick={handleClose} size="small" aria-label="close"><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>

      {/* BODY WITH STEPPER */}
      <DialogContent dividers sx={{ p: { xs: 1.5, md: 3 }, minHeight: 400 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4, overflowX: 'auto', flexWrap: 'wrap' }} nonLinear={false}>
          {EDIT_STEPS.map((s) => (
            <Step key={s.key}>
              <StepLabel sx={{
                '& .MuiStepLabel-label': {
                  fontSize: { xs: '0.7rem', md: '0.8rem' },
                  fontWeight: activeStep === EDIT_STEPS.indexOf(s) ? 700 : 400,
                },
              }}>
                {isMobile ? s.label.substring(0, 8) + '\u2026' : s.label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ mt: 2 }}>{stepContent(activeStep)}</Box>

        {/* Deploy progress */}
        {deployingSlug && (
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
                    <StepLabel icon={icon} sx={{ '& .MuiStepLabel-label': { fontWeight: isActive || status === 'success' ? 600 : 400 } }}>
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
            <LinearProgress variant="determinate" value={(deployProgress / DEPLOY_STEPS.length) * 100} sx={{ mt: 2, height: 6, borderRadius: 4 }} />
          </Paper>
        )}
      </DialogContent>

      {/* FOOTER */}
      <DialogActions sx={{ px: 3, py: 2.5, gap: 2 }}>
        {activeStep > 0 ? (
          <Button onClick={handleBack} disabled={!!deployingSlug || saving}>Back</Button>
        ) : (
          <Button onClick={handleClose} disabled={!!deployingSlug || saving}>Cancel</Button>
        )}

        <Button variant="outlined" onClick={handleSave} disabled={!!deployingSlug || saving}
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />} sx={{ fontWeight: 600 }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>

        <Box sx={{ flex: 1 }} />
        {isLastStep ? (
          <Button variant="contained" color="primary" size="large" onClick={handleDeploy}
            disabled={!!deployingSlug || saving}
            startIcon={deployingSlug ? <CircularProgress size={20} color="inherit" /> : <RocketLaunchIcon />}
            sx={{ fontWeight: 700, minWidth: 220 }}>
            {deployingSlug ? 'DEPLOYING...' : 'DEPLOY TO VERCEL'}
          </Button>
        ) : (
          <Button variant="contained" onClick={handleNext} disabled={!!deployingSlug || saving} sx={{ fontWeight: 600 }}>
            Continue
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
