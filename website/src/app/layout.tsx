import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../../style.css';
import { AppProviders } from '@/components/providers/app-providers';
import { ThemeRegistry } from '@/theme/theme-registry';
import { AppShell } from '@/components/layout/app-shell';

export const metadata: Metadata = {
  title: 'Red Ruby Bali',
  description: 'Red Ruby Bali business operations dashboard',
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
