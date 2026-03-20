import { expect, test } from "@playwright/test";

import { buildLargeTranscript } from "./helpers";
import {
  buildPayloadWithTranscript,
  expectMessageBadgeCount,
  sendUntilMessageTarget,
  setupAndAcceptChat,
} from "./desktopTestUtils";

test.describe("BUG: Message Count Badge Cap at 35 (v2)", () => {
  const largeTranscript = buildLargeTranscript(30);

  test("badge correctly increments past 35 messages", async ({ page }) => {
    const payload = buildPayloadWithTranscript(largeTranscript, {
      interactionId: "CHAT-FIX-TEST",
    });

    await setupAndAcceptChat(page, payload);
    const { actualMessages, badgeNumber } = await sendUntilMessageTarget(
      page,
      largeTranscript.length,
      40
    );

    expect(badgeNumber).toBe(actualMessages);
  });

  test("keeps the badge accurate for large seeded transcripts", async ({
    page,
  }) => {
    const transcript = buildLargeTranscript(100);
    const payload = buildPayloadWithTranscript(transcript, {
      interactionId: "CHAT-V2-100",
    });

    await setupAndAcceptChat(page, payload);
    await expectMessageBadgeCount(page, transcript.length);
  });
});
