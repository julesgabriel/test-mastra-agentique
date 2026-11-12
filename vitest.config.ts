import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Lets you use describe/it/expect without explicit imports (or remove & import from 'vitest')
    root: './',
    include: ['src/**/*.spec.ts'],
  },
  plugins: [
    // Required for NestJS decorator metadata (@Injectable, @Controller, etc.)
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});