import { createSlice } from '@reduxjs/toolkit';
import type { ForecastScenarioKey } from '@/domain/financial/financial-projection-service';

export type ChartKpi = 'ebitda' | 'revenue' | 'net_income' | 'guests' | 'staff_cost';

export interface UiState {
  drawerOpen: boolean;
  pdfExportMode: boolean;
  activeTab: string;
  chartKpi: ChartKpi;
  chartScenario: ForecastScenarioKey;
  selectedMonthLabel: string | null;
  selectedMonthPeriod: string | null;
}

const initialState: UiState = {
  drawerOpen: false,
  pdfExportMode: false,
  activeTab: 'z-report',
  chartKpi: 'ebitda',
  chartScenario: 'conservative',
  selectedMonthLabel: null,
  selectedMonthPeriod: null,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setDrawerOpen(state, action: { payload: boolean }) {
      state.drawerOpen = action.payload;
    },
    setPdfExportMode(state, action: { payload: boolean }) {
      state.pdfExportMode = action.payload;
    },
    setActiveTab(state, action: { payload: string }) {
      state.activeTab = action.payload;
    },
    setChartKpi(state, action: { payload: ChartKpi }) {
      state.chartKpi = action.payload;
    },
    setChartScenario(state, action: { payload: ForecastScenarioKey }) {
      state.chartScenario = action.payload;
    },
    setSelectedMonth(
      state,
      action: { payload: { label: string | null; period: string | null } },
    ) {
      state.selectedMonthLabel = action.payload.label;
      state.selectedMonthPeriod = action.payload.period;
    },
  },
});

export const {
  setDrawerOpen,
  setPdfExportMode,
  setActiveTab,
  setChartKpi,
  setChartScenario,
  setSelectedMonth,
} = uiSlice.actions;
