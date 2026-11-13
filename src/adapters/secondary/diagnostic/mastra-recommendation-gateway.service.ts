import { Injectable } from '@nestjs/common';
import { Agent } from '@mastra/core/agent';
import {
  RecommendationContext,
  RecommendationGatewayContract,
} from '../../../core/ingestion/contracts/recommendation.gateway.contract.js';
import { RecommendationVo } from '../../../core/ingestion/value-objects/recommendation.vo.js';
import { recommendationOutputSchema } from './validators/recommendation-output.schema.js';

const SRE_RECOMMENDATION_INSTRUCTIONS = `You are a Principal Site Reliability Engineer (SRE) optimizing a production infrastructure.
You receive a JSON payload containing global system insights, service health summaries (online, degraded, offline), and detected metric anomalies.

Follow these rules:
1. Correlate simultaneous metric anomalies across timestamps with degraded or offline services (database, api_gateway, cache), including silent service outages without metric spikes.
2. Base every action, target, parameter, and benefit_estimate strictly on the provided values, thresholds, and service names. Do not invent unmeasured components.
3. Deduplicate by root cause: return prioritized, non-overlapping recommendations (rec_1, rec_2, ...) rather than one per raw anomaly.
4. Provide realistic technical tuning parameters and concrete expected gains in benefit_estimate.`;

@Injectable()
export class MastraRecommendationGateway implements RecommendationGatewayContract {
  async generateRecommendations(
    context: RecommendationContext,
  ): Promise<RecommendationVo[]> {

    const agent = new Agent({
      id: 'sre-recommendation-agent',
      name: 'SRE Recommendation Agent',
      model: [
        {
          maxRetries: 1,
          model: process.env.DIAGNOSTIC_MODEL!,
        },
        {
          maxRetries: 1,
          model: 'google/gemini-3.6-flash',
        },
        {
          maxRetries: 1,
          model: 'google/gemini-3.1-pro-preview-customtools',
        },
      ],
      instructions: SRE_RECOMMENDATION_INSTRUCTIONS,
    });

    const response = await agent.generate(
      JSON.stringify(context),
      {
        structuredOutput: {
          schema: recommendationOutputSchema,
        },
        maxSteps: 5,
      },
    );

    if (!response.object) {
      throw new Error(
        'Recommendation agent failed to generate structured output',
      );
    }

    return response.object.recommendations.map((rec) => ({
      ...rec,
      parameters: Object.fromEntries(
        rec.parameters.map(({ key, value }) => [key, value]),
      ),
    }));
  }
}
