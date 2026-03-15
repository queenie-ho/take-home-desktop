import { APIRequestContext } from "@playwright/test";

const BASE_URL =
  process.env.BASE_URL || "https://takehome-desktop.d.tekvisionflow.com";

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

/**
 * Sleep helper.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Create a test run via the backend API and return the runId.
 * Retries on 429 rate-limit responses.
 */
export async function createTestRun(
  request: APIRequestContext,
  payload: TestRunPayload
): Promise<TestRunResponse> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await request.post(`${BASE_URL}/api/testrun`, {
      data: payload,
      headers: { "Content-Type": "application/json" },
    });

    if (response.status() === 429) {
      await sleep(3000 * (attempt + 1));
      continue;
    }

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `Failed to create test run: ${response.status()} - ${body}`
      );
    }

    return response.json();
  }
  throw new Error("Failed to create test run after 5 attempts (rate limited)");
}

/**
 * Build the desktop URL from a runId.
 */
export function desktopUrl(runId: string, version: "v1" | "v2" = "v1"): string {
  const path = version === "v2" ? "desktopv2" : "desktop";
  return `${BASE_URL}/${path}/${runId}`;
}

// ─── Sample Test Data ───────────────────────────────────────────────────────

export const SAMPLE_INTERACTION: InteractionInfo = {
  interactionId: "CHAT-10001",
  channel: "Chat",
  authenticationStatus: "Authenticated",
  customerAccountNumber: "10012",
  journeyName: "Billing Support",
  queueName: "Billing Tier 1",
  agentDesktopStatus: "Connected",
  startTime: new Date().toISOString(),
};

export const SAMPLE_TRANSCRIPT: ChatMessage[] = [
  {
    sender: "Customer",
    timestamp: "14:00:00",
    message: "Can you confirm whether my latest payment was applied correctly?",
  },
  {
    sender: "Bot",
    timestamp: "14:00:42",
    message: "Let me review the payment details shown in the desktop.",
  },
  {
    sender: "System",
    timestamp: "14:00:50",
    message: "System note appended to the active workspace.",
  },
  {
    sender: "Customer",
    timestamp: "14:02:15",
    message: "Can you check whether my service request was completed?",
  },
  {
    sender: "Bot",
    timestamp: "14:03:00",
    message: "I will review the recent notes and transactions for you.",
  },
];

export const SAMPLE_PAYLOAD: TestRunPayload = {
  interactionInformation: SAMPLE_INTERACTION,
  chatTranscript: SAMPLE_TRANSCRIPT,
};

// Unauthenticated scenario
export const UNAUTH_INTERACTION: InteractionInfo = {
  interactionId: "CHAT-20001",
  channel: "Chat",
  authenticationStatus: "Not Authenticated",
  customerAccountNumber: "",
  journeyName: "General Inquiry",
  queueName: "General Tier 1",
  agentDesktopStatus: "Connected",
  startTime: new Date().toISOString(),
};

export const UNAUTH_PAYLOAD: TestRunPayload = {
  interactionInformation: UNAUTH_INTERACTION,
  chatTranscript: [
    {
      sender: "Customer",
      timestamp: "14:00:00",
      message: "I have a question about your services.",
    },
    {
      sender: "Bot",
      timestamp: "14:00:30",
      message: "I can help with general inquiries.",
    },
  ],
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
