# Desktop Automation Testing — Take-Home

Playwright-based UI automation for the Mock Agent Desktop application at `https://takehome-desktop.d.tekvisionflow.com`.

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm install
npx playwright install
```

## Running Tests

```bash
# Run all tests (headless)
npm test

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
| `BASE_URL` | `https://takehome-desktop.d.tekvisionflow.com`         | Backend/frontend URL |

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

## Bug Report

See [BUG_REPORT.md](./BUG_REPORT.md) for detailed findings.
