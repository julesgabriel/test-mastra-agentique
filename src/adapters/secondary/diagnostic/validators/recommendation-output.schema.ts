import { z } from 'zod';
import { RecommendationVo } from '../../../../core/ingestion/value-objects/recommendation.vo.js';

const parameterEntrySchema = z.object({
  key: z
    .string()
    .describe(
      'Configuration parameter name (e.g., max_connections, cache_ttl_seconds, replicas)',
    ),
  value: z
    .union([z.string(), z.number(), z.boolean()])
    .describe('Concrete target value for the parameter'),
});

type LlmRecommendation = Omit<RecommendationVo, 'parameters'> & {
  parameters: z.infer<typeof parameterEntrySchema>[];
};

type ZodShape<T> = {
  [K in keyof T]-?: z.ZodType<T[K]>;
};

const recommendationItemSchema = z.object({
  id: z
    .string()
    .describe('Unique identifier such as rec_1, rec_2 ordered by priority'),
  action: z
    .string()
    .describe(
      'Concrete infrastructure or configuration optimization action to execute',
    ),
  target: z
    .string()
    .describe(
      'Target component or service (e.g., database, api_gateway, cache, compute_cluster)',
    ),
  parameters: z
    .array(parameterEntrySchema)
    .min(1)
    .describe(
      'Actionable technical tuning parameters associated with the recommendation',
    ),
  benefit_estimate: z
    .string()
    .describe(
      'Quantified expected improvement grounded in the observed metrics (e.g., reduce peak latency below 200ms)',
    ),
} satisfies ZodShape<LlmRecommendation>);

export const recommendationOutputSchema = z.object({
  recommendations: z
    .array(recommendationItemSchema)
    .min(1)
    .describe(
      'Prioritized list of concrete infrastructure optimization recommendations',
    ),
});
