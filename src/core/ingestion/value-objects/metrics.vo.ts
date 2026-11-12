export const SERVICES = ['database', 'api_gateway', 'cache'] as const;
export type ServiceName = (typeof SERVICES)[number];

export const SERVICE_STATUSES = ['online', 'degraded', 'offline'] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export interface Metric {
  readonly timestamp: string;
  readonly cpu_usage: number;
  readonly memory_usage: number;
  readonly latency_ms: number;
  readonly disk_usage: number;
  readonly network_in_kbps: number;
  readonly network_out_kbps: number;
  readonly io_wait: number;
  readonly thread_count: number;
  readonly active_connections: number;
  readonly error_rate: number;
  readonly uptime_seconds: number;
  readonly temperature_celsius: number;
  readonly power_consumption_watts: number;
  readonly service_status: Readonly<Record<ServiceName, ServiceStatus>>;
}
