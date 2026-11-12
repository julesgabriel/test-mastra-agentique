import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IngestMetricsUsecase } from './ingest-metrics.usecase.js';
import { RecommendationGatewayContract } from '../contracts/recommendation.gateway.contract.js';
import {
  Thresholds,
  ThresholdsContract,
} from '../contracts/thresholds.contract.js';
import { DiagnosticVo } from '../value-objects/diagnostic.vo.js';
import { Metric } from '../value-objects/metrics.vo.js';

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

const cannedDiagnostic: DiagnosticVo = {
  summary: 'High load on database and compute resources',
  probableRootCause: 'Slow queries saturating CPU and I/O',
  overallSeverity: 'high',
  recommendations: [
    'Inspect active database queries',
    'Check connection pool usage',
  ],
};

class FakeDiagnosticGateway implements RecommendationGatewayContract {
  async diagnose(): Promise<DiagnosticVo> {
    return cannedDiagnostic;
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
  let diagnosticGateway: FakeDiagnosticGateway;
  let usecase: IngestMetricsUsecase;

  beforeEach(() => {
    diagnosticGateway = new FakeDiagnosticGateway();
    usecase = new IngestMetricsUsecase(
      new InMemoryThresholds(),
      diagnosticGateway,
    );
  });

  it('summarizes metrics and skips diagnostic when everything is normal', async () => {
    const diagnoseSpy = vi.spyOn(diagnosticGateway, 'diagnose');
    const metrics = [
      buildMetric({ latency_ms: 40, cpu_usage: 50 }),
      buildMetric({ latency_ms: 60, cpu_usage: 60 }),
    ];

    const result = await usecase.run(metrics);

    expect(result.insights.average_latency_ms).toBe(50);
    expect(result.insights.max_cpu_usage).toBe(60);
    expect(result.anomalies).toEqual([]);
    expect(result.hasPotentialIssues).toBe(false);
    expect(result.diagnostic).toBeNull();
    expect(diagnoseSpy).not.toHaveBeenCalled();
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
        metricName: 'cpu_usage',
        value: 95,
        threshold: 90,
        severity: 'high',
      },
      {
        timestamp: '2023-10-01T12:05:00Z',
        metricName: 'memory_usage',
        value: 75,
        threshold: 75,
        severity: 'low',
      },
      {
        timestamp: '2023-10-01T12:05:00Z',
        metricName: 'latency_ms',
        value: 200,
        threshold: 200,
        severity: 'medium',
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
        metricName: 'active_connections',
        value: 70,
        threshold: 70,
        severity: 'medium',
      },
      {
        timestamp: '2023-10-01T12:10:00Z',
        metricName: 'thread_count',
        value: 185,
        threshold: 180,
        severity: 'high',
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
      metricName: 'error_rate',
      severity: 'high',
    });
    expect(anomalies[1]).toMatchObject({
      timestamp: '2023-10-01T12:10:00Z',
      metricName: 'io_wait',
      severity: 'medium',
    });
  });

  it('triggers a diagnostic when metric anomalies are detected', async () => {
    const diagnoseSpy = vi.spyOn(diagnosticGateway, 'diagnose');
    const metrics = [buildMetric({ cpu_usage: 92, io_wait: 9 })];

    const result = await usecase.run(metrics);

    expect(result.hasPotentialIssues).toBe(true);
    expect(result.diagnostic).toEqual(cannedDiagnostic);
    expect(diagnoseSpy).toHaveBeenCalledExactlyOnceWith({
      summary: {
        insights: result.insights,
        service_status_summary: result.service_status_summary,
      },
      anomalies: result.anomalies,
    });
  });

  it('triggers a diagnostic when a service is degraded or offline even without metric anomalies', async () => {
    const diagnoseSpy = vi.spyOn(diagnosticGateway, 'diagnose');
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
    expect(result.hasPotentialIssues).toBe(true);
    expect(result.diagnostic).toEqual(cannedDiagnostic);
    expect(diagnoseSpy).toHaveBeenCalledExactlyOnceWith({
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