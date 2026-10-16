# R&D: Activity Verification and Anti-Fraud
_Date: 2026-10-15. Status: DESIGN HYPOTHESIS._

## Verification ≠ tracking
We need reliable **eligibility** for a specific reward, not a universal GPS platform. Methods prove different facts: attendance, route, distance, or time.

| Evidence method | What it actually proves | Spoofing risk | Pilot use |
| --- | --- | --- | --- |
| Organizer-scanned start/end check-in | Attendance at controlled event points | Code sharing, collusion | **Default** for social event perks |
| Staff-attested completed loop | Completed organizer-observed activity | Human error, collusion | Suitable for some distance claims |
| Timed rolling QR checkpoints | Presence at multiple places | GPS/QR sharing | Trial with safeguards |
| Browser foreground geolocation | Approx. time/route while page is active | Mock location, signal loss | Optional experiment; never sole high-value proof |
| User-submitted GPX/FIT file | Claimed route/workout from a file | Easy file modification | Manual review only for low-stakes |
| Strava API | Activity records within platform permissions | Existing platform fraud + terms | **BLOCKED pending approval** |
| HealthKit | Local health/workout data with native app | Manual entries, policy | **Out of MVP** |

## Pilot eligibility policies
- Attendance reward: organizer scanning is sufficient and **do not call it a “5K completed” reward**.
- Distance reward: at least one route/loop attestation policy documented before enrollment; unresolved evidence gets manual review.
- One completion per user/challenge unless rule states otherwise.
- No high-value cash / gift cards until stronger validation and controls.
- Limit rewards per account/device/contact under privacy-compliant fraud controls.

## Fraud controls
- High-entropy event/checkpoint tokens with short TTL and one-use nonce.
- Identity/session checks as proportionate to incentive; avoid collecting government ID for small perks.
- Server-side distance/time bounds and anomalous speed flags *if location use approved*.
- Duplicate account/voucher checks, device/IP heuristics with bias/privacy review.
- Merchant scan session with RBAC and replay protection; atomic redemption.
- Refund/reversal queue, organizer incident review, escalation log and sampled audits.
- Define appeal policy for false negatives, disability accessibility and GPS failures.

## Threat scenarios for QA
1. Screenshot of another runner's QR.
2. One runner checking in many accounts.
3. Merchant employee redeeming the same coupon repeatedly.
4. Event canceled, old QR replayed.
5. Manually forged GPX file.
6. Consumer denies geolocation, still qualifies via approved alternate method.
7. Concurrent redeems race against offer inventory.

## Outcomes and guardrails
Report verified participation rate, false rejection rate, redemption abuse %, manual-review labor minutes, participant complaints, refund cost and merchant fraud disputes — always by evidence type.

## Privacy design
Collect proof minimally; do not expose precise route, heart rate or longitudinal activity history to merchants. Store claim and attestation hashes where possible, keep retention schedule short and documented.
