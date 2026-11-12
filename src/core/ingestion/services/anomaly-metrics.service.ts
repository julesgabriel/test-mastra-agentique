import { IngestMetricsCommand } from '../usecases/ingest-metrics.usecase.js';
import { AnomalySeverity, AnomalyVo } from '../value-objects/anomaly.vo.js';
import {
  MonitoredMetric,
  ThresholdLevels,
  Thresholds,
} from '../contracts/thresholds.contract.js';

const typedEntries = <K extends PropertyKey, V>(
  obj: Readonly<Record<K, V>>,
): [K, V][] => Object.entries(obj) as [K, V][];

export class AnomalyMetricsService {
  private getBypassedThreshold(
    thresholds: ThresholdLevels,
    metricValue: number,
  ): { severity: AnomalySeverity; threshold: number } | undefined {
    if (metricValue >= thresholds.high) {
      return { severity: 'high', threshold: thresholds.high };
    }

    if (metricValue >= thresholds.medium) {
      return { severity: 'medium', threshold: thresholds.medium };
    }

    if (thresholds.low !== undefined && metricValue >= thresholds.low) {
      return { severity: 'low', threshold: thresholds.low };
    }

    return undefined;
  }

  detectAnomalies(metrics: IngestMetricsCommand, thresholds: Thresholds) {
    return metrics.flatMap((metric) => {
      return typedEntries(thresholds).flatMap(
        ([k, v]: [MonitoredMetric, ThresholdLevels]): AnomalyVo[] => {
          let byPassedThreshold = this.getBypassedThreshold(v, metric[k]);
          if (!byPassedThreshold) return [];
          return [
            {
              timestamp: metric.timestamp,
              metric: k,
              value: metric[k],
              description: `${k} reached ${metric[k]} (>= ${byPassedThreshold.severity} threshold of ${byPassedThreshold.threshold}) at ${metric.timestamp}`,
              threshold: byPassedThreshold.threshold,
              severity: byPassedThreshold.severity,
            },
          ];
        },
      );
    });
  }
}
