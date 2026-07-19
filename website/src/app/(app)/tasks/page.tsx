'use client';

import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { TasksView } from '@/components/tasks/tasks-view';

export default function TasksPage() {
  return (
    <AuthGate requiredTier="google" fallback={<SignInPanelGate requiredTier="google" />}>
      <TasksView />
    </AuthGate>
  );
}
