/**
 * AI Schema Generator
 *
 * Uses the Vercel AI SDK's `generateObject()` to generate a complete
 * W3C-aligned ZenStack schema definition from a natural language prompt.
 *
 * The AI receives:
 *   - The user's business description (natural language)
 *   - The template ID (e.g., "restaurant", "hotel")
 *   - The W3C XSD standard for that sector
 *
 * The AI returns:
 *   - A structured schema definition (validated by Zod)
 *   - Models with schema.org property mappings
 *   - Use cases with auth tiers and routes
 *   - Pages with block types
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { schemaGenerationZodSchema, type SchemaGenerationResult } from './schema-generation-schema';

// ── W3C XSD Standards per template ──────────────────────

const W3C_STANDARDS: Record<string, string> = {
  'financial-analytics': 'FpML (Financial Products Markup Language) for derivatives and FIXML for real-time financial information exchange',
  'restaurant': 'UBL (Universal Business Language) for invoices/orders and GS1 for product/SKU data',
  'hotel': 'OTA (OpenTravel Alliance) for room bookings and availability',
  'ecommerce-retail': 'UBL for electronic orders and Inventory Feeds for SKU/pricing constraints',
  'healthcare': 'HL7/CDA for electronic health records and claims processing validation',
  'supply-chain': 'UBL for shipping notices and B2B logistics manifest documents',
  'real-estate': 'RETS (Real Estate Transaction Standard) for property listings',
  'education': 'IMS Global (LTI, QTI) for learning tools interoperability and assessment',
  'professional-services': 'UBL for billing/invoices and project management data',
  'manufacturing': 'B2MML (Business To Manufacturing Markup Language) for production data',
};

// ── schema.org types per template ────────────────────────

const SCHEMA_ORG_TYPES: Record<string, string> = {
  'financial-analytics': 'FinancialService',
  'restaurant': 'Restaurant',
  'hotel': 'Hotel',
  'ecommerce-retail': 'Store',
  'healthcare': 'MedicalOrganization',
  'supply-chain': 'DeliveryEvent',
  'real-estate': 'RealEstateAgent',
  'education': 'EducationalOrganization',
  'professional-services': 'ProfessionalService',
  'manufacturing': 'Manufacturer',
};

// ── Available block types ────────────────────────────────

const AVAILABLE_BLOCKS = [
  'hero', 'kpi_cards', 'metric_grid', 'chart_financial', 'lever_accordion',
  'action_checklist', 'doc_markdown', 'pnl_table', 'ops_admin_tabs',
  'z_report_form', 'costs_form', 'calendar_import', 'chat_panel',
  'review_blocks', 'reports_rollup', 'sheet_viewer', 'dynamic_form',
];

// ── System prompt ────────────────────────────────────────

function buildSystemPrompt(templateId: string): string {
  const w3cStandard = W3C_STANDARDS[templateId] ?? 'schema.org';
  const schemaOrgType = SCHEMA_ORG_TYPES[templateId] ?? 'LocalBusiness';

  return `You are a W3C schema architect and ZenStack ORM expert.
Generate a complete ZenStack-compatible schema definition for a ${templateId} business.

## Rules

1. **Schema.org mapping**: Map fields to schema.org properties where applicable (use schemaOrgProperty)
2. **W3C XSD standard**: Use ${w3cStandard} for field types and validation constraints
3. **Base fields auto-added**: Every model automatically gets id, tenantSlug, createdAt, updatedAt — do NOT include these in the fields array
4. **Monetary values**: Use decimal type with schemaOrgProperty "offers.price" for price/cost/revenue fields
5. **Status fields**: Use enum type with meaningful enumValues (e.g., pending, confirmed, cancelled)
6. **Model count**: Generate 3-7 models depending on business complexity
7. **Use cases**: Generate UC-XXX-NN format with appropriate auth tiers (public for customer-facing, pin for ops, google for exec)
8. **Pages**: Generate pages with blockTypes from: ${AVAILABLE_BLOCKS.join(', ')}
9. **Table names**: snake_case plural (e.g., "menu_items", "table_reservations")
10. **Field names**: camelCase (e.g., "customerName", "reservationDate")
11. **schema.org type**: The primary schema.org type for this template is "${schemaOrgType}"
12. **dynamic_form block**: Use "dynamic_form" block type for pages that display or edit model data
13. **Width**: Set width to 6 for half-width fields, 12 for full-width, 4 for third-width

## Output

Return a complete schema definition with models, use cases, and pages.`;
}

// ── Main generation function ────────────────────────────

export async function generateSchemaFromPrompt(
  userPrompt: string,
  templateId: string,
): Promise<SchemaGenerationResult> {
  const systemPrompt = buildSystemPrompt(templateId);

  const { object } = await generateObject({
    model: openai('gpt-5.5'),
    schema: schemaGenerationZodSchema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.1, // Low temperature for consistent, structured output
  });

  return object;
}

// ── Mock generation (for testing without AI calls) ──────

export function mockGenerateSchema(templateId: string): SchemaGenerationResult {
  const schemaOrgType = SCHEMA_ORG_TYPES[templateId] ?? 'LocalBusiness';
  const w3cStandard = W3C_STANDARDS[templateId] ?? 'schema.org';

  // Return a minimal restaurant schema for testing
  return {
    templateId,
    schemaOrgType,
    models: [
      {
        name: 'MenuItem',
        tableName: 'menu_items',
        fields: [
          { name: 'name', type: 'string', required: true, unique: true, schemaOrgProperty: 'name', label: 'Item Name', width: 12 },
          { name: 'description', type: 'text', required: false, schemaOrgProperty: 'description', label: 'Description', width: 12 },
          { name: 'price', type: 'decimal', required: true, schemaOrgProperty: 'offers.price', label: 'Price (IDR)', width: 6 },
          { name: 'category', type: 'enum', required: true, enumValues: ['appetizer', 'main', 'dessert', 'beverage'], label: 'Category', width: 6 },
          { name: 'isAvailable', type: 'boolean', required: false, default: true, schemaOrgProperty: 'availability', label: 'Available', width: 6 },
        ],
      },
    ],
    useCases: [
      { id: 'UC-REST-01', title: 'View menu', auth: 'public', route: '/menu', blockTypes: ['dynamic_form'], models: ['MenuItem'] },
    ],
    pages: [
      { slug: 'menu', title: 'Menu', authTier: 'public', blockTypes: ['dynamic_form'], navLabel: 'Menu' },
    ],
  };
}
