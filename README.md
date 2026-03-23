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
# Run all tests (headless)
npm test

# Run all tests explicitly
npm run test:all

# Run only the v1 bug verification
npm run test:v1

# Run only the v2 fix verification
npm run test:v2

# Run with visible browser
npm run test:headed

# Run a fast headed smoke test for local debugging
npm run test:debug

# Run Playwright's paused inspector mode
npm run test:pwdebug

# View HTML report after run on an auto-selected local port
npm run test:report
```

### Environment Variables

| Variable   | Default                                                | Description          |
| ---------- | ------------------------------------------------------ | -------------------- |
| `API_BASE_URL` | `https://takehome-desktop.d.tekvisionflow.com`     | Backend URL and project base for desktop version routing |

## Version Strategy

- Most coverage runs against `/desktop`
- Suite 8 uses the same badge-check logic against both `/desktop` and `/desktopv2`
- `npm run test:v1` demonstrates the bug, and `npm run test:v2` confirms the fix

## Test Coverage Summary

The following features were tested:

- Test run creation API
- Agent status and chat invite flow
- Interaction information display
- Customer profile rendering
- Chat transcript rendering
- Live chat functionality
- Transcript length validation
- Bug verification on `/desktop` and `/desktopv2`

## Results

- Most core flows function correctly
- Eight test suites were executed against the mock agent desktop
- All core flows, including API run creation, agent status handling, chat invite acceptance, interaction/profile validation, transcript verification, and live chat, passed successfully
- Three confirmed defects were identified on `/desktop`:
  - Message count badge caps at 35 messages (fixed in `/desktopv2`)
  - Chat transcript is rendered in non-chronological order
  - API accepts malformed transcript timestamps instead of rejecting them

Overall, the desktop supports the basic agent workflow, with identified issues in transcript ordering and message count accuracy.

## Test Coverage

### 1. API — Test Run Creation
- `POST /api/testrun` returns a valid `runId` and metadata
- Returned `desktopUrl` matches the created run
- Different payloads produce unique `runId` values
- Rejects transcript messages longer than 1000 characters
- Exposes malformed transcript timestamps as a known validation defect

### 2. Desktop — Agent Status & Chat Invite Flow
- Desktop loads with correct header and "Connected" status
- Agent starts in "Not Ready" state with workspace locked
- Setting agent to "Ready" triggers a chat invite from the correct queue
- Accepting the invite unlocks the workspace and reveals transcript

### 3. Interaction Information Validation
- All submitted interaction fields (ID, channel, auth status, account number, journey, queue, desktop status, start time) render correctly

### 4. Customer Profile Validation
- Authenticated run auto-resolves the correct customer profile (name, tier, status, language)
- Recent transactions display expected content and paginate correctly
- Account history notes display expected content

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

Some initial failures (e.g., missing header and agent status controls) were traced to test configuration issues and are not included as product defects. Profile and transcript correctness is validated through the desktop UI directly.

During exploratory testing, additional observations were noted: transaction amount signs in the profile fixture may appear misleading in context, and long transaction descriptions may be visually truncated in the UI. These were not included as confirmed defects because they may reflect intentional backend conventions or simplified mock behavior, but they are noted for completeness.

See [BUG_REPORT.md](./BUG_REPORT.md) for detailed findings.
