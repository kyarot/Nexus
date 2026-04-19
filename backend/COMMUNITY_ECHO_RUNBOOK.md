# Community Echo Runbook

## Scope
This runbook covers the Community Echo workflow:
- Dynamic dashboard and analytics
- Gemini draft generation
- Coordinator edit-and-schedule flow
- Dummy SMS dispatch processing
- Public feedback capture from tracking page
- Retention cleanup for phone/contact and feedback data

## Data Collections
- `communityEchoCampaigns`: campaign metadata and status
- `communityEchoRecipients`: recipient snapshots per campaign (hashed + masked only)
- `communityEchoContacts`: secure contact graph (hashed + masked only)
- `communityEchoDispatchLogs`: dummy SMS dispatch logs
- `communityEchoResponses`: public feedback submissions

## API Operations
- `GET /coordinator/community-echo/overview`
- `POST /coordinator/community-echo/draft/generate`
- `POST /coordinator/community-echo/campaigns/schedule`
- `POST /coordinator/community-echo/campaigns/dispatch-due`
- `GET /coordinator/community-echo/responses`
- `POST /coordinator/community-echo/cleanup`
- `POST /public/community-voice/feedback`

## Dispatch Flow (Dummy SMS)
1. Coordinator schedules campaign with edited draft.
2. Campaign stores recipients resolved from mission + zone links.
3. Dispatch processor sends through `dummy-static` adapter (no external SMS provider).
4. Status is updated to `sent`, `partial`, or `failed`.
5. Retry behavior is controlled via `dispatchAttempts` (max 3).

## Retention Policy
Retention is controlled by `COMMUNITY_ECHO_RETENTION_WEEKS` in backend config.
- Contacts, feedback, campaigns, dispatch logs, and recipient snapshots are purged after expiry.
- Cleanup is invoked automatically by overview and dispatch operations.
- Manual cleanup endpoint is available for operational recovery.

## Operational Checks
- Dashboard loads: verify `GET /coordinator/community-echo/overview`
- Draft generation works: verify Gemini API key and `POST /draft/generate`
- Campaign dispatch works: verify `POST /campaigns/dispatch-due`
- Feedback loop works: verify `POST /public/community-voice/feedback`
- Retention works: run `POST /coordinator/community-echo/cleanup` and inspect deletion counts

## Incident Triage
- Draft generation failure:
  - Check Gemini API key and quota.
  - System falls back to deterministic template draft.
- Campaign not sent:
  - Inspect `communityEchoCampaigns.status` and `sendAt`.
  - Run dispatch endpoint manually.
  - Inspect `communityEchoDispatchLogs` and `dispatchAttempts`.
- Missing audience:
  - Validate mission-to-report linkage (`sourceReportIds`, `missionId`, `zoneId`).
  - Confirm recipients contain `publicPhoneHash` in reports.
- Feedback not visible:
  - Validate reference + phone verification on public track page.
  - Confirm feedback docs in `communityEchoResponses` for same `ngoId`.
