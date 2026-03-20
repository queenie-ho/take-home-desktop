# Desktop Automation Testing — Take-Home

Playwright-based UI automation for the Mock Agent Desktop application at `https://takehome-desktop.d.tekvisionflow.com`.

## Prerequisites

- Node.js 20.x, 22.x, or 24.x
- npm

## Setup

```bash
npm install
npx playwright install
```

## Running Tests

```bash
# Run all configured versions (headless)
npm test

# Run only v1
npm run test:v1

# Run only v2
npm run test:v2

# Run all configured versions explicitly
npm run test:all

# Run with visible browser
npm run test:headed

# Run in debug mode (step through)
npm run test:debug

# View HTML report after run
npm run test:report
```

### Environment Variables

| Variable   | Default                                                | Description          |
| ---------- | ------------------------------------------------------ | -------------------- |
| `API_BASE_URL` | `https://takehome-desktop.d.tekvisionflow.com`     | Backend URL and project base for desktop version routing |

## Version Strategy

- `desktop-v1` runs shared coverage plus v1-only bug assertions against `/desktop/{runId}`
- `desktop-v2` runs shared coverage plus v2-only verification against `/desktopv2/{runId}`
- Version-specific bug coverage is split into separate specs so reports and failures are isolated by version

## Test Coverage

### 1. API — Test Run Creation
- `POST /api/testrun` returns a valid `runId` and metadata
- Different payloads produce unique `runId` values

### 2. Desktop — Agent Status & Chat Invite Flow
- Desktop loads with correct header and "Connected" status
- Agent starts in "Not Ready" state with workspace locked
- Setting agent to "Ready" triggers a chat invite from the correct queue
- Accepting the invite unlocks the workspace and reveals transcript

### 3. Interaction Information Validation
- All submitted interaction fields (ID, channel, auth status, account number, journey, queue, desktop status) render correctly

### 4. Customer Profile Validation
- Authenticated run auto-resolves the correct customer profile (name, tier, status, language)
- Recent transactions display with pagination
- Account history notes are shown

### 5. Chat Transcript Validation
- Submitted transcript messages (sender, text, timestamp) appear after acceptance
- Message count badge matches the number of rendered messages
- Chat input and send button are present
- Long messages and special characters render correctly

### 5a. Transcript Validation Edge Cases
- Empty transcripts are rejected by the API with a validation error

### 6. Live Chat — Send & Echo
- Agent can type and send a message; it appears in the transcript as "Agent"
- A customer echo response appears automatically after the agent sends
- Message count badge updates after each send/echo cycle
- Send button is disabled when input is empty

### 7. Unauthenticated Scenario
- Auth status displays "Not Authenticated"
- Customer profile behavior differs for unauthenticated runs

### 8. Bug Detection — Message Count Badge
- Confirms the badge stops incrementing after 35 messages on `/desktop` (v1)
- Verifies the fix on `/desktopv2` where the badge correctly increments past 35
- Probes larger totals to confirm the v1 cap persists beyond the first threshold
- Verifies `/desktopv2` stays accurate with large seeded transcripts (70 to 100 messages)

## Bug Report

See [BUG_REPORT.md](./BUG_REPORT.md) for detailed findings.
