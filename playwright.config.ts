import { defineConfig } from "@playwright/test";

const API_BASE_URL =
  process.env.API_BASE_URL || "https://takehome-desktop.d.tekvisionflow.com";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: "desktop-v1",
      testMatch: ["**/*.shared.spec.ts", "**/*.v1.spec.ts"],
      use: { baseURL: `${API_BASE_URL}/desktop` },
    },
    {
      name: "desktop-v2",
      testMatch: ["**/*.shared.spec.ts", "**/*.v2.spec.ts"],
      use: { baseURL: `${API_BASE_URL}/desktopv2` },
    },
  ],
});
