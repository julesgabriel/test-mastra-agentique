import { z } from 'zod';
import {
  SERVICE_STATUSES,
  SERVICES,
} from '../../../../core/ingestion/value-objects/metrics.vo.js';

export const serviceNameSchema = z.enum(SERVICES);
export const serviceStatusSchema = z.enum(SERVICE_STATUSES);


export const createMetricSchema = z.object({
  timestamp: z.iso.datetime(),
  cpu_usage: z.number(),
  memory_usage: z.number(),
  latency_ms: z.number(),
  disk_usage: z.number(),
  network_in_kbps: z.number(),
  network_out_kbps: z.number(),
  io_wait: z.number(),
  thread_count: z.number(),
  active_connections: z.number(),
  error_rate: z.number(),
  uptime_seconds: z.number(),
  temperature_celsius: z.number(),
  power_consumption_watts: z.number(),
  service_status: z.record(serviceNameSchema, serviceStatusSchema),
});

export const ingestPayloadSchema = z.array(createMetricSchema);
export type CreateMetricDto = z.infer<typeof createMetricSchema>;
