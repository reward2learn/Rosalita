/**
 * Template Schema Registry — maps template IDs to their W3C schema definitions.
 *
 * This registry is the single source of truth for template-specific
 * schema models, use cases, pages, and blocks.
 */

import type { W3CSchemaDefinition } from './types';
import { FINANCIAL_ANALYTICS_SCHEMA } from './templates/financial-analytics';
import { RESTAURANT_SCHEMA } from './templates/restaurant';
import { HOTEL_SCHEMA } from './templates/hotel';
import { ECOMMERCE_RETAIL_SCHEMA } from './templates/ecommerce-retail';
import { HEALTHCARE_SCHEMA } from './templates/healthcare';
import { SUPPLY_CHAIN_SCHEMA } from './templates/supply-chain';
import { REAL_ESTATE_SCHEMA } from './templates/real-estate';
import { EDUCATION_SCHEMA } from './templates/education';
import { PROFESSIONAL_SERVICES_SCHEMA } from './templates/professional-services';
import { MANUFACTURING_SCHEMA } from './templates/manufacturing';

export const TEMPLATE_SCHEMAS: Record<string, W3CSchemaDefinition> = {
  'financial-analytics': FINANCIAL_ANALYTICS_SCHEMA,
  'restaurant': RESTAURANT_SCHEMA,
  'hotel': HOTEL_SCHEMA,
  'ecommerce-retail': ECOMMERCE_RETAIL_SCHEMA,
  'healthcare': HEALTHCARE_SCHEMA,
  'supply-chain': SUPPLY_CHAIN_SCHEMA,
  'real-estate': REAL_ESTATE_SCHEMA,
  'education': EDUCATION_SCHEMA,
  'professional-services': PROFESSIONAL_SERVICES_SCHEMA,
  'manufacturing': MANUFACTURING_SCHEMA,
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
