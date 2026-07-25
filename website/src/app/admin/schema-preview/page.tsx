/**
 * AI Schema Preview Page
 *
 * Allows testing the end-to-end milestone:
 *   1. User types a natural language prompt
 *   2. AI generates a W3C schema (via tokenizmyapp API)
 *   3. MUI registry renders the schema as a functional form
 *
 * This page demonstrates Phase 0 → 1 → 2 integration.
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Box, Container, TextField, Button, Typography, Alert,
  Select, MenuItem, FormControl, InputLabel, Grid,
  Paper, Divider, Chip, CircularProgress, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CodeIcon from '@mui/icons-material/Code';
import FormIcon from '@mui/icons-material/Assignment';

import { DynamicForm } from '@/components/blocks/dynamic-form-block';
import type { SchemaModel, W3CSchemaDefinition } from '@/lib/schema/types';

const TEMPLATES = [
  { id: 'financial-analytics', label: 'Financial Analytics' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'hotel', label: 'Hotel & Hospitality' },
  { id: 'ecommerce-retail', label: 'E-Commerce & Retail' },
  { id: 'healthcare', label: 'Healthcare & Clinical' },
  { id: 'supply-chain', label: 'Supply Chain & Logistics' },
  { id: 'real-estate', label: 'Real Estate & Property' },
  { id: 'education', label: 'Education & E-Learning' },
  { id: 'professional-services', label: 'Professional Services' },
  { id: 'manufacturing', label: 'Manufacturing & Industrial' },
];

interface GenerateResponse {
  success: boolean;
  data?: {
    schema: W3CSchemaDefinition;
    zmodel: string;
    pageCatalog: string;
    modelCount: number;
    useCaseCount: number;
    pageCount: number;
    mock?: boolean;
  };
  error?: string;
}

export default function SchemaPreviewPage() {
  const [prompt, setPrompt] = useState('');
  const [templateId, setTemplateId] = useState('restaurant');
  const [useMock, setUseMock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse['data'] | null>(null);
  const [selectedModelIdx, setSelectedModelIdx] = useState(0);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedModelIdx(0);

    try {
      const res = await fetch('/api/admin/tenants/generate-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt || `Generate a ${templateId} business schema`,
          templateId,
          mock: useMock,
        }),
      });
      const data: GenerateResponse = await res.json();
      if (data.success && data.data) {
        setResult(data.data);
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
    setLoading(false);
  }, [prompt, templateId, useMock]);

  const currentModel: SchemaModel | null = result?.schema.models[selectedModelIdx] ?? null;

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h3" gutterBottom color="primary">
          AI Schema Preview
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Type a business description, select a template, and generate a W3C-aligned schema.
          The MUI registry renders the schema as a functional form.
        </Typography>

        {/* ── Input section ─────────────────────────── */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Template</InputLabel>
                <Select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  label="Template"
                >
                  {TEMPLATES.map(t => (
                    <MenuItem key={t.id} value={t.id}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                fullWidth
                label="Business Description (natural language prompt)"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., I run a restaurant in Bali with 20 tables, serving Indonesian and international cuisine..."
                multiline
                rows={2}
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleGenerate}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {loading ? 'Generating...' : 'Generate Schema'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => setUseMock(!useMock)}
              color={useMock ? 'secondary' : 'inherit'}
            >
              Mock Mode: {useMock ? 'ON' : 'OFF'}
            </Button>
          </Box>
        </Paper>

        {/* ── Error display ─────────────────────────── */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* ── Results ──────────────────────────────── */}
        {result && (
          <Box>
            {/* Summary chips */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Chip label={`${result.modelCount} models`} color="primary" />
              <Chip label={`${result.useCaseCount} use cases`} color="secondary" />
              <Chip label={`${result.pageCount} pages`} color="info" />
              {result.mock && <Chip label="MOCK" color="warning" />}
              <Chip label={result.schema.schemaOrgType} variant="outlined" />
            </Box>

            {/* Model selector */}
            {result.schema.models.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Model Preview</InputLabel>
                  <Select
                    value={selectedModelIdx}
                    onChange={(e) => setSelectedModelIdx(Number(e.target.value))}
                    label="Model Preview"
                  >
                    {result.schema.models.map((m, idx) => (
                      <MenuItem key={m.name} value={idx}>{m.name} ({m.fields.length} fields)</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}

            {/* ── Form preview (Phase 1 integration) ── */}
            {currentModel && (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FormIcon color="primary" />
                    <Typography variant="h6">{currentModel.name} — Form Preview</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <DynamicForm
                      model={currentModel}
                      onSubmit={(values: Record<string, unknown>) => {
                        console.log('Form submitted:', values);
                        alert(`Form submitted!\n\n${JSON.stringify(values, null, 2)}`);
                      }}
                      title={currentModel.name}
                      description={`Table: ${currentModel.tableName} — rendered from W3C schema via MUI registry`}
                      submitLabel="Save"
                    />
                  </Paper>
                </AccordionDetails>
              </Accordion>
            )}

            {/* ── Generated .zmodel (Phase 2 output) ── */}
            <Accordion sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CodeIcon color="primary" />
                  <Typography variant="h6">Generated ZenStack Schema (.zmodel)</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: '#0d1117', overflow: 'auto' }}>
                  <pre style={{ fontSize: 12, color: '#c9d1d9', whiteSpace: 'pre-wrap' }}>
                    {result.zmodel}
                  </pre>
                </Paper>
              </AccordionDetails>
            </Accordion>

            {/* ── Use cases ─────────────────────────── */}
            <Accordion sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Use Cases ({result.schema.useCases.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {result.schema.useCases.map(uc => (
                  <Box key={uc.id} sx={{ mb: 1 }}>
                    <Typography variant="body2">
                      <strong>{uc.id}</strong>: {uc.title}
                      <Chip label={uc.auth} size="small" sx={{ ml: 1 }} />
                      <Chip label={uc.route} size="small" variant="outlined" sx={{ ml: 1 }} />
                    </Typography>
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>

            {/* ── Pages ─────────────────────────────── */}
            <Accordion sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Pages ({result.schema.pages.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {result.schema.pages.map(p => (
                  <Box key={p.slug} sx={{ mb: 1 }}>
                    <Typography variant="body2">
                      <strong>/{p.slug}</strong>: {p.title}
                      <Chip label={p.authTier} size="small" sx={{ ml: 1 }} />
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Blocks: {p.blockTypes.join(', ')}
                    </Typography>
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>
          </Box>
        )}

        <Divider sx={{ my: 4 }} />
        <Typography variant="caption" color="text.secondary">
          Phase 0 → 1 → 2 Milestone: Prompt → AI Schema → MUI Form Render
        </Typography>
      </Box>
    </Container>
  );
}
