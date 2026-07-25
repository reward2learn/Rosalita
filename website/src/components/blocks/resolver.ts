/**
 * Schema-to-Component Resolver
 *
 * Takes a SchemaField from a W3C schema definition and resolves
 * it to the appropriate MUI component configuration from the registry.
 *
 * Resolution logic:
 * 1. Check field type (string, decimal, enum, relation, etc.)
 * 2. Check field name patterns (email, url, phone, price, cost, rate, etc.)
 * 3. Check schema.org property mappings
 * 4. Fall back to sensible defaults
 */

import { MUI_COMPONENT_REGISTRY, FALLBACK_COMPONENT, type MUIComponentConfig } from './registry';
import type { SchemaField } from '@/lib/schema/types';

/**
 * Build the registry key for a schema field.
 * Format: "{type}:{variant}" where variant is inferred from name/properties.
 */
export function buildRegistryKey(field: SchemaField): string {
  // ── String variants ───────────────────────────────────
  if (field.type === 'string') {
    const nameLower = field.name.toLowerCase();
    const propLower = field.schemaOrgProperty?.toLowerCase() ?? '';

    if (nameLower === 'email' || propLower === 'email') return 'string:email';
    if (nameLower === 'url' || nameLower === 'imageurl' || propLower === 'url') return 'string:url';
    if (nameLower === 'phone' || nameLower === 'phonenumber' || propLower === 'telephone') return 'string:phone';
    return 'string:short';
  }

  // ── Text (long string) ────────────────────────────────
  if (field.type === 'text') return 'string:long';

  // ── Integer ───────────────────────────────────────────
  if (field.type === 'integer') return 'integer';

  // ── Decimal variants ──────────────────────────────────
  if (field.type === 'decimal') {
    const nameLower = field.name.toLowerCase();
    if (nameLower.includes('price') || nameLower.includes('cost') || nameLower.includes('revenue') ||
        nameLower.includes('amount') || nameLower.includes('fee') || nameLower.includes('sales') ||
        field.schemaOrgProperty?.includes('price') || field.schemaOrgProperty?.includes('income')) {
      return 'decimal:currency';
    }
    if (nameLower.includes('rate') || nameLower.includes('percent') || nameLower.includes('margin')) {
      return 'decimal:percent';
    }
    return 'decimal:plain';
  }

  // ── Boolean variants ──────────────────────────────────
  if (field.type === 'boolean') {
    // Use switch for active/enabled flags, checkbox for others
    const nameLower = field.name.toLowerCase();
    if (nameLower === 'isactive' || nameLower === 'isenabled' || nameLower === 'isavailable') {
      return 'boolean:switch';
    }
    return 'boolean';
  }

  // ── Date/Time ─────────────────────────────────────────
  if (field.type === 'datetime') return 'datetime';
  if (field.type === 'date') return 'date';
  if (field.type === 'time') return 'time';

  // ── Enum ──────────────────────────────────────────────
  if (field.type === 'enum') {
    // Use radio for small enum sets (≤4), select for larger
    if (field.enumValues && field.enumValues.length <= 4) {
      return 'enum:radio';
    }
    return 'enum:select';
  }

  // ── Relation ──────────────────────────────────────────
  if (field.type === 'relation') {
    if (field.relationType === 'one-to-many') return 'relation:o2m';
    if (field.relationType === 'many-to-many') return 'relation:m2m';
    return 'relation:m2o'; // default to many-to-one
  }

  // ── JSON ──────────────────────────────────────────────
  if (field.type === 'json') {
    if (field.default instanceof Array || field.name.toLowerCase().includes('array') ||
        field.name.toLowerCase().includes('items') || field.name.toLowerCase().includes('list')) {
      return 'json:array';
    }
    return 'json:object';
  }

  // ── Fallback ──────────────────────────────────────────
  return 'string:short';
}

/**
 * Resolve a schema field to its MUI component configuration.
 */
export function resolveComponent(field: SchemaField): MUIComponentConfig {
  const key = buildRegistryKey(field);
  return MUI_COMPONENT_REGISTRY[key] ?? FALLBACK_COMPONENT;
}

/**
 * Resolve all fields in a model to their component configurations.
 * Returns an array of { field, config } pairs ready for rendering.
 */
export function resolveModelFields(model: { fields: SchemaField[] }): Array<{
  field: SchemaField;
  config: MUIComponentConfig;
  registryKey: string;
}> {
  return model.fields.map(field => {
    const registryKey = buildRegistryKey(field);
    const config = MUI_COMPONENT_REGISTRY[registryKey] ?? FALLBACK_COMPONENT;
    return { field, config, registryKey };
  });
}
