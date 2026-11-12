export interface RecommendationVo {
  readonly id: string;
  readonly action: string;
  readonly target: string;
  readonly parameters: Record<string, unknown>;
  readonly benefit_estimate: string;
}
