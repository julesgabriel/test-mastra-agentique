import {
  MetricsSummary,
  ServiceStatusSummary,
} from '../value-objects/metrics-summary.js';
import {
  Metric,
  ServiceName,
  SERVICES,
  ServiceStatus,
} from '../value-objects/metrics.vo.js';

export class SummarizeMetricsService {
  private getWorstStatus(
    metrics: readonly Metric[],
    service: ServiceName,
  ): ServiceStatus {
    if (metrics.some((m) => m.service_status[service] === 'offline'))
      return 'offline';
    if (metrics.some((m) => m.service_status[service] === 'degraded'))
      return 'degraded';
    return 'online';
  }

  private summarizeServices(metrics: readonly Metric[]): ServiceStatusSummary {
    const summary: Record<ServiceStatus, ServiceName[]> = {
      online: [],
      degraded: [],
      offline: [],
    };
    if (metrics.length === 0) return summary;

    SERVICES.forEach((service: ServiceName) => {
      const status = this.getWorstStatus(metrics, service);
      summary[status].push(service);
    });

    return summary;
  }

  summarize(metrics: readonly Metric[]): MetricsSummary {
    if (metrics.length === 0) {
      return {
        insights: {
          average_latency_ms: 0,
          max_cpu_usage: 0,
          max_memory_usage: 0,
          error_rate: 0,
          uptime_seconds: 0,
        },
        service_status_summary: { online: [], degraded: [], offline: [] },
      };
    }

    const { totalLatency, totalErrorRate, maxCpuUsage, maxMemoryUsage } =
      metrics.reduce(
        (previousValue, metric) => {
          previousValue.totalLatency += metric.latency_ms;
          previousValue.totalErrorRate += metric.error_rate;
          previousValue.maxCpuUsage = Math.max(
            previousValue.maxCpuUsage,
            metric.cpu_usage,
          );
          previousValue.maxMemoryUsage = Math.max(
            previousValue.maxMemoryUsage,
            metric.memory_usage,
          );
          return previousValue;
        },
        {
          totalLatency: 0,
          totalErrorRate: 0,
          maxCpuUsage: 0,
          maxMemoryUsage: 0,
        },
      );

    return {
      insights: {
        average_latency_ms: Number((totalLatency / metrics.length).toFixed(2)),
        max_cpu_usage: maxCpuUsage,
        max_memory_usage: maxMemoryUsage,
        error_rate: Number((totalErrorRate / metrics.length).toFixed(4)),
        uptime_seconds: metrics.at(-1)?.uptime_seconds ?? 0,
      },
      service_status_summary: this.summarizeServices(metrics),
    };
  }
}
