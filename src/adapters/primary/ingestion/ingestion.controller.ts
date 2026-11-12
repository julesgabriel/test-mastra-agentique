import {
  BadRequestException,
  Body,
  Controller,
  PipeTransform,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { IngestMetricsUsecase } from '../../../core/ingestion/usecases/ingest-metrics.usecase.js';
import { ZodValidationPipe } from '../common/zod-validation-pipe.transform.js';
import { CreateMetricDto, ingestPayloadSchema } from './validators/metrics.js';


@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestMetricsUsecase: IngestMetricsUsecase) {}

  @Post()
  async ingest(
    @Body(new ZodValidationPipe(ingestPayloadSchema))
    createMetricDto: CreateMetricDto[],
  ) {
    const result = await this.ingestMetricsUsecase.run(createMetricDto);

    return {
      timestamp: result.timestamp,
      insights: result.insights,
      anomalies: result.anomalies.map(
        ({ metric, value, threshold, severity, description }) => ({
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
