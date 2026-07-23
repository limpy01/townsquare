const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e",
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  use: {
    baseURL: "http://127.0.0.1:14173",
    colorScheme: "dark",
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command:
        "DATA_DIR=/tmp/townsquare-playwright-data HOST=127.0.0.1 PORT=18081 npm run server",
      url: "http://127.0.0.1:18081/health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command:
        "VITE_API_BASE=http://127.0.0.1:18081 VITE_WS_BASE=ws://127.0.0.1:18081 npm run serve -- --host 127.0.0.1 --port 14173",
      url: "http://127.0.0.1:14173",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
