import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.pw.mjs',
  projects: [
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'iphone-13', use: { ...devices['iPhone 13'] } },
  ],
});
