# R&D: Strava OAuth, Activities and Rewards Risks
_Date: 2026-10-15. Official sources. Status: TECHNICAL POSSIBLE; USE-CASE AUTHORIZATION BLOCKED PENDING REVIEW._

## Summary
Strava supports web OAuth 2.0 and activity APIs for authorized users. **Technical access is not proof that the API may be used to issue rewards in virtual races, competitive challenges or merchant promotions.**

## Platform warning — material
The Strava developer homepage explicitly states it may revoke API tokens for agreement violations, **including uses enabling virtual races or competitions** and uses that replicate Strava products.
Source: https://developers.strava.com/

Before choosing any Strava-powered **distance challenge, leaderboard or external reward**, obtain a written interpretation/approval for **USKORUN's exact use case**. Do not treat an OAuth token as a grant of commercial use rights.

API Agreement: https://www.strava.com/legal/api
Rate limits / review: https://developers.strava.com/docs/rate-limits/
Developer getting started: https://developers.strava.com/docs/getting-started/
Brand guidelines: https://developers.strava.com/guidelines/

## Verified technical facts as checked on 2026-10-15
- User authorizes access through OAuth 2.0 with appropriate scopes (e.g. activity:read for eligible activities).
- New applications begin in single-player mode and must raise athlete capacity.
- Official documentation currently lists default **200 requests / 15 minutes, 2,000 / day**; upgraded starter access is separately gated.
- A Strava subscription is currently listed as required for creating a developer application.
- Above initial athlete capacity, review/approval is required; increased limits are not guaranteed.
- Strava directs use of webhooks for deauthorization/privacy changes and to avoid wasteful polling.
Do not hardcode current quotas as permanent; recheck at implementation.

## If and only if use is approved
1. Create developer app and obtain client credentials securely on server.
2. Explicit scope-specific opt in; do not require private activities or other permissions without need.
3. Use state-protected OAuth exchange, secret storage and token refresh.
4. Implement webhooks for revoke/delete/privacy changes, verify requests.
5. Minimize retrieval, process only permitted fields and enforce access control by user.
6. Disclose source and attribution; respect Strava branding.
7. Do not release user activity data to merchants. Merchant gets opaque redemption proof only, if lawful.
8. Build retries/rate-limit handling and consent deletion behavior.

## Go/no-go experiments
- Email Strava developer program with a 1-page exact description: free community run, optional partner discount, no betting, no financial contest, whether distance is validated from activity, data retained, merchant data flow.
- Receive an explicit allowance or rejection for commercial rewards use.
- Compare alternatives: supervised event verification, browser GPS, club-organizer attestations.
- Design graceful switch-off: Strava adapter disabled without affecting rewards for valid non-Strava activities.

## Decision
**Do not launch a Strava-dependent product or market it as integrated at this stage.** Legal/platform approval gate remains OPEN/BLOCKING.
