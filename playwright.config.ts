import { defineConfig } from "@playwright/test";

const BASE_URL =
  process.env.BASE_URL || "https://takehome-desktop.d.tekvisionflow.com";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: "desktop-v1",
      use: { baseURL: BASE_URL },
    },
  ],
});
