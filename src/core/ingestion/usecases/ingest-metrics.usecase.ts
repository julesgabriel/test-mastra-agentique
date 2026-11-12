import { ThresholdsContract } from '../contracts/thresholds.contract.js';
import { AnomalyMetricsService } from '../services/anomaly-metrics.service.js';
import { SummarizeMetricsService } from '../services/summarize-metrics.service.js';
import { AnomalyVo } from '../value-objects/anomaly.vo.js';
import { MetricsSummary } from '../value-objects/metrics-summary.js';
import { Metric } from '../value-objects/metrics.vo.js';
import { RecommendationVo } from '../value-objects/recommendation.vo.js';
import { RecommendationGatewayContract } from '../contracts/recommendation.gateway.contract.js';

export type IngestMetricsCommand = readonly Metric[];

export type IngestMetricsOutput = MetricsSummary & {
  readonly timestamp: string;
  readonly anomalies: readonly AnomalyVo[];
  readonly recommendations: readonly RecommendationVo[];
};

export class IngestMetricsUsecase {
  private readonly summarizeMetricsService = new SummarizeMetricsService();
  private readonly anomalyMetricsService = new AnomalyMetricsService();

  constructor(
    private readonly thresholdsProvider: ThresholdsContract,
    private readonly diagnosticGateway: RecommendationGatewayContract,
  ) {}

  private hasUnhealthyServices(summary: MetricsSummary): boolean {
    const { degraded, offline } = summary.service_status_summary;
    return degraded.length > 0 || offline.length > 0;
  }

  async run(command: IngestMetricsCommand): Promise<IngestMetricsOutput> {
    const timestamp = new Date().toISOString();
    const summary = this.summarizeMetricsService.summarize(command);
    const thresholds = this.thresholdsProvider.getAnomalyThreshold();
    const anomalies = this.anomalyMetricsService.detectAnomalies(
      command,
      thresholds,
    );

    const hasPotentialIssues =
      anomalies.length > 0 || this.hasUnhealthyServices(summary);

    const recommendations = hasPotentialIssues
      ? await this.diagnosticGateway.generateRecommendations({
          metrics: command,
          summary,
          anomalies,
        })
      : [];

    return {
      timestamp,
      insights: summary.insights,
      anomalies,
      recommendations,
      service_status_summary: summary.service_status_summary,
    };
  }
}
