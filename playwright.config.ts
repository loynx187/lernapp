import { defineConfig, devices } from '@playwright/test'

// Browser-Tests gegen den Produktions-Build (vite preview). Dropbox wird in den Tests simuliert.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/lernapp/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    // iPhone-Größe; gerendert mit Chromium (WebKit ist im Container nicht installiert)
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/lernapp/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
