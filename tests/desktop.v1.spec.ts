import { expect, test } from "@playwright/test";

import { SAMPLE_INTERACTION, buildLargeTranscript } from "./helpers";
import {
  buildPayloadWithTranscript,
  sendUntilMessageTarget,
  setupAndAcceptChat,
} from "./desktopTestUtils";

test.describe("BUG: Message Count Badge Cap at 35 (v1)", () => {
  const largeTranscript = buildLargeTranscript(30);

  test("badge stops incrementing after 35 messages", async ({ page }) => {
    const payload = buildPayloadWithTranscript(largeTranscript, {
      ...SAMPLE_INTERACTION,
      interactionId: "CHAT-BUG-TEST",
    });

    await setupAndAcceptChat(page, payload);
    const { actualMessages, badgeNumber } = await sendUntilMessageTarget(
      page,
      largeTranscript.length,
      40
    );

    expect(actualMessages).toBeGreaterThan(35);
    expect(badgeNumber).toBeLessThanOrEqual(35);
  });

  test("badge still caps when the transcript grows far beyond the first threshold", async ({
    page,
  }) => {
    const payload = buildPayloadWithTranscript(buildLargeTranscript(34), {
      interactionId: "CHAT-BUG-70",
    });

    await setupAndAcceptChat(page, payload);
    const { actualMessages, badgeNumber } = await sendUntilMessageTarget(
      page,
      34,
      70
    );

    expect(actualMessages).toBeGreaterThanOrEqual(70);
    expect(badgeNumber).toBeLessThanOrEqual(35);
  });
});
