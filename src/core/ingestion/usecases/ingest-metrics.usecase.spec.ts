import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IngestMetricsUsecase } from './ingest-metrics.usecase.js';
import { RecommendationGatewayContract } from '../contracts/recommendation.gateway.contract.js';
import {
  Thresholds,
  ThresholdsContract,
} from '../contracts/thresholds.contract.js';
import { Metric } from '../value-objects/metrics.vo.js';
import { RecommendationVo } from '../value-objects/recommendation.vo.js';

class InMemoryThresholds implements ThresholdsContract {
  getAnomalyThreshold(): Thresholds {
    return {
      cpu_usage: { low: 70, medium: 80, high: 90 },
      memory_usage: { low: 75, medium: 80, high: 90 },
      disk_usage: { low: 70, medium: 80, high: 90 },
      io_wait: { low: 5, medium: 8, high: 10 },
      temperature_celsius: { low: 68, medium: 75, high: 80 },
      latency_ms: { low: 180, medium: 200, high: 300 },
      error_rate: { low: 0.04, medium: 0.05, high: 0.1 },
      active_connections: { medium: 70, high: 100 },
      thread_count: { medium: 165, high: 180 },
    };
  }
}

const cannedRecommendations: RecommendationVo[] = [
  {
    id: 'rec_1',
    action: 'Increase database connection pool and enable autoscaling',
    target: 'database',
    parameters: { max_connections: 200 },
    benefit_estimate: 'Reduce latency below 200ms',
  },
];

class FakeRecommendationGateway implements RecommendationGatewayContract {
  async generateRecommendations(): Promise<RecommendationVo[]> {
    return cannedRecommendations;
  }
}

const buildMetric = (overrides: Partial<Metric> = {}): Metric => ({
  timestamp: '2023-10-01T12:00:00Z',
  cpu_usage: 20,
  memory_usage: 40,
  latency_ms: 50,
  disk_usage: 30,
  network_in_kbps: 100,
  network_out_kbps: 100,
  io_wait: 1,
  thread_count: 100,
  active_connections: 30,
  error_rate: 0.01,
  uptime_seconds: 3600,
  temperature_celsius: 45,
  power_consumption_watts: 120,
  service_status: {
    database: 'online',
    api_gateway: 'online',
    cache: 'online',
  },
  ...overrides,
});

describe('IngestMetricsUsecase', () => {
  let diagnosticGateway: FakeRecommendationGateway;
  let usecase: IngestMetricsUsecase;

  beforeEach(() => {
    diagnosticGateway = new FakeRecommendationGateway();
    usecase = new IngestMetricsUsecase(
      new InMemoryThresholds(),
      diagnosticGateway,
    );
  });

  it('summarizes metrics and skips diagnostic when everything is normal', async () => {
    const generateSpy = vi.spyOn(diagnosticGateway, 'generateRecommendations');
    const metrics = [
      buildMetric({ latency_ms: 40, cpu_usage: 50 }),
      buildMetric({ latency_ms: 60, cpu_usage: 60 }),
    ];

    const result = await usecase.run(metrics);

    expect(result.insights.average_latency_ms).toBe(50);
    expect(result.insights.max_cpu_usage).toBe(60);
    expect(result.anomalies).toEqual([]);
    expect(result.recommendations).toEqual([]);
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it('flags only the highest severity reached for each metric', async () => {
    const metrics = [
      buildMetric({
        timestamp: '2023-10-01T12:05:00Z',
        cpu_usage: 95,
        memory_usage: 75,
        latency_ms: 200,
      }),
    ];

    const { anomalies } = await usecase.run(metrics);

    expect(anomalies).toEqual([
      {
        timestamp: '2023-10-01T12:05:00Z',
        metric: 'cpu_usage',
        value: 95,
        threshold: 90,
        severity: 'high',
        description:
          '`cpu_usage reached 95` (>= high threshold of 90) at 2023-10-01T12:05:00Z',
      },
      {
        timestamp: '2023-10-01T12:05:00Z',
        metric: 'memory_usage',
        value: 75,
        threshold: 75,
        severity: 'low',
        description:
          'memory_usage reached 75 (>= low threshold of 75) at 2023-10-01T12:05:00Z',
      },
      {
        timestamp: '2023-10-01T12:05:00Z',
        metric: 'latency_ms',
        value: 200,
        threshold: 200,
        severity: 'medium',
        description:
          'latency_ms reached 200 (>= medium threshold of 200) at 2023-10-01T12:05:00Z',
      },
    ]);
  });

  it('handles metrics without a low threshold', async () => {
    const metrics = [
      buildMetric({
        timestamp: '2023-10-01T12:10:00Z',
        active_connections: 70,
        thread_count: 185,
      }),
    ];

    const { anomalies } = await usecase.run(metrics);

    expect(anomalies).toEqual([
      {
        timestamp: '2023-10-01T12:10:00Z',
        metric: 'active_connections',
        value: 70,
        threshold: 70,
        severity: 'medium',
        description:
          'active_connections reached 70 (>= medium threshold of 70) at 2023-10-01T12:10:00Z',
      },
      {
        timestamp: '2023-10-01T12:10:00Z',
        metric: 'thread_count',
        value: 185,
        threshold: 180,
        severity: 'high',
        description:
          'thread_count reached 185 (>= high threshold of 180) at 2023-10-01T12:10:00Z',
      },
    ]);
  });

  it('collects anomalies across multiple timestamps', async () => {
    const metrics = [
      buildMetric({ timestamp: '2023-10-01T12:00:00Z', cpu_usage: 30 }),
      buildMetric({ timestamp: '2023-10-01T12:05:00Z', error_rate: 0.12 }),
      buildMetric({ timestamp: '2023-10-01T12:10:00Z', io_wait: 9 }),
    ];

    const { anomalies } = await usecase.run(metrics);

    expect(anomalies).toHaveLength(2);
    expect(anomalies[0]).toMatchObject({
      timestamp: '2023-10-01T12:05:00Z',
      metric: 'error_rate',
      severity: 'high',
    });
    expect(anomalies[1]).toMatchObject({
      timestamp: '2023-10-01T12:10:00Z',
      metric: 'io_wait',
      severity: 'medium',
    });
  });

  it('triggers a diagnostic when metric anomalies are detected', async () => {
    const generateSpy = vi.spyOn(diagnosticGateway, 'generateRecommendations');
    const metrics = [buildMetric({ cpu_usage: 92, io_wait: 9 })];

    const result = await usecase.run(metrics);

    expect(result.recommendations).toEqual(cannedRecommendations);
    expect(generateSpy).toHaveBeenCalledExactlyOnceWith({
      metrics,
      summary: {
        insights: result.insights,
        service_status_summary: result.service_status_summary,
      },
      anomalies: result.anomalies,
    });
  });

  it('triggers a diagnostic when a service is degraded or offline even without metric anomalies', async () => {
    const generateSpy = vi.spyOn(diagnosticGateway, 'generateRecommendations');
    const metrics = [
      buildMetric({
        service_status: {
          database: 'offline',
          api_gateway: 'online',
          cache: 'degraded',
        },
      }),
    ];

    const result = await usecase.run(metrics);

    expect(result.anomalies).toEqual([]);
    expect(result.recommendations).toEqual(cannedRecommendations);
    expect(generateSpy).toHaveBeenCalledExactlyOnceWith({
      metrics,
      summary: {
        insights: result.insights,
        service_status_summary: {
          online: ['api_gateway'],
          degraded: ['cache'],
          offline: ['database'],
        },
      },
      anomalies: [],
    });
  });
});