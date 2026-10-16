# Architecture Decision Record: Web-first USKORUN MVP
_Date: 2026-10-15. Status: PROPOSED, not implemented._

## Goals
Ship the smallest safe test of the **club-event → earned offer → merchant redemption → repeat run** cycle, while deferring native wellness integrations and complex payment flows.

## Logical topology
~~~text
Runner mobile browser/PWA  ---- HTTPS ---->  USKORUN Web frontend
Club organizer portal      ---- HTTPS ---->  Backend API / Auth / RBAC
Merchant redemption app    ---- HTTPS ---->    |
                                                  +-- Challenge & eligibility rules
                                                  +-- Verification adapter boundary
                                                  +-- Reward issue and redemption service
                                                  +-- Consent/audit/privacy workflow
                                                  +-- Partner campaign reporting
                                                  +-- Relational database
Optional future adapters:
  [supervised event check-in]  -> allowed at launch
  [foreground browser GPS]     -> optional low-stakes experiment
  [Strava API]                 -> gated by provider permission
  [native Apple HealthKit]     -> not web; gated by Apple policies and native app
~~~

## Stack candidates — choose based on team capabilities
- Frontend: Next.js / React mobile-responsive pages; optional PWA install.
- Backend: TypeScript API with RBAC, clean adapter interface and rate limits.
- Data: managed PostgreSQL with migrations; transactional reward redemption.
- Auth: managed provider with email link/passkey; operator MFA.
- Hosting: managed cloud with TLS, backups and secret vault.
- Analytics: aggregate privacy-aware event measurements with stable funnel names.
This is a **reference design**, not a mandate to select vendors today.

## Suggested API boundaries
- POST /challenges/{id}/enroll
- POST /events/{id}/check-in (organizer authenticated)
- POST /verifications/{id}/attest (attester + rules)
- POST /claims (idempotent; server validates eligibility)
- POST /merchant/redeem (merchant auth; atomic state transition)
- GET /merchant/campaigns/{id}/summary (aggregated; no health trace)
- POST /consent/withdraw ; DELETE /account (privacy workflow)
All POST actions use server-side authorization, CSRF or token protections as appropriate and idempotency keys for side effects.

## State machines
Enrollment: invited → joined → attended → qualified/manual_review/rejected.
Reward: eligible → issued → redeemed / expired / revoked.
Offer: draft → approved → active → paused / depleted / completed.
Never downgrade a redeemed reward with a silent asynchronous edit; use auditable refund/reversal events.

## Engineering safeguards
- QR tokens should be unguessable server-generated references, not encoded user IDs.
- Redemption is one database transaction with uniqueness constraint on reward redemption and cap enforcement.
- Merchant staff accounts are scoped to their own locations.
- Immutable append-only event records for issuance/redemption audit.
- Separate business analytics from any future fitness/workout data domain.
- Default no raw route storage; process on device where possible.
- Explicit retention and deletion schedule for logs and evidence.
- Staging + test environment + synthetic test accounts. No keys in GitHub.

## QA tests
- Two simultaneous merchants try same QR: only first redemption succeeds.
- Spoofed merchant cannot redeem for another location.
- A user with refused location permission still completes attendance-based event.
- Organizer withdrawal, event cancellation and duplicate check-in are handled correctly.
- Expired offer and empty inventory cannot create new entitlements.

## Build-vs-buy checkpoints
Evaluate hosted auth, QR validation, partner dashboards and transactional email providers only after checking data privacy and costs. Avoid building a bespoke GPS tracker.
