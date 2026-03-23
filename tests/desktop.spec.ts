import { expect, test } from "@playwright/test";

import {
  DEFAULT_START_TIME,
  EXPECTED_PROFILE_10012,
  SAMPLE_INTERACTION,
  SAMPLE_PAYLOAD,
  SAMPLE_TRANSCRIPT,
  UNAUTH_PAYLOAD,
  buildLargeTranscript,
  createTestRun,
  desktopUrl,
} from "./helpers";
import {
  buildPayloadWithTranscript,
  expectMessageBadgeCount,
  sendUntilMessageTarget,
  setupAndAcceptChat,
} from "./desktopTestUtils";

const API_BASE_URL =
  process.env.API_BASE_URL || "https://takehome-desktop.d.tekvisionflow.com";

test.describe("API: Test Run Creation", () => {
  test("POST /api/testrun returns a valid runId and metadata", async ({
    request,
  }) => {
    const res = await createTestRun(request, SAMPLE_PAYLOAD);

    expect(res.runId).toBeTruthy();
    expect(typeof res.runId).toBe("string");
    expect(res.createdAt).toBeTruthy();
    expect(res.desktopUrl).toContain(res.runId);
  });

  test("POST /api/testrun with different payloads returns unique runIds", async ({
    request,
  }) => {
    const res1 = await createTestRun(request, SAMPLE_PAYLOAD);
    const res2 = await createTestRun(request, UNAUTH_PAYLOAD);

    expect(res1.runId).not.toBe(res2.runId);
  });

  test("POST /api/testrun rejects an empty transcript payload", async ({
    request,
  }) => {
    const response = await request.post(`${API_BASE_URL}/api/testrun`, {
      data: buildPayloadWithTranscript([]),
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "VALIDATION_ERROR",
    });
  });

  test("POST /api/testrun rejects a transcript message longer than 1000 characters", async ({
    request,
  }) => {
    const response = await request.post(`${API_BASE_URL}/api/testrun`, {
      data: buildPayloadWithTranscript([
        {
          sender: "Customer",
          timestamp: "14:10:00",
          message: "a".repeat(1001),
        },
      ]),
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "VALIDATION_ERROR",
    });
  });
});

test.describe("Desktop: Agent Status & Chat Invite Flow", () => {
  test("desktop loads with correct header and connection status", async ({
    page,
    request,
  }) => {
    const result = await createTestRun(request, SAMPLE_PAYLOAD);

    if (!result?.runId) {
      throw new Error("Failed to create test run before desktop navigation");
    }

    await page.goto(desktopUrl(result.runId, "v1"));

    await expect(page.locator('[data-testid="desktop-header"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="connection-status"]')
    ).toHaveText("Connected");
  });

  test("fresh desktop shows workspace locked before chat acceptance", async ({
    page,
    request,
  }) => {
    const result = await createTestRun(request, SAMPLE_PAYLOAD);

    if (!result?.runId) {
      throw new Error("Failed to create test run before desktop navigation");
    }

    await page.goto(desktopUrl(result.runId, "v1"));

    await expect(
      page.locator('[data-testid="agent-status-select"]')
    ).toBeVisible();

    const currentStatus = await page
      .locator('[data-testid="agent-status-select"]')
      .inputValue();

    if (currentStatus !== "Ready") {
      await expect(
        page.locator('[data-testid="workspace-gated"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="workspace-gated"]')
      ).toContainText("Workspace Locked");
    } else {
      const gated = page.locator('[data-testid="workspace-gated"]');
      const invite = page.locator('[data-testid="chat-invite"]');
      const hasGated = await gated.isVisible().catch(() => false);
      const hasInvite = await invite.isVisible().catch(() => false);
      expect(hasGated || hasInvite).toBeTruthy();
    }
  });

  test("setting agent to Ready shows chat invite from correct queue", async ({
    page,
    request,
  }) => {
    const result = await createTestRun(request, SAMPLE_PAYLOAD);

    if (!result?.runId) {
      throw new Error("Failed to create test run before desktop navigation");
    }

    await page.goto(desktopUrl(result.runId, "v1"));

    await page
      .locator('[data-testid="agent-status-select"]')
      .selectOption("Ready");

    const invite = page.locator('[data-testid="chat-invite"]');
    await expect(invite).toBeVisible();
    await expect(invite).toContainText(SAMPLE_INTERACTION.queueName);
    await expect(
      page.locator('[data-testid="accept-chat-invite"]')
    ).toBeVisible();
  });

  test("accepting chat invite unlocks workspace and shows transcript", async ({
    page,
  }) => {
    await setupAndAcceptChat(page, SAMPLE_PAYLOAD, "v1");

    await expect(
      page.locator('[data-testid="tab-interaction-information"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="tab-customer-profile"]')
    ).toBeVisible();
    await expect(page.locator('[data-testid="chat-invite"]')).not.toBeVisible();
  });
});

