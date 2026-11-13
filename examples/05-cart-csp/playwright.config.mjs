import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.pw.mjs',
  projects: [{ name: 'webkit', use: { browserName: 'webkit' } }],
});
