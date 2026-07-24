import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../../style.css';
import { AppProviders } from '@/components/providers/app-providers';
import { ThemeRegistry } from '@/theme/theme-registry';
import { AppShell } from '@/components/layout/app-shell';
import { getTenantConfig } from '@/lib/config/tenant';

const tenant = getTenantConfig();

export const metadata: Metadata = {
  title: tenant.appTitle,
  description: tenant.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>
          <ThemeRegistry>
            <AppShell>{children}</AppShell>
          </ThemeRegistry>
        </AppProviders>
      </body>
    </html>
  );
}
