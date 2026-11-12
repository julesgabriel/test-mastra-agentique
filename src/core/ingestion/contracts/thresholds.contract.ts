export type MonitoredMetric =
  | 'cpu_usage'
  | 'memory_usage'
  | 'disk_usage'
  | 'io_wait'
  | 'temperature_celsius'
  | 'latency_ms'
  | 'error_rate'
  | 'active_connections'
  | 'thread_count';

export type ThresholdLevels = {
  low?: number;
  medium: number;
  high: number;
};

export type Thresholds = Record<MonitoredMetric, ThresholdLevels>;

export interface ThresholdsContract {
  getAnomalyThreshold(): Thresholds;
}

export const THRESHOLDS_CONTRACT = Symbol('THRESHOLDS_CONTRACT');
