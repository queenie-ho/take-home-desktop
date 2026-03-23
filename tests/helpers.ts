import { readFileSync } from "node:fs";
import * as path from "node:path";

import { APIRequestContext } from "@playwright/test";

const BASE_URL =
  process.env.API_BASE_URL ||
  process.env.BASE_URL ||
  "https://takehome-desktop.d.tekvisionflow.com";

export interface InteractionInfo {
  interactionId: string;
  channel: string;
  authenticationStatus: string;
  customerAccountNumber: string;
  journeyName: string;
  queueName: string;
  agentDesktopStatus: string;
  startTime: string;
}

export interface ChatMessage {
  sender: "Customer" | "Bot" | "System";
  timestamp: string;
  message: string;
}

export interface TestRunPayload {
  interactionInformation: InteractionInfo;
  chatTranscript: ChatMessage[];
}

export interface TestRunResponse {
  runId: string;
  createdAt?: string;
  desktopUrl?: string;
}

export const DEFAULT_START_TIME = "2026-03-11T10:30:00Z";

interface FixtureInteractionInfo
  extends Omit<InteractionInfo, "startTime"> {}

/**
 * Sleep helper.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const MAX_TEST_RUN_ATTEMPTS = 5;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 10_000;

function loadJsonFixture<T>(fileName: string): T {
  const fixturePath = path.join(FIXTURES_DIR, fileName);
  return JSON.parse(readFileSync(fixturePath, "utf-8")) as T;
}

function buildInteraction(
  fixture: FixtureInteractionInfo,
  overrides: Partial<InteractionInfo> = {}
): InteractionInfo {
  return {
    ...fixture,
    startTime: DEFAULT_START_TIME,
    ...overrides,
  };
}

function getRetryDelayMs(
  response: Awaited<ReturnType<APIRequestContext["post"]>>,
  attempt: number
): number {
  const retryAfterHeader = response.headers()["retry-after"];
  const retryAfterSeconds = retryAfterHeader
    ? Number.parseInt(retryAfterHeader, 10)
    : Number.NaN;

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1_000;
  }

  return Math.min(INITIAL_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
}

/**
 * Create a test run via the backend API and return the runId.
 * Retries on 429 rate-limit responses.
 */
export async function createTestRun(
  request: APIRequestContext,
  payload: TestRunPayload
): Promise<TestRunResponse> {
  for (let attempt = 0; attempt < MAX_TEST_RUN_ATTEMPTS; attempt++) {
    const response = await request.post(`${BASE_URL}/api/testrun`, {
      data: payload,
      headers: { "Content-Type": "application/json" },
    });

    if (response.status() === 429) {
      const body = await response.text();
      const delayMs = getRetryDelayMs(response, attempt);
      console.warn(
        `[429 RETRY] attempt ${attempt + 1}/${MAX_TEST_RUN_ATTEMPTS} delay=${delayMs}ms body=${body || "<empty>"}`
      );
      await sleep(delayMs);
      continue;
    }

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `Failed to create test run: ${response.status()} - ${body}`
      );
    }
    return (await response.json()) as TestRunResponse;
  }
  throw new Error(
    `Failed to create test run after ${MAX_TEST_RUN_ATTEMPTS} attempts due to repeated 429 (rate limiting). Consider increasing backoff or reducing request frequency.`
  );
}

/**
 * Build the desktop URL from a runId.
 */
export function desktopUrl(runId: string, version: "v1" | "v2" = "v1"): string {
  const path = version === "v2" ? "desktopv2" : "desktop";
  return `${BASE_URL}/${path}/${runId}`;
}

// ─── Sample Test Data ───────────────────────────────────────────────────────

const SAMPLE_INTERACTION_FIXTURE =
  loadJsonFixture<FixtureInteractionInfo>("sample-interaction.json");
const UNAUTH_INTERACTION_FIXTURE =
  loadJsonFixture<FixtureInteractionInfo>("unauth-interaction.json");

export const SAMPLE_TRANSCRIPT =
  loadJsonFixture<ChatMessage[]>("sample-transcript.json");
export const UNAUTH_TRANSCRIPT =
  loadJsonFixture<ChatMessage[]>("unauth-transcript.json");

export const SAMPLE_INTERACTION = buildInteraction(SAMPLE_INTERACTION_FIXTURE);

export const SAMPLE_PAYLOAD: TestRunPayload = {
  interactionInformation: buildInteraction(SAMPLE_INTERACTION_FIXTURE),
  chatTranscript: SAMPLE_TRANSCRIPT,
};

export const UNAUTH_INTERACTION = buildInteraction(UNAUTH_INTERACTION_FIXTURE);

export const UNAUTH_PAYLOAD: TestRunPayload = {
  interactionInformation: buildInteraction(UNAUTH_INTERACTION_FIXTURE),
  chatTranscript: UNAUTH_TRANSCRIPT,
};

// Large transcript for badge bug testing (40+ messages to exceed 35 threshold)
export function buildLargeTranscript(count: number): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (let i = 0; i < count; i++) {
    const minutes = Math.floor(i / 2);
    const seconds = (i % 2) * 30;
    const ts = `14:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    const senders: ChatMessage["sender"][] = ["Customer", "Bot", "System"];
    const sender = senders[i % 3];
    messages.push({
      sender,
      timestamp: ts,
      message: `Test message number ${i + 1} from ${sender}.`,
    });
  }
  return messages;
}

// Expected profile data for account 10012
export const EXPECTED_PROFILE_10012 = {
  customerName: "Ethan Perry",
  accountNumber: "10012",
  customerTier: "Silver",
  accountStatus: "Active",
  preferredLanguage: "French",
};
