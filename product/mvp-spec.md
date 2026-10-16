# USKORUN — Web MVP Specification
_Date: 2026-10-15. Status: DESIGN DRAFT; no product code exists yet._

## MVP user flows
1. **Sign up:** email/passkey or managed auth; age gating and localized terms where appropriate.
2. **Browse:** city/club/challenge listing with date, location, qualifying rule, inventory, reward terms.
3. **Join:** opt into an event; explicit consent for chosen verification route.
4. **Verify:** an organizer-supervised check-in/check-out or time-limited QR evidence for a club event. This proves attendance, **not automatically distance**. Distance-based challenge requires adequate independent evidence / staff attestation.
5. **Earn:** server applies challenge criteria and issues one signed, single-use voucher.
6. **Redeem:** merchant scans or enters short code; server atomically verifies eligibility, expiry, merchant scope and one-time usage.
7. **Merchant:** create offer, define cap, view redemptions and aggregated metrics; never expose health/GPS data.
8. **Operator:** moderate challenges, fraud flags, disputes and cancellations.

## Minimal data model (proposed)
- users(id, email, consent_version, created_at, status)
- clubs(id, organizer_id, name, region)
- challenges(id, club_id, starts_at, ends_at, eligibility_rule_version, verification_policy, status)
- enrollments(id, challenge_id, user_id, status)
- verification_events(id, enrollment_id, method, event_at, evidence_ref, confidence, reviewer_id)
- merchants(id, legal_name, location_id, contact, status)
- offers(id, merchant_id, terms_version, reward_type, cap, start/end, status)
- rewards(id, user_id, offer_id, challenge_id, random_token_hash, expires_at, status)
- redemptions(id, reward_id, merchant_id, redeemed_at, amount_optional, idempotency_key)
- audit_log(id, actor_id, action, object_id, timestamp)
Avoid storing raw GPS routes in MVP; record only the minimum needed for verification.

## Eligibility engine
Input: event/check-in data + consent scope + challenge rule version. Output: eligible / ineligible / manual_review, with reason codes. All awards are server-side and idempotent. Merchant cannot mint their own user rewards.

## Merchant voucher policies
- Signed or server-validated opaque token (no personal information in QR).
- Single use; short expiry and offer inventory limits.
- Terms shown **before** enrollment: benefit, exclusions, geographic location, total availability, expiration.
- Merchant redemption is atomic; protect against replay, brute force and screenshot sharing.
- Reversal/refund workflow and immutable redemption evidence.

## Admin QA acceptance
- A single eligible user can claim one qualifying reward once.
- Attempted second redemption is rejected.
- Two devices racing to redeem the same token result in exactly one success.
- Expired/paused/exhausted offers cannot issue or redeem.
- User can delete account; privacy retention/deletion processes documented.
- Organizer check-in cannot be silently interpreted as a completed 5K run.
- No third-party HealthKit data or Strava API dependency is required for happy path.

## Non-functional requirements
Accessibility (keyboard and screen-reader labels), responsive mobile-first PWA, HTTPS, server-side authorization, rate limiting, RBAC, encrypted credentials, audit logs, backup and recovery. Do not use cookie-based cross-site tracking without appropriate consent.

## Pilot interfaces
Landing / challenge pages / club event page / personal rewards wallet / merchant verifier / basic merchant dashboard / admin moderation.

## Exclusions
Native HealthKit, automatic background GPS, gamified paid prize draws, smart-watch integrations, automatic merchant POS integrations; track as later milestones.
