/**
 * W3C Schema Type System — defines the types used across the
 * TOKENIZMYAPP orchestrator and all tenant applications.
 *
 * These types align with W3C XML Schema (XSD) data types and
 * schema.org structured data properties.
 */

// ── Field Types (aligned with XSD data types) ────────────

export type SchemaFieldType =
  | 'string'    // xs:string
  | 'text'      // xs:string (long text, maps to @db.Text)
  | 'integer'   // xs:integer
  | 'decimal'   // xs:decimal (monetary, rates)
  | 'boolean'   // xs:boolean
  | 'datetime'  // xs:dateTime
  | 'date'      // xs:date
  | 'time'      // xs:time
  | 'enum'      // xs:enumeration
  | 'json'      // xs:anyType (JSON/JSONB)
  | 'relation'; // foreign key reference

export type RelationType = 'one-to-many' | 'many-to-one' | 'many-to-many';

// ── Schema Field ─────────────────────────────────────────

export interface SchemaField {
  /** Field name in camelCase (ZenStack convention) */
  name: string;
  /** Field type aligned with XSD */
  type: SchemaFieldType;
  /** Whether the field is required (NOT NULL) */
  required?: boolean;
  /** Whether the field has a unique constraint */
  unique?: boolean;
  /** Default value */
  default?: unknown;
  /** Enum values if type is 'enum' */
  enumValues?: string[];
  /** Related model name if type is 'relation' */
  relationTo?: string;
  /** Relation cardinality */
  relationType?: RelationType;
  /** schema.org property mapping (e.g., "offers.price") */
  schemaOrgProperty?: string;
  /** Human-readable label for UI forms */
  label?: string;
  /** Grid width (MUI Grid2 size: 4=1/3, 6=1/2, 8=2/3, 12=full) */
  width?: 4 | 6 | 8 | 12;
}

// ── Schema Model ─────────────────────────────────────────

export interface SchemaModel {
  /** Model name in PascalCase (ZenStack convention) */
  name: string;
  /** Database table name in snake_case_plural (@@map) */
  tableName: string;
  /** Field definitions (excluding id, tenantSlug, createdAt, updatedAt which are auto-added) */
  fields: SchemaField[];
  /** Optional schema.org property mapping for the model */
  schemaOrgMapping?: Record<string, string>;
}

// ── Use Case ─────────────────────────────────────────────

export interface UseCaseDefinition {
  /** Use case ID in format UC-XXX-NN (e.g., UC-REST-01) */
  id: string;
  /** Human-readable title */
  title: string;
  /** Auth tier required */
  auth: 'public' | 'pin' | 'google';
  /** Route path (e.g., "/menu") */
  route: string;
  /** Block types used in this use case */
  blockTypes: string[];
  /** Models involved in this use case */
  models: string[];
}

// ── Page Definition ──────────────────────────────────────

export interface PageDefinition {
  /** URL slug (e.g., "menu") */
  slug: string;
  /** Page title */
  title: string;
  /** Auth tier required to view */
  authTier: 'public' | 'pin' | 'google';
  /** Block types rendered on this page */
  blockTypes: string[];
  /** Navigation label (falls back to title) */
  navLabel?: string;
}

// ── Block Definition ─────────────────────────────────────

export interface BlockDefinition {
  /** Block type identifier */
  type: string;
  /** Human-readable label */
  label: string;
  /** Associated model (for dynamic_form blocks) */
  model?: string;
  /** Configuration schema for the block */
  configSchema?: Record<string, unknown>;
}

// ── W3C Schema Definition (complete template) ───────────

export interface W3CSchemaDefinition {
  /** Template identifier (e.g., "restaurant") */
  templateId: string;
  /** Human-readable label */
  label: string;
  /** Description */
  description: string;
  /** schema.org type(s) for JSON-LD structured data */
  schemaOrgType: string | string[];
  /** W3C XSD standard alignment */
  xsdStandard: string;
  /** ZenStack models for this template */
  models: SchemaModel[];
  /** Use cases for this template */
  useCases: UseCaseDefinition[];
  /** Pages for this template */
  pages: PageDefinition[];
  /** Block definitions for this template */
  blocks: BlockDefinition[];
  /** Default brand colors */
  defaultColors: { primary: string; secondary: string };
}

// ── Helper: Auto-add base fields to a model ──────────────

/**
 * Every ZenStack model gets these base fields automatically.
 * When defining a schema model, do NOT include these in the fields array.
 */
export const BASE_MODEL_FIELDS: ReadonlyArray<{ name: string; zenstack: string }> = [
  { name: 'id',         zenstack: 'String   @id @default(cuid())' },
  { name: 'tenantSlug',  zenstack: 'String?  @map("tenant_slug")' },
  { name: 'createdAt',   zenstack: 'DateTime @default(now()) @map("created_at")' },
  { name: 'updatedAt',   zenstack: 'DateTime @updatedAt @map("updated_at")' },
];

/**
 * Returns the full field list for a model, including auto-added base fields.
 */
export function getFullFieldList(model: SchemaModel): Array<{ name: string; zenstack: string; isBase: boolean }> {
  const baseFields = BASE_MODEL_FIELDS.map(f => ({ ...f, isBase: true }));
  const customFields = model.fields.map(f => ({ name: f.name, zenstack: '', isBase: false }));
  return [...baseFields, ...customFields];
}
