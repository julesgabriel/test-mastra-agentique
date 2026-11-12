import { ServiceName } from './metrics.vo.js';

export interface Insights {
  readonly average_latency_ms: number;
  readonly max_cpu_usage: number;
  readonly max_memory_usage: number;
  readonly error_rate: number;
  readonly uptime_seconds: number;
}

export interface ServiceStatusSummary {
  readonly online: readonly ServiceName[];
  readonly degraded: readonly ServiceName[];
  readonly offline: readonly ServiceName[];
}

export interface MetricsSummary {
  readonly insights: Insights;
  readonly service_status_summary: ServiceStatusSummary;
}
