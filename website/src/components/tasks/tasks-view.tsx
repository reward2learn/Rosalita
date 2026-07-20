'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  useListTasksQuery,
  useUpdateTaskStatusMutation,
  type TaskStatusValue,
} from '@/store/apis/tasks-api';
import { useAppSelector } from '@/store/hooks';
import type { TaskView } from '@/app/api/tasks/route';

const STATUS_LABEL: Record<TaskStatusValue, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  submitted: 'Submitted',
  completed: 'Completed',
};

const STATUS_COLOR: Record<TaskStatusValue, 'default' | 'warning' | 'info' | 'success'> = {
  pending: 'default',
  in_progress: 'warning',
  submitted: 'info',
  completed: 'success',
};

/** All statuses in the order they appear in the admin status menu. */
const ALL_STATUSES: TaskStatusValue[] = ['pending', 'in_progress', 'submitted', 'completed'];

const PRIORITY_COLOR: Record<string, 'error' | 'warning' | 'info'> = {
  P0: 'error',
  P1: 'warning',
  P2: 'info',
};

function isOverdue(task: TaskView): boolean {
  if (!task.dueDate || task.status === 'completed') return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

/** Format an ISO date as DD/MM/YYYY (business standard for this project). */
function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function nextStatus(status: TaskStatusValue): TaskStatusValue {
  if (status === 'pending') return 'in_progress';
  if (status === 'in_progress') return 'completed';
  return 'pending';
}

export function TasksView({ forcedRole }: { forcedRole?: string | null } = {}) {
  const router = useRouter();
  const { tier } = useAppSelector((s) => s.auth);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskView | null>(null);
  const [statusMenu, setStatusMenu] = useState<{ id: string; el: HTMLElement } | null>(null);

  // When a dedicated role route is used, lock the view to that role.
  const lockedRole = forcedRole ?? null;
  const queryRole = lockedRole ?? selectedRole;

  const { data, isLoading, isError, refetch } = useListTasksQuery(
    queryRole ? { role: queryRole } : undefined,
  );
  const [updateStatus, { isLoading: isUpdating }] = useUpdateTaskStatusMutation();

  const tasks = data?.success ? data.data.tasks : [];
  const isPlatformAdmin = data?.success ? data.data.isPlatformAdmin : tier === 'pin';
  const viewerRole = data?.success ? data.data.viewerRole : null;

  // For non-admins, the API already scopes to their role; for admins, allow role switching.
  const effectiveRole = lockedRole ?? (isPlatformAdmin ? selectedRole : viewerRole);

  const overdueCount = useMemo(
    () => tasks.filter((t) => isOverdue(t)).length,
    [tasks],
  );
  const pendingCount = useMemo(
    () => tasks.filter((t) => t.status !== 'completed').length,
    [tasks],
  );

  const handleToggle = async (task: TaskView) => {
    await updateStatus({ id: task.id, status: nextStatus(task.status) }).unwrap();
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        Failed to load tasks.
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', px: 3, py: 3 }}>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Exit-Viability Tasks
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {effectiveRole
              ? `Checklist for ${effectiveRole}`
              : 'All tracked actions from the MVP Business Review'}
          </Typography>
        </Box>
        {isPlatformAdmin && !lockedRole ? (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="role-select-label">View role</InputLabel>
            <Select
              labelId="role-select-label"
              label="View role"
              value={selectedRole ?? ''}
              onChange={(e) => setSelectedRole(e.target.value || null)}
            >
              <MenuItem value="">All roles (admin)</MenuItem>
              {['Graham', 'Ama', 'Made', 'Lukas', 'James'].map((code) => (
                <MenuItem key={code} value={code}>
                  {code}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}
      </Stack>

      {overdueCount > 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {overdueCount} task{overdueCount > 1 ? 's are' : ' is'} past due date.
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <Chip label={`${pendingCount} open`} color="primary" variant="outlined" />
        <Chip label={`${tasks.length - pendingCount} done`} color="success" variant="outlined" />
        {effectiveRole ? (
          <Chip label={`Role: ${effectiveRole}`} size="small" />
        ) : null}
      </Stack>

      {tasks.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No tasks assigned{selectedRole ? ` to ${selectedRole}` : ''} yet. Run a source reseed to populate them.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {tasks.map((task) => (
            <Paper
              key={task.id}
              variant="outlined"
              onClick={() => setSelectedTask(task)}
              sx={{
                p: 2,
                cursor: 'pointer',
                borderLeft: `4px solid`,
                borderLeftColor: isOverdue(task)
                  ? 'error.main'
                  : task.status === 'completed'
                    ? 'success.main'
                    : 'divider',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
              }}
            >
              <Stack direction="row" sx={{ alignItems: 'flex-start' }} spacing={2}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 600,
                      textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                    }}
                  >
                    {task.title}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }} useFlexGap>
                    <Chip label={task.priority} size="small" color={PRIORITY_COLOR[task.priority]} />
                    <Chip
                      label={STATUS_LABEL[task.status]}
                      size="small"
                      color={STATUS_COLOR[task.status]}
                      variant="outlined"
                    />
                    {task.dueDate ? (
                      <Chip
                        label={`Due ${formatDueDate(task.dueDate)}`}
                        size="small"
                        color={isOverdue(task) ? 'error' : 'default'}
                        variant="outlined"
                      />
                    ) : null}
                    {task.assignments.map((a) => (
                      <Chip key={a.roleCode} label={a.roleCode} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </Box>
                {isPlatformAdmin ? (
                  <>
                    <IconButton
                      size="small"
                      aria-label="Set status"
                      disabled={isUpdating}
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusMenu({ id: task.id, el: e.currentTarget });
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                    <Menu
                      anchorEl={statusMenu?.el}
                      open={statusMenu?.id === task.id}
                      onClose={() => setStatusMenu(null)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {ALL_STATUSES.map((s) => (
                        <MenuItem
                          key={s}
                          selected={task.status === s}
                          disabled={isUpdating}
                          onClick={() => {
                            setStatusMenu(null);
                            void updateStatus({ id: task.id, status: s });
                          }}
                        >
                          {STATUS_LABEL[s]}
                        </MenuItem>
                      ))}
                    </Menu>
                  </>
                ) : (
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={isUpdating}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggle(task);
                    }}
                  >
                    {task.status === 'completed' ? 'Reopen' : 'Continue'}
                  </Button>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      {isPlatformAdmin ? (
        <AdminDashboard
          tasks={tasks}
          onRefresh={refetch}
          onSetStatus={(id, status) => void updateStatus({ id, status })}
          isUpdating={isUpdating}
        />
      ) : null}

      <TaskDetailModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onAskAi={(task) => {
          const prompt = buildAskAiPrompt(task);
          router.push(`/ops-chat?prompt=${encodeURIComponent(prompt)}`);
        }}
        onAdvance={(task) => void handleToggle(task)}
        onUpdateDueDate={(task, dueDate) => void updateStatus({ id: task.id, dueDate })}
        isUpdating={isUpdating}
        isPlatformAdmin={isPlatformAdmin}
      />
    </Box>
  );
}

function buildAskAiPrompt(task: TaskView): string {
  const owners = task.assignments.map((a) => a.roleCode).join(' + ') || 'the team';
  return `Explain the exit-viability task "${task.title}" assigned to ${owners} (priority ${task.priority}). What is the goal, why it matters for the Red Ruby sale, and the concrete steps to complete it? Reference the July 2026 MVP Business Review context.`;
}

function TaskDetailModal({
  task,
  onClose,
  onAskAi,
  onAdvance,
  onUpdateDueDate,
  isUpdating,
  isPlatformAdmin,
}: {
  task: TaskView | null;
  onClose: () => void;
  onAskAi: (task: TaskView) => void;
  onAdvance: (task: TaskView) => void;
  onUpdateDueDate: (task: TaskView, dueDate: string | null) => void;
  isUpdating: boolean;
  isPlatformAdmin: boolean;
}) {
  const [dueDateInput, setDueDateInput] = useState<string>('');
  const [dueDateDirty, setDueDateDirty] = useState(false);

  // Sync the editable date field whenever the selected task changes.
  useEffect(() => {
    if (task?.dueDate) {
      const d = new Date(task.dueDate);
      setDueDateInput(d.toISOString().slice(0, 10));
    } else {
      setDueDateInput('');
    }
    setDueDateDirty(false);
  }, [task]);

  const steps = useMemo(() => {
    if (!task?.description) return [];
    const match = task.description.match(/Steps:\n([\s\S]+)$/);
    if (!match) return [];
    return match[1]
      .split('\n')
      .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
  }, [task]);

  const summary = task?.description?.split('\n\nSteps:')[0] ?? null;

  return (
    <Dialog open={Boolean(task)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {task?.title}
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }} useFlexGap>
          {task ? (
            <>
              <Chip label={task.priority} size="small" color={PRIORITY_COLOR[task.priority]} />
              <Chip label={STATUS_LABEL[task.status]} size="small" color={STATUS_COLOR[task.status]} variant="outlined" />
              {task.dueDate ? (
                <Chip label={`Due ${formatDueDate(task.dueDate)}`} size="small" variant="outlined" />
              ) : null}
              {task.assignments.map((a) => (
                <Chip key={a.roleCode} label={a.roleCode} size="small" variant="outlined" />
              ))}
            </>
          ) : null}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {summary ? (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
            {summary}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No detailed instructions available for this task yet.
          </Typography>
        )}
        {steps.length > 0 ? (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Step-by-step instructions
            </Typography>
            <List dense disablePadding>
              {steps.map((step, i) => (
                <ListItem key={i} sx={{ px: 0, alignItems: 'flex-start' }}>
                  <ListItemText
                    primary={
                      <Typography variant="body2" component="span">
                        {`${i + 1}. ${step}`}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </>
        ) : null}

        {isPlatformAdmin && task ? (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Due date (platform admin)
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <TextField
                type="date"
                size="small"
                value={dueDateInput}
                onChange={(e) => {
                  setDueDateInput(e.target.value);
                  setDueDateDirty(true);
                }}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{
                  flex: 1,
                  '& input[type="date"]::-webkit-calendar-picker-indicator': {
                    filter: 'invert(1)',
                  },
                }}
              />
              <Button
                variant="outlined"
                size="small"
                disabled={!dueDateDirty || isUpdating}
                onClick={() => {
                  void onUpdateDueDate(task, dueDateInput || null);
                  setDueDateDirty(false);
                }}
              >
                Save
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Format DD/MM/YYYY. The whole exit process should complete by 03/08/2026.
            </Typography>
          </>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
        {task ? (
          <Button
            variant="outlined"
            disabled={isUpdating}
            onClick={() => onAdvance(task)}
          >
            {task.status === 'completed' ? 'Reopen' : 'Continue'}
          </Button>
        ) : null}
        <Button
          variant="contained"
          startIcon={<SmartToyIcon />}
          disabled={!task}
          onClick={() => task && onAskAi(task)}
        >
          Ask AI
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AdminDashboard({
  tasks,
  onRefresh,
  onSetStatus,
  isUpdating,
}: {
  tasks: TaskView[];
  onRefresh: () => void;
  onSetStatus: (id: string, status: TaskStatusValue) => void;
  isUpdating: boolean;
}) {
  const roles = ['Graham', 'Ama', 'Made', 'Lukas', 'James'];
  const [rowMenu, setRowMenu] = useState<{ id: string; el: HTMLElement } | null>(null);

  const matrix = useMemo(() => {
    return roles.map((role) => {
      const roleTasks = tasks.filter((t) =>
        t.assignments.some((a) => a.assigned && a.roleCode === role),
      );
      const completed = roleTasks.filter((t) => t.status === 'completed').length;
      const inProgress = roleTasks.filter((t) => t.status === 'in_progress').length;
      const pending = roleTasks.filter((t) => t.status === 'pending').length;
      const overdue = roleTasks.filter((t) => isOverdue(t)).length;
      return { role, total: roleTasks.length, completed, inProgress, pending, overdue };
    });
  }, [tasks]);

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => a.sortOrder - b.sortOrder),
    [tasks],
  );

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 4 }}>
      <Stack direction="row" sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Platform-admin dashboard — all roles
        </Typography>
        <Button size="small" variant="text" onClick={onRefresh}>
          Refresh
        </Button>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Role</TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell align="right">Pending</TableCell>
            <TableCell align="right">In progress</TableCell>
            <TableCell align="right">Completed</TableCell>
            <TableCell align="right">Overdue</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {matrix.map((row) => (
            <TableRow key={row.role}>
              <TableCell sx={{ fontWeight: 600 }}>{row.role}</TableCell>
              <TableCell align="right">{row.total}</TableCell>
              <TableCell align="right">{row.pending}</TableCell>
              <TableCell align="right">{row.inProgress}</TableCell>
              <TableCell align="right">{row.completed}</TableCell>
              <TableCell align="right">
                {row.overdue > 0 ? (
                  <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}>
                    {row.overdue}
                  </Box>
                ) : (
                  row.overdue
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        All tasks — set status
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Task</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Due</TableCell>
            <TableCell>Owners</TableCell>
            <TableCell align="right">Set status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedTasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell sx={{ maxWidth: 320 }}>{task.title}</TableCell>
              <TableCell>
                <Chip label={task.priority} size="small" color={PRIORITY_COLOR[task.priority]} />
              </TableCell>
              <TableCell>
                <Chip
                  label={STATUS_LABEL[task.status]}
                  size="small"
                  color={STATUS_COLOR[task.status]}
                  variant="outlined"
                />
              </TableCell>
              <TableCell>
                {task.dueDate ? (
                  <Chip
                    label={`Due ${formatDueDate(task.dueDate)}`}
                    size="small"
                    color={isOverdue(task) ? 'error' : 'default'}
                    variant="outlined"
                  />
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }} useFlexGap>
                  {task.assignments.map((a) => (
                    <Chip key={a.roleCode} label={a.roleCode} size="small" variant="outlined" />
                  ))}
                </Stack>
              </TableCell>
              <TableCell align="right">
                <IconButton
                  size="small"
                  aria-label={`Set status for ${task.title}`}
                  disabled={isUpdating}
                  onClick={(e) => setRowMenu({ id: task.id, el: e.currentTarget })}
                >
                  <MoreVertIcon />
                </IconButton>
                <Menu
                  anchorEl={rowMenu?.el}
                  open={rowMenu?.id === task.id}
                  onClose={() => setRowMenu(null)}
                >
                  {ALL_STATUSES.map((s) => (
                    <MenuItem
                      key={s}
                      selected={task.status === s}
                      disabled={isUpdating}
                      onClick={() => {
                        setRowMenu(null);
                        onSetStatus(task.id, s);
                      }}
                    >
                      {STATUS_LABEL[s]}
                    </MenuItem>
                  ))}
                </Menu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
