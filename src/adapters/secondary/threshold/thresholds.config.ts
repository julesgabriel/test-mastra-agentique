import { Injectable } from '@nestjs/common';

import {
  ThresholdsContract,
  Thresholds,
} from '../../../core/ingestion/contracts/thresholds.contract.js';


/**
 * Thresholds for anomaly detection inspired by Awesome Prometheus Alerts
 * and calibrated against the system's observed nominal baseline.
 *
 * - For host & hardware resources:
 *   @see https://samber.github.io/awesome-prometheus-alerts/rules/basic-resource-monitoring/host-and-hardware/
 * - For HTTP error rates:
 *   @see https://samber.github.io/awesome-prometheus-alerts/rules/proxies-load-balancers-and-service-meshes/nginx/
 */
@Injectable()
export class ThresholdsConfig implements ThresholdsContract {
  getAnomalyThreshold(): Thresholds {
    return {
      cpu_usage: {
        low: 70,
        medium: 80,
        high: 90,
      },
      memory_usage: {
        low: 75,
        medium: 80,
        high: 90,
      },
      disk_usage: {
        low: 70,
        medium: 80,
        high: 90,
      },
      io_wait: {
        low: 5,
        medium: 8,
        high: 10,
      },
      temperature_celsius: {
        low: 68,
        medium: 75,
        high: 80,
      },
      latency_ms: {
        low: 180,
        medium: 200,
        high: 300,
      },
      error_rate: {
        low: 0.04,
        medium: 0.05,
        high: 0.1,
      },
      // Workload-dependent: calibrated directly from observed baseline (~50 connections)
      active_connections: {
        medium: 70,
        high: 100,
      },
      // Workload-dependent: calibrated directly from observed baseline (~150 threads)
      thread_count: {
        medium: 165,
        high: 180,
      },
    };
  }
}
