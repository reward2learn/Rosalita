import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import { requireWriteAuth, requireSession, requireRead, requireWrite } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { ensureTaskTables, seedTaskTracking } from '@/domain/seed/seed-runner';
import type { SessionClaims } from '@/lib/auth/jwt';

export const maxDuration = 30;

/**
 * Memoized bootstrap so the heavy DDL + seed only runs once per server instance,
 * not on every request. Running 20+ raw DDL statements on every GET was causing
 * 504 timeouts on cold Neon connections.
 */
let tablesReady: Promise<void> | null = null;
let seedReady: Promise<void> | null = null;

async function ensureBootstrapped(db: Awaited<ReturnType<typeof createClient>>): Promise<void> {
  // Table creation must complete before we query — but only once per instance.
  if (!tablesReady) {
    tablesReady = ensureTaskTables(db).catch((err) => {
      tablesReady = null;
      throw err;
    });
  }
  await tablesReady;

  // Seed roles + tasks (and backfill any missing descriptions) exactly once per
  // instance. Awaited so the first GET returns fully-populated tasks instead of
  // leaving descriptions null when the previous fire-and-forget job failed.
  if (!seedReady) {
    seedReady = seedTaskTracking(db).catch((err) => {
      seedReady = null;
      console.error('[tasks] seed failed:', err);
      throw err;
    });
  }
  await seedReady;
}

export interface TaskAssignmentView {
  roleCode: string;
  roleName: string;
  assigned: boolean;
}

export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  priority: 'P0' | 'P1' | 'P2';
  status: 'pending' | 'in_progress' | 'submitted' | 'completed';
  dueDate: string | null;
  sortOrder: number;
  assignments: TaskAssignmentView[];
}

export interface TasksResponse {
  tasks: TaskView[];
  /** The role code the current viewer is scoped to (null = platform-admin sees all). */
  viewerRole: string | null;
  isPlatformAdmin: boolean;
}

function toTaskView(task: {
  id: string;
  title: string;
  description: string | null;
  priority: 'P0' | 'P1' | 'P2';
  status: 'pending' | 'in_progress' | 'submitted' | 'completed';
  dueDate: Date | null;
  sortOrder: number;
  assignments: {
    assigned: boolean;
    role: { code: string; name: string };
  }[];
}): TaskView {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    sortOrder: task.sortOrder,
    assignments: task.assignments.map((a) => ({
      roleCode: a.role.code,
      roleName: a.role.name,
      assigned: a.assigned,
    })),
  };
}

