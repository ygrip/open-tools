import { defineConfig } from '@playwright/test';

const deployUrl = process.env.DEPLOY_URL;

export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: deployUrl ?? 'http://127.0.0.1:4173', browserName: 'chromium' },
  webServer: deployUrl ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false
  }
});
