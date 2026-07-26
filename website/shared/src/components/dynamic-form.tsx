/**
 * Dynamic Form Assembler
 *
 * Renders a complete MUI form from a W3C schema model definition.
 * Each field is resolved to an MUI component via the registry.
 *
 * This is the core of the "UX GUI Block Assembly" — the AI agent
 * generates a schema, and this component renders it as a functional form
 * without any custom CSS or layout code.
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  Box,
  Grid2 as Grid,
  Typography,
  TextField,
  Checkbox,
  Switch,
  Select,
  MenuItem,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormControl,
  FormLabel,
  InputAdornment,
  Button,
  Autocomplete,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import type { SchemaModel, SchemaField } from '../lib/schema/types';
import { resolveComponent, resolveModelFields } from './resolver';

export interface DynamicFormProps {
  /** The schema model to render */
  model: SchemaModel;
  /** Initial values for the form fields */
  initialValues?: Record<string, unknown>;
  /** Called when the form is submitted */
  onSubmit: (values: Record<string, unknown>) => void;
  /** Optional title displayed above the form */
  title?: string;
  /** Optional description displayed below the title */
  description?: string;
  /** Submit button label */
  submitLabel?: string;
}

export function DynamicForm({
  model,
  initialValues = {},
  onSubmit,
  title,
  description,
  submitLabel = 'Submit',
}: DynamicFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = useCallback((fieldName: string, value: unknown) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
    // Clear error on change
    setErrors(prev => {
      if (!prev[fieldName]) return prev;
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    for (const field of model.fields) {
      if (field.required && (values[field.name] === undefined || values[field.name] === '' || values[field.name] === null)) {
        newErrors[field.name] = `${field.label ?? field.name} is required`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [model.fields, values]);

  const handleSubmit = useCallback(() => {
    if (validate()) {
      onSubmit(values);
    }
  }, [validate, values, onSubmit]);

  const resolvedFields = resolveModelFields(model);

  return (
    <Box sx={{ p: 3 }}>
      {title && (
        <Typography variant="h4" gutterBottom color="primary">
          {title}
        </Typography>
      )}
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {description}
        </Typography>
      )}

      <Grid container spacing={3}>
        {resolvedFields.map(({ field, config, registryKey }) => (
          <Grid size={{ xs: 12, md: field.width ?? 12 }} key={field.name}>
            <FieldRenderer
              field={field}
              registryKey={registryKey}
              value={values[field.name]}
              error={errors[field.name]}
              onChange={(value) => handleChange(field.name, value)}
            />
          </Grid>
        ))}
      </Grid>

      {Object.keys(errors).length > 0 && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Please fix the errors above before submitting.
        </Alert>
      )}

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" color="primary" size="large" onClick={handleSubmit}>
          {submitLabel}
        </Button>
      </Box>
    </Box>
  );
}

// ── Field Renderer ───────────────────────────────────────

interface FieldRendererProps {
  field: SchemaField;
  registryKey: string;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}

function FieldRenderer({ field, registryKey, value, error, onChange }: FieldRendererProps) {
  const label = field.label ?? field.name;
  const required = field.required ?? false;

  // ── String / Text / Numeric ───────────────────────────
  if (registryKey.startsWith('string:') || registryKey.startsWith('integer') || registryKey.startsWith('decimal')) {
    const isMultiline = registryKey === 'string:long';
    const inputType = registryKey.includes('email') ? 'email'
      : registryKey.includes('url') ? 'url'
      : registryKey.includes('phone') ? 'tel'
      : registryKey.includes('number') ? 'number'
      : registryKey.includes('datetime') ? 'datetime-local'
      : registryKey.includes('date') ? 'date'
      : registryKey.includes('time') ? 'time'
      : 'text';

    const adornment = registryKey === 'decimal:currency'
      ? { startAdornment: <InputAdornment position="start">IDR</InputAdornment> }
      : registryKey === 'decimal:percent'
      ? { endAdornment: <InputAdornment position="end">%</InputAdornment> }
      : undefined;

    return (
      <TextField
        fullWidth
        label={label}
        name={field.name}
        type={inputType}
        variant="outlined"
        required={required}
        multiline={isMultiline}
        rows={isMultiline ? 4 : undefined}
        value={value ?? ''}
        error={!!error}
        helperText={error ?? undefined}
        onChange={(e) => onChange(e.target.value)}
        InputProps={adornment}
      />
    );
  }

  // ── Boolean (Checkbox/Switch) ─────────────────────────
  if (registryKey.startsWith('boolean')) {
    const isSwitch = registryKey === 'boolean:switch';
    const Control = isSwitch ? Switch : Checkbox;
    return (
      <FormControl fullWidth error={!!error}>
        <FormControlLabel
          control={
            <Control
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
            />
          }
          label={label}
        />
      </FormControl>
    );
  }

  // ── Enum (Select/Radio) ───────────────────────────────
  if (registryKey.startsWith('enum:')) {
    const isRadio = registryKey === 'enum:radio';
    const options = field.enumValues ?? [];

    if (isRadio) {
      return (
        <FormControl fullWidth error={!!error}>
          <FormLabel required={required}>{label}</FormLabel>
          <RadioGroup
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
          >
            {options.map(opt => (
              <FormControlLabel key={opt} value={opt} control={<Radio />} label={opt} />
            ))}
          </RadioGroup>
        </FormControl>
      );
    }

    return (
      <FormControl fullWidth error={!!error}>
        <FormLabel required={required} sx={{ mb: 1 }}>{label}</FormLabel>
        <Select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          displayEmpty
        >
          <MenuItem value=""><em>Select...</em></MenuItem>
          {options.map(opt => (
            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  // ── Relation (Autocomplete) ───────────────────────────
  if (registryKey.startsWith('relation:m2o') || registryKey.startsWith('relation:m2m')) {
    const isMultiple = registryKey === 'relation:m2m';
    return (
      <Autocomplete
        fullWidth
        multiple={isMultiple}
        options={[]} // Options would be fetched dynamically based on relationTo
        value={value ?? (isMultiple ? [] : null)}
        onChange={(_, newValue) => onChange(newValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            variant="outlined"
            required={required}
            error={!!error}
            helperText={error ?? `Select from ${field.relationTo ?? 'options'}`}
          />
        )}
      />
    );
  }

  // ── JSON (Accordion for objects) ──────────────────────
  if (registryKey === 'json:object') {
    return (
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>{label}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            fullWidth
            multiline
            rows={6}
            label={`${label} (JSON)`}
            value={typeof value === 'string' ? value : JSON.stringify(value ?? '', null, 2)}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
                onChange(e.target.value); // Keep raw string if invalid JSON
              }
            }}
          />
        </AccordionDetails>
      </Accordion>
    );
  }

  // ── JSON Array (DataGrid placeholder) ─────────────────
  if (registryKey === 'json:array') {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {label} (array)
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={4}
          label={`${label} (JSON array)`}
          value={typeof value === 'string' ? value : JSON.stringify(value ?? [], null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
        />
      </Box>
    );
  }

  // ── Fallback ──────────────────────────────────────────
  return (
    <TextField
      fullWidth
      label={label}
      name={field.name}
      variant="outlined"
      required={required}
      value={value ?? ''}
      error={!!error}
      helperText={error ?? undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
