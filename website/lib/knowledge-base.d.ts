export const BUSINESS_NAME: string;
export const LOCATION: string;
export const SITUATION_SUMMARY: string;
export const CURRENT_METRICS: Record<string, unknown>;
export const TARGET_METRICS: Record<string, unknown>;
export const FIVE_LEVERS: {
  num: number;
  name: string;
  impact: string;
  target: string;
  actions: string[];
}[];
export const PRIORITY_ACTIONS: {
  P0_THIS_WEEK: string[];
  P1_THIS_MONTH: string[];
  P2_THIS_QUARTER: string[];
};
export const KEY_RISKS: string[];
export const STRATEGIC_PARTNERSHIPS: Record<
  string,
  { name: string; type: string; opportunity: string; revenue_impact: string }
>;
export const MONTHLY_TARGETS: {
  month: string;
  revenue: number;
  ebitda: number;
  guests: number;
  spend: number;
  staffPct: number;
}[];
