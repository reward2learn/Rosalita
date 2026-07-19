'use client';

import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { TasksView } from '@/components/tasks/tasks-view';

interface RoleTasksPageProps {
  params: Promise<{ role: string }>;
}

export default async function RoleTasksPage({ params }: RoleTasksPageProps) {
  const { role } = await params;
  const roleCode = role.toUpperCase();

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <TasksView forcedRole={roleCode} />
    </AuthGate>
  );
}
