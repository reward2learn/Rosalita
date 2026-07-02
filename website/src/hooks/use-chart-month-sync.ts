'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ChartOverview } from '@/domain/financial/financial-projection-service';
import { labelToPeriod, parseMonthQueryParam, resolveDefaultMonthIndex } from '@/lib/chart-utils';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setSelectedMonth } from '@/store/ui-slice';

/**
 * Sync selected chart month from URL ?month= and/or chart overview labels.
 * Seeds the current (or first) month when no selection exists.
 */
export function useChartMonthSync(overview: ChartOverview | undefined, enabled = true): void {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const selectedMonthLabel = useAppSelector((s) => s.ui.selectedMonthLabel);
  const labels = overview?.labels;

  useEffect(() => {
    if (!enabled || !labels?.length) return;

    const monthParam = parseMonthQueryParam(searchParams.get('month'));
    if (monthParam) {
      const idx = labels.indexOf(monthParam);
      if (idx >= 0) {
        dispatch(
          setSelectedMonth({
            label: monthParam,
            period: labelToPeriod(monthParam),
          }),
        );
      }
      return;
    }

    if (selectedMonthLabel && labels.includes(selectedMonthLabel)) return;

    const defaultIdx = resolveDefaultMonthIndex(labels);
    const label = labels[defaultIdx];
    if (label) {
      dispatch(
        setSelectedMonth({
          label,
          period: labelToPeriod(label),
        }),
      );
    }
  }, [enabled, labels, searchParams, selectedMonthLabel, dispatch]);
}
