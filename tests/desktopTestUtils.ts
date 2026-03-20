import { expect, Page, test } from "@playwright/test";
import { desktopUrl } from "./helpers";
import {
  SAMPLE_INTERACTION,
  SAMPLE_PAYLOAD,
  createTestRun,
  type TestRunPayload,
} from "./helpers";

export async function setupAndAcceptChat(
  page: Page,
  payload: TestRunPayload = SAMPLE_PAYLOAD,
  version: "v1" | "v2" = "v1"
) {
  const { runId } = await createTestRun(page.request, payload);
  const desktopBaseUrl = test.info().project.use.baseURL;

  if (!desktopBaseUrl) {
    throw new Error("Project baseURL is not configured for desktop navigation");
  }

  await page.goto(desktopUrl(runId, version));

  await expect(
    page.locator('[data-testid="agent-status-select"]')
  ).toBeVisible();

  await page
    .locator('[data-testid="agent-status-select"]')
    .selectOption("Ready");
  await expect(page.locator('[data-testid="chat-invite"]')).toBeVisible({
    timeout: 10_000,
  });

  await page.locator('[data-testid="accept-chat-invite"]').click();

  await expect(
    page.locator('[data-testid="transcript-message-0"]')
  ).toBeVisible({ timeout: 10_000 });

  return runId;
}

export function buildPayloadWithTranscript(
  chatTranscript: TestRunPayload["chatTranscript"],
  overrides: Partial<TestRunPayload["interactionInformation"]> = {}
): TestRunPayload {
  return {
    interactionInformation: {
      ...SAMPLE_INTERACTION,
      interactionId: `CHAT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      startTime: new Date().toISOString(),
      ...overrides,
    },
    chatTranscript,
  };
}

export function messageBadge(page: Page) {
  return page.locator(".panel-badge").first();
}

export async function expectMessageBadgeCount(
  page: Page,
  expectedCount: number
) {
  await expect(messageBadge(page)).toContainText(`${expectedCount} messages`);
}

export async function sendUntilMessageTarget(
  page: Page,
  startCount: number,
  targetTotal: number
) {
  let currentTotal = startCount;

  while (currentTotal < targetTotal) {
    await page
      .locator('[data-testid="agent-chat-input"]')
      .fill(`Agent msg #${currentTotal + 1}`);
    await page.locator('[data-testid="agent-chat-send"]').click();
    await page.waitForTimeout(1_500);
    currentTotal += 2;
  }

  const actualMessages = await page
    .locator('[data-testid^="transcript-message-"]')
    .count();
  const badgeText = await messageBadge(page).textContent();
  const badgeNumber = Number.parseInt(
    badgeText?.match(/\d+/)?.[0] ?? "0",
    10
  );

  return { actualMessages, badgeNumber };
}
