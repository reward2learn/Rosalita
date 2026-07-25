import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'tokenizmyapp',
  name: 'TOKENIZMYAPP Orchestrator',
});

// Event types
export interface TenantEvents {
  'tenant.created': {
    data: {
      slug: string;
      displayName: string;
      templateId: string;
      prompt?: string;
      primaryColor: string;
      secondaryColor: string;
      metadata: Record<string, unknown>;
    };
  };
  'tenant.provisioned': {
    data: {
      slug: string;
      dbUrl?: string;
      branchId?: string;
    };
  };
  'tenant.schema-generated': {
    data: {
      slug: string;
      schema: unknown;
      zmodel: string;
    };
  };
  'tenant.deployed': {
    data: {
      slug: string;
      appUrl: string;
      projectId: string;
    };
  };
  'tenant.failed': {
    data: {
      slug: string;
      error: string;
      step: string;
    };
  };
}
