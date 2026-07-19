'use client';

import { useForm } from 'react-hook-form';
import { useSaveZReportMutation } from '@/store/apis/metrics-api';

export interface ZReportFormValues {
  report_date: string;
  department: string;
  nett_sales?: number;
  total_covers?: number;
  receipt_images?: unknown[];
}

export function ZReportForm() {
  const [saveZReport, { isLoading, isSuccess, isError, error }] = useSaveZReportMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ZReportFormValues>({
    defaultValues: {
      department: 'all_pos',
      report_date: new Date().toISOString().slice(0, 10),
    },
  });

  const onSubmit = async (values: ZReportFormValues) => {
    await saveZReport({ ...values } as Record<string, unknown>).unwrap();
    reset(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} data-testid="z-report-form">
      <label htmlFor="report_date">Report date</label>
      <input
        id="report_date"
        type="date"
        {...register('report_date', { required: 'Report date is required' })}
        style={{ colorScheme: 'dark' }}
      />
      {errors.report_date && <p role="alert">{errors.report_date.message}</p>}

      <label htmlFor="department">Department</label>
      <select id="department" {...register('department')}>
        <option value="all_pos">All POS</option>
      </select>

      <label htmlFor="nett_sales">Nett sales (IDR)</label>
      <input
        id="nett_sales"
        type="number"
        {...register('nett_sales', { valueAsNumber: true })}
      />

      <label htmlFor="total_covers">Total covers</label>
      <input
        id="total_covers"
        type="number"
        {...register('total_covers', { valueAsNumber: true })}
      />

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Saving…' : 'Save Z-report'}
      </button>

      {isSuccess && <p role="status">Saved successfully.</p>}
      {isError && (
        <p role="alert">
          {error && 'data' in error
            ? String((error.data as { error?: string })?.error ?? 'Save failed')
            : 'Save failed'}
        </p>
      )}
    </form>
  );
}
