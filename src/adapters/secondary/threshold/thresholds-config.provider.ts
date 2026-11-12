import { ClassProvider } from '@nestjs/common';
import {
  THRESHOLDS_CONTRACT,
  ThresholdsContract,
} from '../../../core/ingestion/contracts/thresholds.contract.js';
import { ThresholdsConfig } from './thresholds.config.js';

export const thresholdsConfigProvider: ClassProvider<ThresholdsContract> = {
  provide: THRESHOLDS_CONTRACT,
  useClass: ThresholdsConfig,
};