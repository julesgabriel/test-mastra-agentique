// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { z } from 'zod';
import { IngestionModule } from './modules/ingestion.module.js';

const nonEmptyEnvVar = z
  .string()
  .trim()
  .nonempty('Must be defined and non-empty');

const envSchema = z.object({
  GOOGLE_GENERATIVE_AI_API_KEY: nonEmptyEnvVar,
  DIAGNOSTIC_MODEL: nonEmptyEnvVar,
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => envSchema.parse(env),
    }),
    IngestionModule,
  ],
})
export class AppModule {}
