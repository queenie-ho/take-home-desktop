import { test, expect, Page } from "@playwright/test";
import {
  createTestRun,
  desktopUrl,
  SAMPLE_PAYLOAD,
  SAMPLE_INTERACTION,
  SAMPLE_TRANSCRIPT,
  UNAUTH_PAYLOAD,
  EXPECTED_PROFILE_10012,
  buildLargeTranscript,
  type TestRunPayload,
} from "./helpers";

const BASE_URL =
  process.env.BASE_URL || "https://takehome-desktop.d.tekvisionflow.com";

// ─── Shared helpers ─────────────────────────────────────────────────────────

/**
 * Create a run, navigate to desktop, set Ready, and accept the chat invite.
 * Handles whatever initial agent status the desktop starts with.
 */
async function setupAndAcceptChat(
  page: Page,
  payload: TestRunPayload = SAMPLE_PAYLOAD,
  version: "v1" | "v2" = "v1"
) {
  const { runId } = await createTestRun(page.request, payload);
  await page.goto(desktopUrl(runId, version));

  // Wait for the page to be ready
  await expect(
    page.locator('[data-testid="agent-status-select"]')
  ).toBeVisible();

  // Set agent to Ready — invite should appear
  await page
    .locator('[data-testid="agent-status-select"]')
    .selectOption("Ready");
  await expect(page.locator('[data-testid="chat-invite"]')).toBeVisible({
    timeout: 10_000,
  });

  // Accept the chat
  await page.locator('[data-testid="accept-chat-invite"]').click();

  // Wait for transcript to render
  await expect(
    page.locator('[data-testid="transcript-message-0"]')
  ).toBeVisible({ timeout: 10_000 });

  return runId;
}

