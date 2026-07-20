import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';
import type { TasksResponse, TaskView } from '@/app/api/tasks/route';

export type TaskStatusValue = 'pending' | 'in_progress' | 'completed';

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'P0' | 'P1' | 'P2';
  dueDate?: string;
  ownerCodes?: string[];
}

export interface UpdateTaskStatusInput {
  id: string;
  status?: TaskStatusValue;
  /** Platform-admin only: ISO date string (YYYY-MM-DD) or null to clear. */
  dueDate?: string | null;
}

export const tasksApi = createApi({
  reducerPath: 'tasksApi',
  baseQuery,
  tagTypes: ['Task', 'Role'],
  endpoints: (builder) => ({
    listTasks: builder.query<ApiEnvelope<TasksResponse>, { role?: string | null } | void>({
      query: (arg) => {
        const role = arg && 'role' in arg ? arg.role : undefined;
        return role ? `tasks?role=${encodeURIComponent(role)}` : 'tasks';
      },
      providesTags: ['Task'],
    }),
    createTask: builder.mutation<ApiEnvelope<TaskView>, CreateTaskInput>({
      query: (body) => ({
        url: 'tasks',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Task'],
    }),
    updateTaskStatus: builder.mutation<ApiEnvelope<TaskView>, UpdateTaskStatusInput>({
      query: (body) => ({
        url: 'tasks',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Task'],
    }),
  }),
});

export const {
  useListTasksQuery,
  useCreateTaskMutation,
  useUpdateTaskStatusMutation,
} = tasksApi;
