import type { ComponentType } from 'react';
import type { BlockType } from '@/lib/page-catalog';
import { HeroBlock } from '@/components/blocks/hero-block';
import { DocMarkdownBlock } from '@/components/blocks/doc-markdown-block';
import { KpiCardsBlock } from '@/components/blocks/kpi-cards-block';
import { MetricGridBlock } from '@/components/blocks/metric-grid-block';
import { LeverAccordionBlock } from '@/components/blocks/lever-accordion-block';
import { ActionChecklistBlock } from '@/components/blocks/action-checklist-block';
import { ChartFinancialBlock } from '@/components/blocks/chart-financial-block';
import { PnlTableBlock } from '@/components/blocks/pnl-table-block';
import { ReportsRollupBlock } from '@/components/blocks/reports-rollup-block';
import { SheetViewerBlock } from '@/components/blocks/sheet-viewer-block';
import {
  OpsAdminTabsBlock,
  ZReportFormBlock,
  CostsFormBlock,
  CalendarImportBlock,
  ChatPanelBlock,
  ReviewBlocksBlock,
} from '@/components/blocks/stub-blocks';

export type BlockComponent = ComponentType<{ config: Record<string, unknown> }>;

export const BLOCK_REGISTRY: Record<BlockType, BlockComponent> = {
  hero: HeroBlock,
  doc_markdown: DocMarkdownBlock,
  kpi_cards: KpiCardsBlock,
  metric_grid: MetricGridBlock,
  lever_accordion: LeverAccordionBlock,
  action_checklist: ActionChecklistBlock,
  chart_financial: ChartFinancialBlock,
  pnl_table: PnlTableBlock,
  ops_admin_tabs: OpsAdminTabsBlock,
  z_report_form: ZReportFormBlock,
  costs_form: CostsFormBlock,
  calendar_import: CalendarImportBlock,
  chat_panel: ChatPanelBlock,
  review_blocks: ReviewBlocksBlock,
  reports_rollup: ReportsRollupBlock,
  sheet_viewer: SheetViewerBlock,
};

export function getBlockComponent(blockType: BlockType): BlockComponent {
  return BLOCK_REGISTRY[blockType];
}
