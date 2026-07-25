/**
 * Zod schema for AI-generated W3C schema definitions.
 *
 * This schema is used with the Vercel AI SDK's `generateObject()` function
 * to ensure the AI returns a structurally valid schema definition.
 */

import { z } from 'zod';

export const schemaFieldZod = z.object({
  name: z.string().describe('Field name in camelCase'),
  type: z.enum([
    'string', 'text', 'integer', 'decimal', 'boolean',
    'datetime', 'date', 'time', 'enum', 'json', 'relation',
  ]).describe('Field type aligned with XSD data types'),
  required: z.boolean().default(false),
  unique: z.boolean().optional(),
  default: z.unknown().optional(),
  enumValues: z.array(z.string()).optional(),
  relationTo: z.string().optional(),
  relationType: z.enum(['one-to-many', 'many-to-one', 'many-to-many']).optional(),
  schemaOrgProperty: z.string().optional().describe('schema.org property mapping (e.g., "offers.price")'),
  label: z.string().optional().describe('Human-readable label for UI forms'),
  width: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(12)]).optional(),
});

export const schemaModelZod = z.object({
  name: z.string().describe('Model name in PascalCase'),
  tableName: z.string().describe('Database table name in snake_case_plural'),
  fields: z.array(schemaFieldZod),
  schemaOrgMapping: z.record(z.string()).optional(),
});

export const useCaseZod = z.object({
  id: z.string().describe('Use case ID in format UC-XXX-NN (e.g., UC-REST-01)'),
  title: z.string(),
  auth: z.enum(['public', 'pin', 'google']),
  route: z.string().describe('Route path (e.g., "/menu")'),
  blockTypes: z.array(z.string()),
  models: z.array(z.string()),
});

export const pageZod = z.object({
  slug: z.string(),
  title: z.string(),
  authTier: z.enum(['public', 'pin', 'google']),
  blockTypes: z.array(z.string()),
  navLabel: z.string().optional(),
});

export const schemaGenerationZodSchema = z.object({
  templateId: z.string(),
  schemaOrgType: z.string(),
  models: z.array(schemaModelZod),
  useCases: z.array(useCaseZod),
  pages: z.array(pageZod),
});

export type SchemaGenerationResult = z.infer<typeof schemaGenerationZodSchema>;
export type GeneratedModel = z.infer<typeof schemaModelZod>;
export type GeneratedField = z.infer<typeof schemaFieldZod>;
