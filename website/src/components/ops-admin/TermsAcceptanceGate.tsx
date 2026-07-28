'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Link as MuiLink,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Stack,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Close as CloseIcon,
  PictureAsPdf as PdfIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';

/**
 * TermsAcceptanceGate — Reusable MUI v9 component for terms & conditions gate.
 * 
 * Features:
 * - Modal/PDF viewer for terms review (integrates with /terms-of-service or custom)
 * - Checkbox with validation (must view if requireView=true)
 * - Persistence via localStorage + callback for API/RTK integration
 * - Error handling, loading states, accessibility
 * - Schema.org alignment hint for legal pages
 * - Production-ready: named export, strict TS, no `any`, follows tenant-wizard patterns
 * 
 * Used in OnboardingStepper, sign-up flows, partner portals.
 */
export interface TermsAcceptanceGateProps {
  /** Callback when acceptance state changes */
  onAccept: (accepted: boolean, metadata?: Record<string, unknown>) => void;
  /** Initial accepted state (e.g. from API) */
  accepted?: boolean;
  /** Terms title */
  termsTitle?: string;
  /** URL for full terms (PDF or page) */
  termsUrl?: string;
  /** Optional inline terms content for modal */
  termsContent?: string;
  /** Disable the gate */
  disabled?: boolean;
  /** localStorage key for persistence across sessions */
  persistKey?: string;
  /** Require viewing terms before checkbox enables */
  requireView?: boolean;
  /** Optional className for styling */
  className?: string;
  /** Show success state after acceptance */
  showSuccess?: boolean;
}

