import { Module } from '@nestjs/common';
import { IngestionController } from '../adapters/primary/ingestion/ingestion.controller.js';
import { IngestMetricsUsecase } from '../core/ingestion/usecases/ingest-metrics.usecase.js';
import {
  THRESHOLDS_CONTRACT,
  ThresholdsContract,
} from '../core/ingestion/contracts/thresholds.contract.js';
import { thresholdsConfigProvider } from '../adapters/secondary/threshold/thresholds-config.provider.js';
import { mastraRecommendationProvider } from '../adapters/secondary/diagnostic/mastra-recommendation.provider.js';
import {
  RECOMMENDATION_GATEWAY,
  RecommendationGatewayContract,
} from '../core/ingestion/contracts/recommendation.gateway.contract.js';

@Module({
  controllers: [IngestionController],
  providers: [
    thresholdsConfigProvider,
    mastraRecommendationProvider,
    {
      provide: IngestMetricsUsecase,
      useFactory: (
        thresholdsContract: ThresholdsContract,
        recommendationGatewayContract: RecommendationGatewayContract,
      ) => new IngestMetricsUsecase(thresholdsContract, recommendationGatewayContract),
      inject: [THRESHOLDS_CONTRACT, RECOMMENDATION_GATEWAY],
    },
  ],
})
export class IngestionModule {}
