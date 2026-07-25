/**
 * MUI Pre-Compiled Component Registry
 *
 * Maps schema field types to pre-compiled MUI v9 components.
 * The AI agent uses this registry to assemble UIs from W3C schemas
 * without writing custom CSS or React layout code.
 *
 * Key: "{type}:{variant}" → MUI component + default props
 */

import type { ComponentType } from 'react';

// ── MUI component imports ────────────────────────────────
// We import from @mui/material — these are pre-compiled in the shared package
// and tree-shaken by the bundler. No runtime CSS generation needed.

export interface MUIComponentConfig {
  /** The MUI component to render */
  component: ComponentType<any>;
  /** Default props to pass to the component */
  props: Record<string, unknown>;
  /** Whether the component needs dynamic options (enum values, relation data) */
  needsOptions?: boolean;
  /** Whether the component needs a data grid (for collections) */
  isCollection?: boolean;
}

// ── Registry ──────────────────────────────────────────────

export const MUI_COMPONENT_REGISTRY: Record<string, MUIComponentConfig> = {
  // ── String fields ──────────────────────────────────────
  'string:short': {
    component: 'TextField' as any,
    props: { variant: 'outlined', fullWidth: true },
  },
  'string:long': {
    component: 'TextField' as any,
    props: { variant: 'outlined', fullWidth: true, multiline: true, rows: 4 },
  },
  'string:email': {
    component: 'TextField' as any,
    props: { variant: 'outlined', fullWidth: true, type: 'email' },
  },
  'string:url': {
    component: 'TextField' as any,
    props: { variant: 'outlined', fullWidth: true, type: 'url' },
  },
  'string:phone': {
    component: 'TextField' as any,
    props: { variant: 'outlined', fullWidth: true, type: 'tel' },
  },

  // ── Numeric fields ─────────────────────────────────────
  'integer': {
    component: 'TextField' as any,
    props: { variant: 'outlined', fullWidth: true, type: 'number' },
  },
  'decimal:currency': {
    component: 'TextField' as any,
    props: {
      variant: 'outlined', fullWidth: true, type: 'number',
      InputProps: { startAdornment: 'IDR' },
    },
  },
  'decimal:percent': {
    component: 'TextField' as any,
    props: {
      variant: 'outlined', fullWidth: true, type: 'number',
      InputProps: { endAdornment: '%' },
    },
  },
  'decimal:plain': {
    component: 'TextField' as any,
    props: { variant: 'outlined', fullWidth: true, type: 'number' },
  },

  // ── Boolean ────────────────────────────────────────────
  'boolean': {
    component: 'Checkbox' as any,
    props: {},
  },
  'boolean:switch': {
    component: 'Switch' as any,
    props: {},
  },

  // ── Date/Time ──────────────────────────────────────────
  'datetime': {
    component: 'TextField' as any,
    props: { variant: 'outlined', fullWidth: true, type: 'datetime-local' },
  },
  'date': {
    component: 'TextField' as any,
    props: { variant: 'outlined', fullWidth: true, type: 'date' },
  },
  'time': {
    component: 'TextField' as any,
    props: { variant: 'outlined', fullWidth: true, type: 'time' },
  },

  // ── Enum ───────────────────────────────────────────────
  'enum:select': {
    component: 'Select' as any,
    props: { fullWidth: true },
    needsOptions: true,
  },
  'enum:radio': {
    component: 'RadioGroup' as any,
    props: {},
    needsOptions: true,
  },

  // ── Relations ──────────────────────────────────────────
  'relation:m2o': {
    component: 'Autocomplete' as any,
    props: { fullWidth: true },
    needsOptions: true,
  },
  'relation:o2m': {
    component: 'DataGrid' as any,
    props: {},
    isCollection: true,
  },
  'relation:m2m': {
    component: 'Autocomplete' as any,
    props: { fullWidth: true, multiple: true },
    needsOptions: true,
  },

  // ── JSON ───────────────────────────────────────────────
  'json:array': {
    component: 'DataGrid' as any,
    props: {},
    isCollection: true,
  },
  'json:object': {
    component: 'Accordion' as any,
    props: {},
  },

  // ── Display blocks (not form fields) ───────────────────
  'display:hero': {
    component: 'Box' as any,
    props: {},
  },
  'display:kpi': {
    component: 'Box' as any,
    props: {},
  },
  'display:chart': {
    component: 'Box' as any,
    props: {},
  },
  'display:table': {
    component: 'Box' as any,
    props: {},
  },
  'display:markdown': {
    component: 'Box' as any,
    props: {},
  },
};

// ── Fallback ─────────────────────────────────────────────

export const FALLBACK_COMPONENT: MUIComponentConfig = {
  component: 'TextField' as any,
  props: { variant: 'outlined', fullWidth: true },
};