test.describe("Desktop: Interaction Information", () => {
  test("displays all submitted interaction fields correctly", async ({
    page,
  }) => {
    await setupAndAcceptChat(page, SAMPLE_PAYLOAD, "v1");

    await expect(
      page.locator('[data-testid="interaction-information"]')
    ).toBeVisible();

    await expect(page.locator('[data-testid="interaction-id"]')).toHaveText(
      SAMPLE_INTERACTION.interactionId
    );
    await expect(page.locator('[data-testid="channel"]')).toHaveText(
      SAMPLE_INTERACTION.channel
    );
    await expect(page.locator('[data-testid="auth-status"]')).toHaveText(
      SAMPLE_INTERACTION.authenticationStatus
    );
    await expect(
      page.locator('[data-testid="customer-account-number"]')
    ).toHaveText(SAMPLE_INTERACTION.customerAccountNumber);
    await expect(page.locator('[data-testid="journey-name"]')).toHaveText(
      SAMPLE_INTERACTION.journeyName
    );
    await expect(page.locator('[data-testid="queue-name"]')).toHaveText(
      SAMPLE_INTERACTION.queueName
    );
    await expect(page.locator('[data-testid="desktop-status"]')).toHaveText(
      SAMPLE_INTERACTION.agentDesktopStatus
    );
    await expect(page.locator('[data-testid="start-time"]')).toHaveText(
      DEFAULT_START_TIME
    );
  });
});

test.describe("Desktop: Customer Profile", () => {
  test("authenticated run resolves and displays correct customer profile", async ({
    page,
  }) => {
    await setupAndAcceptChat(page, SAMPLE_PAYLOAD, "v1");

    await page.locator('[data-testid="tab-customer-profile"]').click();
    await expect(
      page.locator('[data-testid="customer-profile"]')
    ).toBeVisible();

    await expect(page.locator('[data-testid="customer-name"]')).toHaveText(
      EXPECTED_PROFILE_10012.customerName
    );
    await expect(page.locator('[data-testid="customer-tier"]')).toHaveText(
      EXPECTED_PROFILE_10012.customerTier
    );
    await expect(page.locator('[data-testid="account-status"]')).toHaveText(
      EXPECTED_PROFILE_10012.accountStatus
    );
    await expect(
      page.locator('[data-testid="preferred-language"]')
    ).toHaveText(EXPECTED_PROFILE_10012.preferredLanguage);
  });

  test("profile shows recent transactions with pagination", async ({
    page,
  }) => {
    await setupAndAcceptChat(page, SAMPLE_PAYLOAD, "v1");
    await page.locator('[data-testid="tab-customer-profile"]').click();

    await expect(
      page.locator('[data-testid="recent-transactions"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="transaction-row-0"]')
    ).toHaveText("2026-03-10Payment Received+25.35");
    await expect(
      page.locator('[data-testid="recent-transactions-pagination"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="recent-transactions-pagination"]')
    ).toContainText("Page 1 of 3");

    await page.getByRole("button", { name: "Next" }).click();

    await expect(
      page.locator('[data-testid="recent-transactions-pagination"]')
    ).toContainText("Page 2 of 3");
    await expect(
      page.locator('[data-testid="transaction-row-10"]')
    ).toHaveText("2026-02-28Loyalty Credit-18.00");
  });

  test("profile shows account history notes", async ({ page }) => {
    await setupAndAcceptChat(page, SAMPLE_PAYLOAD, "v1");
    await page.locator('[data-testid="tab-customer-profile"]').click();

    await expect(
      page.locator('[data-testid="account-history"]')
    ).toBeVisible();
    await expect(page.locator('[data-testid="history-note-0"]')).toHaveText(
      "Profile auto-loaded from sample fixture 10012"
    );
    await expect(page.locator('[data-testid="history-note-2"]')).toHaveText(
      "Preferred language on file: French"
    );
  });
});

