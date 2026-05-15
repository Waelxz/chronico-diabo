import { defineConfig } from '@playwright/test';

export default defineConfig({
  outputDir: '.windsurf/playwright-screenshots',
  use: {
    browserName: 'chromium',
    channel: 'msedge',
    screenshot: 'only-on-failure',
    viewport: {
      width: 1280,
      height: 800,
    },
  },
});
