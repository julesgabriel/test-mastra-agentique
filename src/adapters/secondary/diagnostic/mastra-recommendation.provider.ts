import { ClassProvider } from '@nestjs/common';
import { RECOMMENDATION_GATEWAY, RecommendationGatewayContract } from '../../../core/ingestion/contracts/recommendation.gateway.contract.js';
import { MastraRecommendationGateway } from './mastra-recommendation-gateway.service.js';

export const mastraRecommendationProvider: ClassProvider<RecommendationGatewayContract> = {
  provide: RECOMMENDATION_GATEWAY,
  useClass: MastraRecommendationGateway,
};