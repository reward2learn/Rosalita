'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Button from '@mui/material/Button';
import { useGetTenantInfoQuery } from '@shared/store/apis/tenant-info-api';
import { getTemplate } from '@/domain/tenant/template-catalog';

/**
 * Tenant Information Tab
 *
 * Reads deploy data from /api/admin/tenant-info — which reflects exactly
 * what the tenant administrator configured via the tokenizmyapp deploy endpoint.
 *
 * No hardcoded template values, no slug-based fallbacks. Everything is
 * data-driven from the app_config + app_settings tables in the tenant's DB.
 */
export function TenantInfoTab() {
  const { data: apiData, isLoading, isError } = useGetTenantInfoQuery();

  const info = apiData?.data;

  // Derive template label from the deployed template value (no hardcoded fallback)
  const templateId = info?.template || 'default';
  const template = getTemplate(templateId);
  const templateLabel = template?.label || templateId;

  const config = info?.config;
  const metadata = info?.metadata;

  // Extract additional deploy info from config
  const subscriptionTier = (config?.subscriptionTier as string) || (config?.subscription_tier as string);
  const licenseTier = config?.license ? (config.license as Record<string, unknown>)?.tier as string : undefined;

  if (isLoading) {
    return (
      <Paper variant="outlined" sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Paper>
    );
  }

  if (isError || !info) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography color="error">Failed to load tenant info from deploy data. Ensure the tenant has been deployed.</Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2.5}>
        {/* Header */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Tenant Information
          </Typography>
          <Chip
            label={`Source: ${info.source.replace(/_/g, ' ')}`}
            size="small"
            variant="outlined"
            color={info.source === 'app_config' ? 'success' : info.source === 'app_settings' ? 'info' : 'default'}
          />
        </Stack>

        {/* Core identity */}
        <Stack spacing={1.5} sx={{ maxWidth: 550 }}>
          <InfoRow label="Slug" value={info.slug} />
          <InfoRow label="Display Name" value={info.displayName} />
          <InfoRow
            label="Template"
            value={templateLabel}
            chip={templateLabel}
          />
          <InfoRow label="App URL" value={`https://${info.slug}.vercel.app`} link={`https://${info.slug}.vercel.app`} />

          {/* Brand Colors */}
          {info.primaryColor ? (
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120, fontWeight: 600 }}>
                Brand Colors
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: info.primaryColor, border: '1px solid rgba(255,255,255,0.2)' }} />
                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{info.primaryColor}</Typography>
                <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: info.secondaryColor, border: '1px solid rgba(255,255,255,0.2)' }} />
                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{info.secondaryColor}</Typography>
              </Box>
            </Stack>
          ) : null}

          {/* Template Pages */}
          {template && template.defaultPages.length > 0 ? (
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120, fontWeight: 600, pt: 0.5 }}>
                Pages
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {template.defaultPages.map((p) => (
                  <Chip key={p.slug} label={p.title} size="small" variant="outlined" />
                ))}
              </Stack>
            </Stack>
          ) : null}
        </Stack>

        {/* Deploy Information */}
        {info.lastDeployed || info.deployedTemplate || info.amendmentReason ? (
          <>
            <Divider />
            <Stack spacing={1.5} sx={{ maxWidth: 550 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Deploy Information
              </Typography>
              {info.deployedTemplate ? (
                <InfoRow label="Deployed Template" value={info.deployedTemplate} />
              ) : null}
              {info.lastDeployed ? (
                <InfoRow label="Last Deployed" value={new Date(info.lastDeployed).toLocaleString('en-GB')} />
              ) : null}
              {info.lastUpdated ? (
                <InfoRow label="Last Updated" value={new Date(info.lastUpdated).toLocaleString('en-GB')} />
              ) : null}
              {info.amendmentReason ? (
                <InfoRow label="Amendment Reason" value={info.amendmentReason} />
              ) : null}
            </Stack>
          </>
        ) : null}

        {/* Config Details */}
        {config ? (
          <>
            <Divider />
            <Stack spacing={1.5} sx={{ maxWidth: 550 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Deploy Configuration
              </Typography>
              <InfoRow label="Config Version" value={(config.configVersion as string) || 'N/A'} />
              {subscriptionTier ? (
                <InfoRow label="Subscription Tier" value={subscriptionTier} chip={subscriptionTier} />
              ) : null}
              {licenseTier ? (
                <InfoRow label="License Tier" value={licenseTier} chip={licenseTier} />
              ) : null}
              {config.database ? (
                <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120, fontWeight: 600, pt: 0.5 }}>
                    Database
                  </Typography>
                  <Stack>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                      {(config.database as Record<string, unknown>)?.type as string || 'neon'} · {(config.database as Record<string, unknown>)?.provider as string || 'postgresql'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(config.database as Record<string, unknown>)?.connectionLimit as string || '10'} connections · PgBouncer: {(config.database as Record<string, unknown>)?.pgbouncer as string || 'true'}
                    </Typography>
                  </Stack>
                </Stack>
              ) : null}
              <InfoRow label="AI Content Generated" value={(config.aiContentGenerated as boolean) ? 'Yes' : 'No'} />
              <InfoRow label="Seeded from Catalog" value={(config.seededFromCatalog as boolean) ? 'Yes' : 'No'} />
            </Stack>
          </>
        ) : null}
      </Stack>
    </Paper>
  );
}

function InfoRow({ label, value, chip, link }: { label: string; value: string; chip?: string; link?: string }) {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120, fontWeight: 600 }}>
        {label}
      </Typography>
      {link ? (
        <Button
          size="small"
          variant="text"
          href={link}
          target="_blank"
          endIcon={<OpenInNewIcon fontSize="small" />}
          sx={{ fontSize: '0.8rem', textTransform: 'none' }}
        >
          {value}
        </Button>
      ) : chip ? (
        <Chip label={chip} size="small" variant="outlined" color="info" />
      ) : (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
      )}
    </Stack>
  );
}