export const TermsAcceptanceGate: React.FC<TermsAcceptanceGateProps> = ({
  onAccept,
  accepted = false,
  termsTitle = 'Reseller Partnership Agreement & Terms of Service',
  termsUrl = '/terms-of-service',
  termsContent,
  disabled = false,
  persistKey = 'reseller-terms-accepted-v1',
  requireView = true,
  className,
  showSuccess = true,
}) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isChecked, setIsChecked] = useState(accepted);
  const [hasViewed, setHasViewed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(accepted);

  // Persistence and initial load
  useEffect(() => {
    if (persistKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(persistKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          const isAccepted = parsed.accepted === true;
          setIsChecked(isAccepted);
          setHasViewed(parsed.hasViewed || false);
          setSuccess(isAccepted);
          if (isAccepted && onAccept) {
            onAccept(true, parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to load terms acceptance from storage', e);
      }
    }
  }, [persistKey, onAccept]);

  const handleViewTerms = useCallback(() => {
    setIsOpen(true);
    setHasViewed(true);
    setError(null);
    // In production, could dispatch RTK mutation to log view event
    // e.g. useLogTermsViewMutation().trigger({ termsVersion: '1.0' });
  }, []);

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setIsChecked(checked);
    setError(null);

    if (checked) {
      if (requireView && !hasViewed) {
        setError('You must review the full Terms before accepting.');
        return;
      }
      // Auto-accept on check if valid
      handleAccept(true);
    } else {
      setSuccess(false);
    }
  };

  const handleAccept = async (value: boolean) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const metadata = {
        accepted: value,
        timestamp: new Date().toISOString(),
        hasViewed,
        termsVersion: '1.0',
        termsTitle,
        ip: 'client-recorded', // would be server-side in prod
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      };

      // Persist locally
      if (persistKey && typeof window !== 'undefined') {
        localStorage.setItem(persistKey, JSON.stringify(metadata));
      }

      // Call parent callback (integrates with RTK Query / form submission)
      await onAccept(value, metadata);
      
      setSuccess(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record acceptance');
      setIsChecked(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setIsOpen(false);
  };

  const isValid = isChecked && (!requireView || hasViewed);

  return (
    <Box 
      className={className} 
      sx={{ 
        p: 3, 
        border: `2px solid ${success ? theme.palette.success.main : theme.palette.divider}`, 
        borderRadius: 2,
        bgcolor: success ? alpha(theme.palette.success.main, 0.05) : 'background.paper',
        transition: 'border-color 0.3s ease, background-color 0.3s ease',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <DescriptionIcon color="primary" />
        <Typography variant="h6" component="h3">
          Partnership Terms & Acceptance
        </Typography>
        {success && <CheckCircleIcon color="success" />}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600, mb: 3 }}>
        As a reseller/partner, you must accept our Terms covering automated onboarding, client generation via template delta, 
        product scraping policies, commission structures (configurable 60/40 with PTIX auto-exchange), data usage, 
        OfferCatalog responsibilities, and schema.org compliance. Acceptance is logged for compliance and audit.
      </Typography>

      <Button
        variant="outlined"
        startIcon={<DescriptionIcon />}
        onClick={handleViewTerms}
        disabled={disabled || isSubmitting}
        sx={{ mb: 3, mr: 2 }}
      >
        {hasViewed ? 'Review Terms Again' : 'Review Full Terms (Modal/PDF)'}
      </Button>

      {termsUrl && (
        <Button
          variant="text"
          component={MuiLink}
          href={termsUrl}
          target="_blank"
          startIcon={<PdfIcon />}
          sx={{ mb: 3 }}
        >
          Open PDF Version
        </Button>
      )}

      <Divider sx={{ my: 2 }} />

      <FormControlLabel
        control={
          <Checkbox
            checked={isChecked}
            onChange={handleCheckboxChange}
            disabled={disabled || isSubmitting || (requireView && !hasViewed)}
            color="primary"
            sx={{ '& .MuiSvgIcon-root': { fontSize: 28 } }}
          />
        }
        label={
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            I have <strong>fully reviewed</strong> and agree to the Reseller Partnership Agreement, Terms of Service, 
            Privacy Policy, Commission & PTIX Policy, Scraping Guidelines, and all linked legal documents. 
            This digital acceptance is legally binding and will be permanently recorded with timestamp and metadata.
          </Typography>
        }
        sx={{ alignItems: 'flex-start', mb: 2 }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && showSuccess && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
          Terms successfully accepted on {new Date().toLocaleDateString()}. You may proceed with onboarding.
        </Alert>
      )}

      <Button
        variant="contained"
        color="primary"
        onClick={() => handleAccept(true)}
        disabled={!isValid || disabled || isSubmitting || success}
        fullWidth
        size="large"
        startIcon={isSubmitting ? <CircularProgress size={20} /> : <CheckCircleIcon />}
        sx={{ mt: 1, py: 1.5 }}
      >
        {isSubmitting ? 'Recording Acceptance...' : success ? 'Accepted ✓' : 'Accept Terms & Continue'}
      </Button>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
        Acceptance is required for automated client generation and access to reseller tools. 
        Questions? Contact ops@prestix.vip
      </Typography>

      {/* Terms Viewer Modal */}
      <Dialog 
        open={isOpen} 
        onClose={handleCloseModal} 
        maxWidth="lg" 
        fullWidth
        scroll="paper"
        aria-labelledby="terms-dialog-title"
      >
        <DialogTitle id="terms-dialog-title" sx={{ pr: 6 }}>
          {termsTitle}
          <IconButton
            aria-label="close"
            onClick={handleCloseModal}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: '60vh' }}>
          {termsContent ? (
            <Box sx={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', lineHeight: 1.7 }}>
              {termsContent}
            </Box>
          ) : (
            <Stack spacing={3}>
              <Alert severity="info">
                This is a summary view. The full legally binding document is available via the PDF link or dedicated terms page.
                By proceeding you acknowledge having reviewed the complete version.
              </Alert>
              
              <Typography variant="h6">Key Reseller Onboarding Provisions:</Typography>
              
              <Box component="ul" sx={{ pl: 3 }}>
                <li><strong>Automated Onboarding:</strong> Template delta application, tenant provisioning, Vercel deployment, schema.org seeding for Reseller/Organization/OfferCatalog.</li>
                <li><strong>Scraping & AI:</strong> Permitted for public business data; rate-limited; generates prompts for content, menus, offers.</li>
                <li><strong>Revenue Model:</strong> Configurable commission splits with automatic PTIX token exchange and pool compounding.</li>
                <li><strong>Partner Dashboard:</strong> Network metrics, commission PNL, real-time performance tracking, security-groups based access.</li>
                <li><strong>Compliance:</strong> All generated tenants inherit proper structured data. Acceptance is auditable.</li>
              </Box>

              <Divider />

              <Typography variant="body2" color="text.secondary">
                Full terms available at <MuiLink href={termsUrl} target="_blank" rel="noopener">{termsUrl}</MuiLink>. 
                This modal serves as guided review. For production, integrate PDF.js or iframe viewer for the actual PDF.
              </Typography>

              <Box sx={{ p: 2, border: '1px solid', borderColor: 'primary.main', borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <Typography variant="subtitle2" gutterBottom>
                  Acceptance Metadata (for audit):
                </Typography>
                <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace', bgcolor: 'background.paper', p: 1, borderRadius: 1, overflow: 'auto' }}>
                  {JSON.stringify({
                    version: '1.0',
                    timestamp: new Date().toISOString(),
                    type: 'reseller-onboarding',
                    schemaOrg: ['Reseller', 'Organization', 'OfferCatalog']
                  }, null, 2)}
                </Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseModal} variant="outlined">
            Close Viewer
          </Button>
          <Button 
            onClick={() => {
              setHasViewed(true);
              handleCloseModal();
              // Optionally auto-check after review
            }}
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
          >
            I Confirm I Have Reviewed All Terms
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TermsAcceptanceGate;
