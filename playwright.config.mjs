import { defineConfig, devices } from "@playwright/test";

const desktopTests = /desktop\.spec\.mjs/;

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    acceptDownloads: true,
    serviceWorkers: "allow",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/serve-static.mjs",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    { name: "chromium", testMatch: desktopTests, use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", testMatch: /mobile\.spec\.mjs/, use: { ...devices["Pixel 7"] } },
    { name: "firefox", testMatch: desktopTests, use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", testMatch: desktopTests, use: { ...devices["Desktop Safari"] } },
    { name: "webkit-mobile", testMatch: /mobile\.spec\.mjs/, use: { ...devices["iPhone 13"] } },
  ],
});
