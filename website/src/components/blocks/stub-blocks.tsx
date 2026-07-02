'use client';

import { parseBlockConfig } from '@/lib/schemas/block-config';
import { OpsAdminTabs } from '@/components/ops-admin/ops-admin-tabs';
import { ChatPanel } from '@/components/chat/chat-panel';
import { ReviewBlocks } from '@/components/review/review-blocks';

export function OpsAdminTabsBlock({ config }: { config: Record<string, unknown> }) {
  parseBlockConfig('ops_admin_tabs', config);
  return <OpsAdminTabs />;
}

export function ZReportFormBlock({ config }: { config: Record<string, unknown> }) {
  parseBlockConfig('z_report_form', config);
  return <OpsAdminTabs initialTab="day-pos" />;
}

export function CostsFormBlock({ config }: { config: Record<string, unknown> }) {
  parseBlockConfig('costs_form', config);
  return <OpsAdminTabs initialTab="costs-payroll" />;
}

export function CalendarImportBlock({ config }: { config: Record<string, unknown> }) {
  parseBlockConfig('calendar_import', config);
  return <OpsAdminTabs initialTab="fill-missing" />;
}

export function ChatPanelBlock({ config }: { config: Record<string, unknown> }) {
  parseBlockConfig('chat_panel', config);
  return <ChatPanel />;
}

export function ReviewBlocksBlock({ config }: { config: Record<string, unknown> }) {
  parseBlockConfig('review_blocks', config);
  return <ReviewBlocks />;
}
