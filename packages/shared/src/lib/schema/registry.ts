/**
 * Template Schema Registry — maps template IDs to their W3C schema definitions.
 *
 * This registry is the single source of truth for template-specific
 * schema models, use cases, pages, and blocks.
 */

import type { W3CSchemaDefinition } from './types';
import { FINANCIAL_ANALYTICS_SCHEMA } from './templates/financial-analytics';
import { RESTAURANT_SCHEMA } from './templates/restaurant';

export const TEMPLATE_SCHEMAS: Record<string, W3CSchemaDefinition> = {
  'financial-analytics': FINANCIAL_ANALYTICS_SCHEMA,
  'restaurant': RESTAURANT_SCHEMA,
  // Phase 5 will add: hotel, ecommerce-retail, healthcare, supply-chain,
  // real-estate, education, professional-services, manufacturing
};

/**
 * Get the W3C schema definition for a template.
 * Returns null if the template doesn't have a schema definition yet.
 */
export function getTemplateSchema(templateId: string): W3CSchemaDefinition | null {
  return TEMPLATE_SCHEMAS[templateId] ?? null;
}

/**
 * List all template IDs that have schema definitions.
 */
export function listTemplateSchemas(): string[] {
  return Object.keys(TEMPLATE_SCHEMAS);
}

/**
 * Check if a template has a schema definition.
 */
export function hasTemplateSchema(templateId: string): boolean {
  return templateId in TEMPLATE_SCHEMAS;
}
