/**
 * Dynamic Form Block
 *
 * Renders a schema-driven form using the MUI pre-compiled component registry.
 * This block type is used by all template-specific pages that need
 * data entry forms (e.g., menu items, reservations, bookings).
 */

'use client';

import { Box, Typography, Paper } from '@mui/material';
import { DynamicForm } from '@/components/blocks/dynamic-form';
export { DynamicForm };
import type { SchemaModel } from '@/lib/schema/types';

export interface DynamicFormBlockConfig {
  model: SchemaModel;
  title?: string;
  description?: string;
  submitLabel?: string;
  onSubmit?: (values: Record<string, unknown>) => void;
}

export function DynamicFormBlock({ config }: { config: Record<string, unknown> }) {
  const blockConfig = config as unknown as DynamicFormBlockConfig;
  const model = blockConfig.model;
  
  if (!model) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography color="error">No schema model provided to DynamicFormBlock</Typography>
      </Paper>
    );
  }

  const handleSubmit = blockConfig.onSubmit ?? ((values: Record<string, unknown>) => {
    console.log('DynamicFormBlock submitted:', values);
    // TODO: POST to API route based on model.tableName
  });

  return (
    <Box sx={{ p: 2 }}>
      <DynamicForm
        model={model}
        onSubmit={handleSubmit}
        title={blockConfig.title ?? model.name}
        description={blockConfig.description}
        submitLabel={blockConfig.submitLabel ?? 'Save'}
      />
    </Box>
  );
}
