# Bug Report

## Bug 1: Message Count Badge Stops Incrementing After 35 Messages

**Severity:** Medium
**Component:** Chat Interaction Window — message count badge
**Affected URL:** `/desktop/{runId}`
**Fixed in:** `/desktopv2/{runId}`

### Steps to Reproduce

1. Create a test run via `POST /api/testrun` with a chat transcript containing 30+ messages.
2. Open `/desktop/{runId}` in the browser.
3. Set Agent Status to **Ready**.
4. Click **Accept Chat** to accept the incoming invite.
5. Send additional agent messages using the chat input to push the total message count past 35.
6. Observe the message count badge in the chat panel heading (e.g., "35 messages").

### Expected Result

The badge should display the actual total number of messages in the transcript. For example, if 40 messages are visible in the chat window, the badge should read **"40 messages"**.

### Actual Result

The badge stops incrementing at **35 messages** even though additional messages continue to appear in the chat window. After 35, the badge remains stuck at "35 messages" regardless of how many more are added.

### Verification

- The same test run opened on `/desktopv2/{runId}` correctly shows the badge incrementing past 35, confirming the fix.
- Additional automation now probes larger totals and shows the v1 badge remains capped even when the transcript grows well past the first threshold, while `/desktopv2` stays accurate for larger seeded transcripts.

### Investigation Notes

- The failure pattern points to a hard-coded client-side cap or page-size-derived counter in `/desktop`, not to missing transcript data from the backend.
- This is an inference from black-box behavior: messages continue rendering after the badge stops, and `/desktopv2` on the same backend data does not show the cap.
- The repository does not contain the application source for `/desktop`, so the exact root cause cannot be proven here; the automation now narrows the fault to the v1 client implementation.

---

## Summary

| # | Bug                              | Status on `/desktop` | Status on `/desktopv2` |
|---|----------------------------------|----------------------|------------------------|
| 1 | Badge caps at 35 messages        | Reproducible         | Fixed                  |
