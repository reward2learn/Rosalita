import { configureStore } from '@reduxjs/toolkit';
import { authSlice } from '@/store/auth-slice';
import { uiSlice } from '@/store/ui-slice';
import { chatStreamSlice } from '@/store/chat-stream-slice';
import { authApi } from '@/store/apis/auth-api';
import { financialApi } from '@/store/apis/financial-api';
import { metricsApi } from '@/store/apis/metrics-api';
import { monthlyActualsApi } from '@/store/apis/monthly-actuals-api';
import { contentApi } from '@/store/apis/content-api';
import { chatApi } from '@/store/apis/chat-api';
import { pdfApi } from '@/store/apis/pdf-api';
import { posApi } from '@/store/apis/pos-api';
import { configApi } from '@/store/apis/config-api';
import { tasksApi } from '@/store/apis/tasks-api';
import { adminApi } from '@/store/apis/admin-api';
import { dashboardApi } from '@/store/apis/dashboard-api';
import { sheetDataApi } from '@/store/apis/sheet-data-api';
import { brandConfigApi } from '@/store/apis/brand-config-api';
import { navigationApi } from '@/store/apis/navigation-api';

const apiMiddleware = [
  authApi.middleware,
  financialApi.middleware,
  metricsApi.middleware,
  monthlyActualsApi.middleware,
  contentApi.middleware,
  chatApi.middleware,
  pdfApi.middleware,
  posApi.middleware,
  configApi.middleware,
  tasksApi.middleware,
  adminApi.middleware,
  dashboardApi.middleware,
  sheetDataApi.middleware,
  brandConfigApi.middleware,
  navigationApi.middleware,
] as const;

export function makeStore() {
  return configureStore({
    reducer: {
      auth: authSlice.reducer,
      ui: uiSlice.reducer,
      chatStream: chatStreamSlice.reducer,
      [authApi.reducerPath]: authApi.reducer,
      [financialApi.reducerPath]: financialApi.reducer,
      [metricsApi.reducerPath]: metricsApi.reducer,
      [monthlyActualsApi.reducerPath]: monthlyActualsApi.reducer,
      [contentApi.reducerPath]: contentApi.reducer,
      [chatApi.reducerPath]: chatApi.reducer,
      [pdfApi.reducerPath]: pdfApi.reducer,
      [posApi.reducerPath]: posApi.reducer,
      [configApi.reducerPath]: configApi.reducer,
      [tasksApi.reducerPath]: tasksApi.reducer,
      [adminApi.reducerPath]: adminApi.reducer,
      [dashboardApi.reducerPath]: dashboardApi.reducer,
      [sheetDataApi.reducerPath]: sheetDataApi.reducer,
      [brandConfigApi.reducerPath]: brandConfigApi.reducer,
      [navigationApi.reducerPath]: navigationApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(...apiMiddleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
