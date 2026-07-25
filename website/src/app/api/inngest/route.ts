import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { provisionTenant } from '@/domain/workflows/tenant-provisioning';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [provisionTenant],
});
