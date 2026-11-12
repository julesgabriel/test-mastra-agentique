import { MonitoredMetric } from '../contracts/thresholds.contract.js';

export const SEVERITY = ['low', 'medium', 'high'] as const;
export type AnomalySeverity = (typeof SEVERITY)[number];

export interface AnomalyVo {
  readonly timestamp: string;
  readonly metric: MonitoredMetric;
  readonly value: number;
  readonly threshold: number;
  readonly severity: AnomalySeverity;
  readonly description: string;
}