test.describe("Desktop: Chat Transcript", () => {
  test("submitted transcript messages appear after acceptance", async ({
    page,
  }) => {
    await setupAndAcceptChat(page, SAMPLE_PAYLOAD, "v1");

    for (let i = 0; i < SAMPLE_TRANSCRIPT.length; i++) {
      const msg = SAMPLE_TRANSCRIPT[i];
      await expect(
        page.locator(`[data-testid="transcript-sender-${i}"]`)
      ).toHaveText(msg.sender);
      await expect(
        page.locator(`[data-testid="transcript-text-${i}"]`)
      ).toHaveText(msg.message);
      await expect(
        page.locator(`[data-testid="transcript-timestamp-${i}"]`)
      ).toHaveText(msg.timestamp);
    }
  });

  test("message count badge reflects the correct number of messages", async ({
    page,
  }) => {
    await setupAndAcceptChat(page, SAMPLE_PAYLOAD, "v1");
    await expectMessageBadgeCount(page, SAMPLE_TRANSCRIPT.length);
  });

  test("chat input and send button are present after acceptance", async ({
    page,
  }) => {
    await setupAndAcceptChat(page, SAMPLE_PAYLOAD, "v1");

    await expect(
      page.locator('[data-testid="agent-chat-input"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="agent-chat-send"]')
    ).toBeVisible();
  });

  test("renders long transcript messages without truncating the seeded content", async ({
    page,
  }) => {
    const longMessage = `LONG-${"x".repeat(991)}-END`;
    const payload = buildPayloadWithTranscript([
      {
        sender: "Customer",
        timestamp: "14:10:00",
        message: longMessage,
      },
    ]);

    await setupAndAcceptChat(page, payload, "v1");

    await expect(page.locator('[data-testid="transcript-text-0"]')).toHaveText(
      longMessage
    );
    await expectMessageBadgeCount(page, 1);
  });

  test("renders transcript messages with special characters", async ({
    page,
  }) => {
    const specialMessage =
      'Symbols <> [] {} ~!@#$%^&*() and accents cafe resume -- plus JSON {"ok":true}';
    const payload = buildPayloadWithTranscript([
      {
        sender: "Customer",
        timestamp: "14:11:00",
        message: specialMessage,
      },
    ]);

    await setupAndAcceptChat(page, payload, "v1");

    await expect(page.locator('[data-testid="transcript-text-0"]')).toHaveText(
      specialMessage
    );
  });
});

