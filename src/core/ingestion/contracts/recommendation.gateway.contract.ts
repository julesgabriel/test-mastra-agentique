import { AnomalyVo } from '../value-objects/anomaly.vo.js';
import { MetricsSummary } from '../value-objects/metrics-summary.js';
import { Metric } from '../value-objects/metrics.vo.js';
import { RecommendationVo } from '../value-objects/recommendation.vo.js';

export const RECOMMENDATION_GATEWAY = Symbol('RECOMMENDATION_GATEWAY');

export interface RecommendationContext {
  readonly metrics: readonly Metric[];
  readonly summary: MetricsSummary;
  readonly anomalies: readonly AnomalyVo[];
}

export interface RecommendationGatewayContract {
  generateRecommendations(
    context: RecommendationContext,
  ): Promise<RecommendationVo[]>;
}
