import { z } from 'zod';
import type { BlockType } from '@/lib/page-catalog';

const minTierSchema = z.enum(['public', 'pin', 'google']).optional();

export const heroConfigSchema = z.object({
  headline: z.string().optional(),
  subtitle: z.string().optional(),
  badge: z.string().optional(),
  minTier: minTierSchema,
});

export const metricGridConfigSchema = z.object({
  scenarios: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        target: z.string().optional(),
      }),
    )
    .optional(),
  minTier: minTierSchema,
});

export const chartFinancialConfigSchema = z.object({
  scenario: z
    .enum(['conservative', 'realistic', 'aspirational', 'actual'])
    .optional(),
  height: z.number().optional(),
  variant: z.enum(['dashboard', 'ops']).optional(),
  minTier: minTierSchema,
});

export const leverAccordionConfigSchema = z.object({
  title: z.string().optional(),
  minTier: minTierSchema,
});

export const actionChecklistConfigSchema = z.object({
  priority: z.enum(['P0', 'P1', 'P2']).optional(),
  minTier: minTierSchema,
});

export const docMarkdownConfigSchema = z.object({
  source: z.string(),
  title: z.string().optional(),
  minTier: minTierSchema,
});

export const kpiCardsConfigSchema = z.object({
  period: z.string().optional(),
  variant: z.enum(['dashboard', 'ops']).optional(),
  minTier: minTierSchema,
});

export const pnlTableConfigSchema = z.object({
  period: z.string().optional(),
  minTier: minTierSchema,
});

export const opsAdminTabsConfigSchema = z.object({});
export const zReportFormConfigSchema = z.object({});
export const costsFormConfigSchema = z.object({});
export const calendarImportConfigSchema = z.object({});
export const chatPanelConfigSchema = z.object({});
export const reviewBlocksConfigSchema = z.object({});
export const reportsRollupConfigSchema = z.object({
  minTier: minTierSchema,
});

export const sheetViewerConfigSchema = z.object({
  sheet: z.string().optional(),
  columns: z.array(z.string()).optional(),
  title: z.string().optional(),
  minTier: minTierSchema,
});

export const blockConfigSchemas = {
  hero: heroConfigSchema,
  metric_grid: metricGridConfigSchema,
  chart_financial: chartFinancialConfigSchema,
  lever_accordion: leverAccordionConfigSchema,
  action_checklist: actionChecklistConfigSchema,
  doc_markdown: docMarkdownConfigSchema,
  kpi_cards: kpiCardsConfigSchema,
  pnl_table: pnlTableConfigSchema,
  ops_admin_tabs: opsAdminTabsConfigSchema,
  z_report_form: zReportFormConfigSchema,
  costs_form: costsFormConfigSchema,
  calendar_import: calendarImportConfigSchema,
  chat_panel: chatPanelConfigSchema,
  review_blocks: reviewBlocksConfigSchema,
  reports_rollup: reportsRollupConfigSchema,
  sheet_viewer: sheetViewerConfigSchema,
} as const satisfies Record<BlockType, z.ZodType>;

export type BlockConfigMap = {
  [K in BlockType]: z.infer<(typeof blockConfigSchemas)[K]>;
};

export function parseBlockConfig<T extends BlockType>(
  blockType: T,
  config: Record<string, unknown>,
): BlockConfigMap[T] {
  return blockConfigSchemas[blockType].parse(config) as BlockConfigMap[T];
}
