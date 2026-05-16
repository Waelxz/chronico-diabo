import { defineConfig } from '@playwright/test';

export default defineConfig({
  outputDir: 'test-results',
  snapshotDir: 'test-snapshots',
  use: {
    browserName: 'chromium',
    channel: 'msedge',
    screenshot: 'on',
    viewport: {
      width: 1920,
      height: 1080,
    },
  },
});