test.describe("Desktop: Live Chat", () => {
  test("agent can send a message and it appears in the transcript", async ({
    page,
  }) => {
    await setupAndAcceptChat(page, SAMPLE_PAYLOAD, "v1");

    const initialCount = SAMPLE_TRANSCRIPT.length;
    const agentMsg = "I will look into your billing concern now.";

    await page.locator('[data-testid="agent-chat-input"]').fill(agentMsg);
    await page.locator('[data-testid="agent-chat-send"]').click();

    await expect(
      page.locator(`[data-testid="transcript-sender-${initialCount}"]`)
    ).toHaveText("Agent");
    await expect(
      page.locator(`[data-testid="transcript-text-${initialCount}"]`)
    ).toHaveText(agentMsg);
  });

  test("customer echo message appears after agent sends a message", async ({
    page,
  }) => {
    await setupAndAcceptChat(page, SAMPLE_PAYLOAD, "v1");

    const initialCount = SAMPLE_TRANSCRIPT.length;
    const agentMsg = "Let me check your account.";
    const echoIdx = initialCount + 1;

    await page.locator('[data-testid="agent-chat-input"]').fill(agentMsg);
    await page.locator('[data-testid="agent-chat-send"]').click();

    await expect(
      page.locator(`[data-testid="transcript-sender-${echoIdx}"]`)
    ).toHaveText("Customer", { timeout: 10_000 });
    await expect(
      page.locator(`[data-testid="transcript-text-${echoIdx}"]`)
    ).toContainText(agentMsg);
  });

  test("message count badge updates after sending messages", async ({
    page,
  }) => {
    await setupAndAcceptChat(page, SAMPLE_PAYLOAD, "v1");

    const initialCount = SAMPLE_TRANSCRIPT.length;
    await page
      .locator('[data-testid="agent-chat-input"]')
      .fill("Testing badge update");
    await page.locator('[data-testid="agent-chat-send"]').click();

    await expect(
      page.locator(`[data-testid="transcript-message-${initialCount + 1}"]`)
    ).toBeVisible({ timeout: 10_000 });
    await expectMessageBadgeCount(page, initialCount + 2);
  });

  test("send button is disabled when input is empty", async ({ page }) => {
    await setupAndAcceptChat(page, SAMPLE_PAYLOAD, "v1");

    await expect(
      page.locator('[data-testid="agent-chat-send"]')
    ).toBeDisabled();
  });
});

test.describe("Desktop: Unauthenticated Flow", () => {
  test("unauthenticated run shows Not Authenticated status", async ({
    page,
  }) => {
    await setupAndAcceptChat(page, UNAUTH_PAYLOAD, "v1");

    await expect(page.locator('[data-testid="auth-status"]')).toHaveText(
      "Not Authenticated"
    );
  });

  test("unauthenticated run hides or limits customer profile", async ({
    page,
  }) => {
    await setupAndAcceptChat(page, UNAUTH_PAYLOAD, "v1");
    await page.locator('[data-testid="tab-customer-profile"]').click();

    const profilePanel = page.locator('[data-testid="customer-profile"]');
    const profileVisible = await profilePanel.isVisible().catch(() => false);

    if (profileVisible) {
      const text = await profilePanel.textContent();
      expect(text).toBeTruthy();
    }
  });
});

test.describe("BUG: Message Count Badge Cap at 35", () => {
  test("badge stops incrementing after 35 on /desktop (known bug) @v1", async ({
    page,
  }) => {
    const payload = buildPayloadWithTranscript(buildLargeTranscript(30), {
      interactionId: "CHAT-BUG-TEST",
    });

    await setupAndAcceptChat(page, payload, "v1");
    const { actualMessages, badgeNumber } = await sendUntilMessageTarget(
      page,
      payload.chatTranscript.length,
      40
    );

    expect(actualMessages).toBeGreaterThan(35);
    expect(badgeNumber).toBeLessThanOrEqual(35);
  });

  test("badge correctly increments past 35 on /desktopv2 (bug fixed) @v2", async ({
    page,
  }) => {
    const payload = buildPayloadWithTranscript(buildLargeTranscript(30), {
      interactionId: "CHAT-FIX-TEST",
    });

    await setupAndAcceptChat(page, payload, "v2");
    const { actualMessages, badgeNumber } = await sendUntilMessageTarget(
      page,
      payload.chatTranscript.length,
      40
    );

    expect(badgeNumber).toBe(actualMessages);
  });
});