/** Resolve the viewer's role from the session's roleCode (preferred) or email/name. */
async function resolveViewerRole(
  db: Awaited<ReturnType<typeof createClient>>,
  session: SessionClaims,
) {
  if (session.roleCode) {
    const byCode = await db.role.findFirst({ where: { code: session.roleCode } });
    if (byCode) return byCode;
  }
  const email = session.email?.toLowerCase();
  const name = session.name?.toLowerCase();
  const roles = await db.role.findMany();
  const match = roles.find((r) => {
    if (email && r.email && r.email.toLowerCase() === email) return true;
    if (name && r.name.toLowerCase().includes(name)) return true;
    return false;
  });
  return match ?? null;
}

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await requireSession(request);
  if (!guard.ok) return guard.response;

  const groupGuard = await requireRead('tasks', request);
  if (!groupGuard.ok) return groupGuard.response;

  const { searchParams } = new URL(request.url);
  const requestedRole = searchParams.get('role')?.trim() || null;

  let db;
  try {
    db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
    await ensureBootstrapped(db);
  } catch {
    return jsonError('Database unavailable', 503);
  }

  const viewerRole = await resolveViewerRole(db, guard.session);
  const isPlatformAdmin =
    guard.session.tier === 'pin' || viewerRole?.isPlatformAdmin === true;

  // Determine which role scope to return.
  let scopeRoleCode: string | null = null;
  if (requestedRole) {
    if (!isPlatformAdmin) {
      return jsonError('Only platform admins can view other roles', 403);
    }
    scopeRoleCode = requestedRole;
  } else if (viewerRole && !isPlatformAdmin) {
    scopeRoleCode = viewerRole.code;
  }

  const tasks = await db.task.findMany({
    orderBy: [{ sortOrder: 'asc' }],
    include: {
      assignments: {
        include: { role: { select: { code: true, name: true } } },
      },
    },
  });

  const filtered = scopeRoleCode
    ? tasks.filter((t) =>
        t.assignments.some(
          (a) => a.assigned && a.role.code.toLowerCase() === scopeRoleCode!.toLowerCase(),
        ),
      )
    : tasks;

  const payload: TasksResponse = {
    tasks: filtered.map(toTaskView),
    viewerRole: viewerRole?.code ?? null,
    isPlatformAdmin,
  };
  return jsonOk(payload);
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const groupGuard = await requireWrite('tasks', request);
  if (!groupGuard.ok) return groupGuard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { title, description, priority, dueDate, ownerCodes } = (body ?? {}) as {
    title?: string;
    description?: string;
    priority?: 'P0' | 'P1' | 'P2';
    dueDate?: string;
    ownerCodes?: string[];
  };

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return jsonError('title is required', 400);
  }

  let db;
  try {
    db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
    await ensureTaskTables(db);
  } catch {
    return jsonError('Database unavailable', 503);
  }

  const task = await db.task.create({
    data: {
      title: title.trim(),
      description: description ?? null,
      priority: priority ?? 'P0',
      status: 'pending',
      dueDate: dueDate ? new Date(dueDate) : null,
      assignments: {
        create:
          ownerCodes && ownerCodes.length > 0
            ? (
                await db.role.findMany({
                  where: { code: { in: ownerCodes.map((c) => c.toUpperCase()) } },
                })
              ).map((r) => ({ roleId: r.id, assigned: true }))
            : [],
      },
    },
    include: {
      assignments: { include: { role: { select: { code: true, name: true } } } },
    },
  });

  return jsonOk(toTaskView(task), { status: 201 });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const groupGuard = await requireWrite('tasks', request);
  if (!groupGuard.ok) return groupGuard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { id, status, dueDate } = (body ?? {}) as {
    id?: string;
    status?: string;
    dueDate?: string | null;
  };
  if (!id || typeof id !== 'string') {
    return jsonError('id is required', 400);
  }
  if (status !== undefined && !['pending', 'in_progress', 'submitted', 'completed'].includes(status)) {
    return jsonError('status must be pending | in_progress | completed', 400);
  }
  if (dueDate !== undefined && dueDate !== null && Number.isNaN(Date.parse(dueDate))) {
    return jsonError('dueDate must be a valid ISO date or null', 400);
  }

  let db;
  try {
    db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
    await ensureTaskTables(db);
  } catch {
    return jsonError('Database unavailable', 503);
  }

  const existing = await db.task.findUnique({
    where: { id },
    include: { assignments: { include: { role: true } } },
  });
  if (!existing) {
    return jsonError('Task not found', 404);
  }

  // Non-admin role owners may only update tasks assigned to them.
  const viewerRole = await resolveViewerRole(db, guard.session);
  const isPlatformAdmin =
    guard.session.tier === 'pin' || viewerRole?.isPlatformAdmin === true;
  if (!isPlatformAdmin && viewerRole) {
    const owns = existing.assignments.some(
      (a) => a.assigned && a.role.code === viewerRole.code,
    );
    if (!owns) {
      return jsonError('You can only update tasks assigned to your role', 403);
    }
  }

  // Only platform admins may amend due dates; everyone else may only advance status.
  if (dueDate !== undefined && !isPlatformAdmin) {
    return jsonError('Only platform admins can change due dates', 403);
  }

  const updateData: {
    status?: 'pending' | 'in_progress' | 'submitted' | 'completed';
    dueDate?: Date | null;
  } = {};
  if (status !== undefined) {
    updateData.status = status as 'pending' | 'in_progress' | 'submitted' | 'completed';
  }
  if (dueDate !== undefined) {
    updateData.dueDate = dueDate ? new Date(dueDate) : null;
  }

  const updated = await db.task.update({
    where: { id },
    data: updateData,
    include: {
      assignments: { include: { role: { select: { code: true, name: true } } } },
    },
  });

  return jsonOk(toTaskView(updated));
}
