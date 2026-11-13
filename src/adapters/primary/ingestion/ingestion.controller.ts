import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  PipeTransform,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { IngestMetricsUsecase } from '../../../core/ingestion/usecases/ingest-metrics.usecase.js';
import { ZodValidationPipe } from '../common/zod-validation-pipe.transform.js';
import { CreateMetricDto, ingestPayloadSchema } from './validators/metrics.js';


@Controller('ingestion')
export class IngestionController {
  private readonly logger = new Logger(IngestionController.name);

  constructor(private readonly ingestMetricsUsecase: IngestMetricsUsecase) {}

  @Post()
  async ingest(
    @Body(new ZodValidationPipe(ingestPayloadSchema))
    createMetricDto: CreateMetricDto[],
  ) {
    this.logger.log(
      `Ingestion démarrée : ${createMetricDto.length} relevés reçus`,
    );

    const result = await this.ingestMetricsUsecase.run(createMetricDto);

    this.logger.log(
      `Ingestion terminée avec succès : ${result.anomalies.length} anomalies détectées, ${result.recommendations.length} recommandations générées`,
    );

    return {
      timestamp: result.timestamp,
      insights: result.insights,
      anomalies: result.anomalies.map(
        ({ metric, value, threshold, severity, description, timestamp }) => ({
          timestamp,
          metric,
          value,
          threshold,
          severity,
          description,
        }),
      ),
      recommendations: result.recommendations,
      service_status_summary: result.service_status_summary,
    };
  }
}
