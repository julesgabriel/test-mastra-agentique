import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { IngestionController } from './ingestion.controller.js';
import { IngestMetricsUsecase } from '../../../core/ingestion/usecases/ingest-metrics.usecase.js';

describe('IngestionController', () => {
  let controller: IngestionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        {
          provide: IngestMetricsUsecase,
          useValue: {
            run: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<IngestionController>(IngestionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
