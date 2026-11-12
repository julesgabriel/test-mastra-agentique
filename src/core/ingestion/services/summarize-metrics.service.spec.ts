import { describe, expect, it } from 'vitest';

import { SummarizeMetricsService } from './summarize-metrics.service.js';
import { IngestMetricsCommand } from '../usecases/ingest-metrics.usecase.js';
import { Metric } from '../value-objects/metrics.vo.js';

const buildMetric = (overrides: Partial<Metric> = {}): Metric => ({
  timestamp: '2023-10-01T12:00:00Z',
  cpu_usage: 0,
  memory_usage: 0,
  latency_ms: 0,
  disk_usage: 0,
  network_in_kbps: 0,
  network_out_kbps: 0,
  io_wait: 0,
  thread_count: 0,
  active_connections: 0,
  error_rate: 0,
  uptime_seconds: 0,
  temperature_celsius: 0,
  power_consumption_watts: 0,
  ...overrides,
  service_status: {
    database: 'online',
    api_gateway: 'online',
    cache: 'online',
    ...overrides.service_status,
  },
});

describe('SummarizeMetricsServices', () => {
  const service = new SummarizeMetricsService();

  it('returns empty summary when given no metrics', () => {
    const result = service.summarize([]);

    expect(result.insights).toEqual({
      average_latency_ms: 0,
      max_cpu_usage: 0,
      max_memory_usage: 0,
      error_rate: 0,
      uptime_seconds: 0,
    });
    expect(result.service_status_summary).toEqual({
      online: [],
      degraded: [],
      offline: [],
    });
  });

  it('keeps values as-is when summarizing a single metric', () => {
    const metrics: IngestMetricsCommand = [
      buildMetric({
        latency_ms: 10,
        cpu_usage: 45,
        memory_usage: 60,
        error_rate: 0.01,
        uptime_seconds: 1200,
      }),
    ];

    const result = service.summarize(metrics);

    expect(result.insights.average_latency_ms).toBe(10);
    expect(result.insights.max_cpu_usage).toBe(45);
    expect(result.insights.max_memory_usage).toBe(60);
    expect(result.insights.error_rate).toBe(0.01);
    expect(result.insights.uptime_seconds).toBe(1200);
    expect(result.service_status_summary).toEqual({
      online: ['database', 'api_gateway', 'cache'],
      degraded: [],
      offline: [],
    });
  });

  it('computes averages and peak values across a batch of metrics', () => {
    const metrics: IngestMetricsCommand = [
      buildMetric({
        timestamp: '2023-10-01T12:00:00Z',
        latency_ms: 40,
        cpu_usage: 54,
        memory_usage: 65,
        error_rate: 0.02,
        uptime_seconds: 360000,
      }),
      buildMetric({
        timestamp: '2023-10-01T12:30:00Z',
        latency_ms: 0,
        cpu_usage: 99,
        memory_usage: 92,
        error_rate: 0.04,
        uptime_seconds: 361800,
      }),
      buildMetric({
        timestamp: '2023-10-01T13:00:00Z',
        latency_ms: 20,
        cpu_usage: 72,
        memory_usage: 78,
        error_rate: 0.12,
        uptime_seconds: 363600,
      }),
    ];

    const { insights } = service.summarize(metrics);

    expect(insights.average_latency_ms).toBe(20);
    expect(insights.max_cpu_usage).toBe(99);
    expect(insights.max_memory_usage).toBe(92);
    expect(insights.error_rate).toBe(0.06);
    expect(insights.uptime_seconds).toBe(363600);
  });

  it('rounds decimal averages properly', () => {
    const metrics: IngestMetricsCommand = [
      buildMetric({ latency_ms: 100, error_rate: 0.01 }),
      buildMetric({ latency_ms: 100, error_rate: 0.02 }),
      buildMetric({ latency_ms: 101, error_rate: 0.04 }),
    ];

    const { insights } = service.summarize(metrics);

    expect(insights.average_latency_ms).toBe(100.33);
    expect(insights.error_rate).toBe(0.0233);
  });

  it('keeps the worst status seen for each service over the period', () => {
    const metrics: IngestMetricsCommand = [
      buildMetric({
        service_status: {
          database: 'online',
          api_gateway: 'degraded',
          cache: 'online',
        },
      }),
      buildMetric({
        service_status: {
          database: 'offline',
          api_gateway: 'online',
          cache: 'online',
        },
      }),
    ];

    const { service_status_summary } = service.summarize(metrics);

    expect(service_status_summary.online).toEqual(['cache']);
    expect(service_status_summary.degraded).toEqual(['api_gateway']);
    expect(service_status_summary.offline).toEqual(['database']);
  });
});