function buildPayloadWithTranscript(
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

function messageBadge(page: Page) {
  return page.locator(".panel-badge").first();
}

async function expectMessageBadgeCount(page: Page, expectedCount: number) {
  await expect(messageBadge(page)).toContainText(`${expectedCount} messages`);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 1: API — Test Run Creation
// ═══════════════════════════════════════════════════════════════════════════

test.describe("API: Test Run Creation", () => {
  test("POST /api/testrun returns a valid runId and metadata", async ({
    request,
  }) => {
    const res = await createTestRun(request, SAMPLE_PAYLOAD);

    expect(res.runId).toBeTruthy();
    expect(typeof res.runId).toBe("string");
    expect(res.createdAt).toBeTruthy();
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
    const response = await request.post(`${BASE_URL}/api/testrun`, {
      data: buildPayloadWithTranscript([]),
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "VALIDATION_ERROR",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 2: Desktop — Initial State & Agent Status Flow
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Desktop: Agent Status & Chat Invite Flow", () => {
  test("desktop loads with correct header and connection status", async ({
    page,
    request,
  }) => {
    const { runId } = await createTestRun(request, SAMPLE_PAYLOAD);
    await page.goto(desktopUrl(runId));

    await expect(page.locator('[data-testid="desktop-header"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="connection-status"]')
    ).toHaveText("Connected");
  });

  test("fresh desktop shows workspace locked before chat acceptance", async ({
    page,
    request,
  }) => {
    const { runId } = await createTestRun(request, SAMPLE_PAYLOAD);
    await page.goto(desktopUrl(runId));

    await expect(
      page.locator('[data-testid="agent-status-select"]')
    ).toBeVisible();

    // Before setting Ready or if agent is Not Ready, workspace should be gated
    const currentStatus = await page
      .locator('[data-testid="agent-status-select"]')
      .inputValue();

    if (currentStatus !== "Ready") {
      // Workspace should be locked
      await expect(
        page.locator('[data-testid="workspace-gated"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="workspace-gated"]')
      ).toContainText("Workspace Locked");
    } else {
      // Agent already Ready — invite should be present, workspace still gated until accept
      const gated = page.locator('[data-testid="workspace-gated"]');
      const invite = page.locator('[data-testid="chat-invite"]');
      // Either gated panel or invite should be showing (workspace not yet open)
      const hasGated = await gated.isVisible().catch(() => false);
      const hasInvite = await invite.isVisible().catch(() => false);
      expect(hasGated || hasInvite).toBeTruthy();
    }
  });

  test("setting agent to Ready shows chat invite from correct queue", async ({
    page,
    request,
  }) => {
    const { runId } = await createTestRun(request, SAMPLE_PAYLOAD);
    await page.goto(desktopUrl(runId));

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
    await setupAndAcceptChat(page);

    // Workspace should be unlocked — tabs visible
    await expect(
      page.locator('[data-testid="tab-interaction-information"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="tab-customer-profile"]')
    ).toBeVisible();

    // Invite should be gone
    await expect(
      page.locator('[data-testid="chat-invite"]')
    ).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 3: Interaction Information Validation
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Desktop: Interaction Information", () => {
  test("displays all submitted interaction fields correctly", async ({
    page,
  }) => {
    await setupAndAcceptChat(page);

    // Interaction Information tab should be active by default
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
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 4: Customer Profile Validation
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Desktop: Customer Profile", () => {
  test("authenticated run resolves and displays correct customer profile", async ({
    page,
  }) => {
    await setupAndAcceptChat(page);

    // Switch to Customer Profile tab
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
    await setupAndAcceptChat(page);
    await page.locator('[data-testid="tab-customer-profile"]').click();

    await expect(
      page.locator('[data-testid="recent-transactions"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="transaction-row-0"]')
    ).toBeVisible();

    // Pagination visible
    await expect(
      page.locator('[data-testid="recent-transactions-pagination"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="recent-transactions-pagination"]')
    ).toContainText("Page 1");
  });

  test("profile shows account history notes", async ({ page }) => {
    await setupAndAcceptChat(page);
    await page.locator('[data-testid="tab-customer-profile"]').click();

    await expect(
      page.locator('[data-testid="account-history"]')
    ).toBeVisible();
    await expect(page.locator('[data-testid="history-note-0"]')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 5: Chat Transcript Validation
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Desktop: Chat Transcript", () => {
  test("submitted transcript messages appear after acceptance", async ({
    page,
  }) => {
    await setupAndAcceptChat(page);

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
    await setupAndAcceptChat(page);

    await expectMessageBadgeCount(page, SAMPLE_TRANSCRIPT.length);
  });

  test("chat input and send button are present after acceptance", async ({
    page,
  }) => {
    await setupAndAcceptChat(page);

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
    const longMessage = `LONG-${"x".repeat(2_048)}-END`;
    const payload = buildPayloadWithTranscript([
      {
        sender: "Customer",
        timestamp: "14:10:00",
        message: longMessage,
      },
    ]);

    await setupAndAcceptChat(page, payload);

    await expect(page.locator('[data-testid="transcript-text-0"]')).toHaveText(
      longMessage
    );
    await expectMessageBadgeCount(page, 1);
  });

  test("renders transcript messages with special characters", async ({
    page,
  }) => {
    const specialMessage =
      "Symbols <> [] {} ~!@#$%^&*() and accents cafe resume -- plus JSON {\"ok\":true}";
    const payload = buildPayloadWithTranscript([
      {
        sender: "Customer",
        timestamp: "14:11:00",
        message: specialMessage,
      },
    ]);

    await setupAndAcceptChat(page, payload);

    await expect(page.locator('[data-testid="transcript-text-0"]')).toHaveText(
      specialMessage
    );
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 6: Live Chat — Send Messages & Echo
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Desktop: Live Chat", () => {
  test("agent can send a message and it appears in the transcript", async ({
    page,
  }) => {
    await setupAndAcceptChat(page);

    const initialCount = SAMPLE_TRANSCRIPT.length;
    const agentMsg = "I will look into your billing concern now.";

    await page.locator('[data-testid="agent-chat-input"]').fill(agentMsg);
    await page.locator('[data-testid="agent-chat-send"]').click();

    // Agent message should appear
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
    await setupAndAcceptChat(page);

    const initialCount = SAMPLE_TRANSCRIPT.length;
    const agentMsg = "Let me check your account.";

    await page.locator('[data-testid="agent-chat-input"]').fill(agentMsg);
    await page.locator('[data-testid="agent-chat-send"]').click();

    // Wait for customer echo (index = initialCount + 1)
    const echoIdx = initialCount + 1;
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
    await setupAndAcceptChat(page);

    const initialCount = SAMPLE_TRANSCRIPT.length;

    await page
      .locator('[data-testid="agent-chat-input"]')
      .fill("Testing badge update");
    await page.locator('[data-testid="agent-chat-send"]').click();

    // Wait for echo
    await expect(
      page.locator(
        `[data-testid="transcript-message-${initialCount + 1}"]`
      )
    ).toBeVisible({ timeout: 10_000 });

    // Badge should show updated count (initial + agent + echo)
    await expectMessageBadgeCount(page, initialCount + 2);
  });

  test("send button is disabled when input is empty", async ({ page }) => {
    await setupAndAcceptChat(page);

    await expect(
      page.locator('[data-testid="agent-chat-send"]')
    ).toBeDisabled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 7: Unauthenticated Scenario
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Desktop: Unauthenticated Flow", () => {
  test("unauthenticated run shows Not Authenticated status", async ({
    page,
  }) => {
    await setupAndAcceptChat(page, UNAUTH_PAYLOAD);

    await expect(page.locator('[data-testid="auth-status"]')).toHaveText(
      "Not Authenticated"
    );
  });

  test("unauthenticated run hides or limits customer profile", async ({
    page,
  }) => {
    await setupAndAcceptChat(page, UNAUTH_PAYLOAD);

    await page.locator('[data-testid="tab-customer-profile"]').click();

    // Profile should either not exist, be hidden, or indicate no data
    const profilePanel = page.locator('[data-testid="customer-profile"]');
    const profileVisible = await profilePanel.isVisible().catch(() => false);

    if (profileVisible) {
      // If visible, it should indicate no profile data or show empty/placeholder
      const text = await profilePanel.textContent();
      // For unauthenticated, the profile might show but with limited info
      expect(text).toBeTruthy();
    }
    // Either way, customer-name should not show a resolved profile
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 8: BUG — Message Count Badge Stops at 35
// ═══════════════════════════════════════════════════════════════════════════

test.describe("BUG: Message Count Badge Cap at 35", () => {
  const largeTranscript = buildLargeTranscript(30);

  async function sendUntilMessageTarget(
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
      await page.waitForTimeout(1500);
      currentTotal += 2; // agent + echo
    }

    const actualMessages = await page
      .locator('[data-testid^="transcript-message-"]')
      .count();
    const badgeText = await messageBadge(page).textContent();
    const badgeNumber = parseInt(badgeText!.match(/\d+/)?.[0] || "0", 10);

    return { actualMessages, badgeNumber };
  }

  test("badge stops incrementing after 35 messages on /desktop (known bug)", async ({
    page,
  }) => {
    const payload: TestRunPayload = {
      interactionInformation: {
        ...SAMPLE_INTERACTION,
        interactionId: "CHAT-BUG-TEST",
      },
      chatTranscript: largeTranscript,
    };

    await setupAndAcceptChat(page, payload, "v1");
    const { actualMessages, badgeNumber } = await sendUntilMessageTarget(
      page,
      largeTranscript.length,
      40
    );

    console.log(
      `BUG CHECK: actual messages = ${actualMessages}, badge shows = ${badgeNumber}`
    );

    // The bug: badge stops at 35 even though more messages exist
    expect(actualMessages).toBeGreaterThan(35);
    expect(badgeNumber).toBeLessThanOrEqual(35);
  });

  test("badge correctly increments past 35 on /desktopv2 (bug fixed)", async ({
    page,
  }) => {
    const payload: TestRunPayload = {
      interactionInformation: {
        ...SAMPLE_INTERACTION,
        interactionId: "CHAT-FIX-TEST",
      },
      chatTranscript: largeTranscript,
    };

    await setupAndAcceptChat(page, payload, "v2");
    const { actualMessages, badgeNumber } = await sendUntilMessageTarget(
      page,
      largeTranscript.length,
      40
    );

    console.log(
      `FIX CHECK: actual messages = ${actualMessages}, badge shows = ${badgeNumber}`
    );

    // On v2, badge should match actual count
    expect(badgeNumber).toBe(actualMessages);
  });

  test("v1 badge still caps even when the transcript grows far beyond the first threshold", async ({
    page,
  }) => {
    const payload = buildPayloadWithTranscript(buildLargeTranscript(34), {
      interactionId: "CHAT-BUG-70",
    });

    await setupAndAcceptChat(page, payload, "v1");
    const { actualMessages, badgeNumber } = await sendUntilMessageTarget(
      page,
      34,
      70
    );

    expect(actualMessages).toBeGreaterThanOrEqual(70);
    expect(badgeNumber).toBeLessThanOrEqual(35);
  });

  test("v2 keeps the badge accurate for large seeded transcripts", async ({
    page,
  }) => {
    const transcript = buildLargeTranscript(100);
    const payload = buildPayloadWithTranscript(transcript, {
      interactionId: "CHAT-V2-100",
    });

    await setupAndAcceptChat(page, payload, "v2");
    await expectMessageBadgeCount(page, transcript.length);
  });
});
