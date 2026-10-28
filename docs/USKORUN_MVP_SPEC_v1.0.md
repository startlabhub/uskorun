# USKORUN — MVP Product & Technical Specification v1.0
**Date:** 2026-10-28  
**Status:** IMPLEMENTATION BASELINE / proposed engineering choices; not a claim that functionality has been built  
**Owner:** USKORUN (independent startup)  
**Reference:** [Vision & Philosophy v1.0](USKORUN_VISION_PHILOSOPHY_v1.0.md)

> **Supersession note:** The 2026-10-15 `product/mvp-spec.md` and `r-and-d/web-mvp-architecture.md` are historical R&D drafts. They assumed organizer check-in rather than GPS distance evidence. The founder's October 28 decisions supersede those assumptions. Keep old files as research history; implement this spec, subject to the GPS feasibility gate.

## 1. Objective & release gates
Build a mobile-first responsive web/PWA for adult runners and walkers around Greater Sacramento. Close the loop: **discover challenge → join → record verified activity → progress and points → claim sponsored reward → redeem by QR/one-time code → invite others**.

**Beta:** 50–100 invited testers, real merchants, no broad advertising. **Public:** citywide challenge targeting 1,000 unique active users (a user with ≥1 accepted GPS activity in the previous 30 days). Target is not a forecast.

**Non-negotiable GATE GPS-01:** test foreground mobile browser GPS, permission flows, phone locked, tab backgrounded, app switch, weak connectivity and reconnection on recent iOS Safari/PWA and Android Chrome/PWA. Browser geolocation may be suspended or throttled. **Never silently award distance for gaps, interpolate unverified miles, or claim robust locked-screen recording.** If the required reliability cannot be demonstrated, do NOT launch distance-reward campaigns; either scope beta to foreground sessions with clear warnings or implement a native tracking companion after founder approval. No Apple Health/Strava/Garmin dependency for MVP.

## 2. Actors and permissions
- **Guest:** landing, public partner offers/challenges; no exact participant location.
- **Participant (18+):** profile, consent, GPS sessions, point wallet, teams, challenges, referrals, redemption.
- **Team owner/moderator:** create team, invite, create non-sponsored challenge, moderate team membership; never edit recorded distances.
- **Merchant owner/staff:** manage owned locations, draft offers, view aggregate conversion, redeem vouchers for assigned locations.
- **Influencer/referral partner:** lead referral link and status for business contracts; no access to runner GPS; commissions only after qualifying paid contracts and admin approval.
- **USKORUN operator/admin:** approve sponsor offers/campaigns, review suspicious sessions, handle disputes and refunds, access minimum necessary audit info. MFA mandatory.
Enforce authorization server-side and tenant/location scopes. Never rely on frontend role checks.

## 3. Priorities
### P0 — closed beta
1. Landing/English UI, age 18+ sign-up/sign-in, account/profile, consent.
2. City selector; browse/filter challenges (nearby by city, run/walk, team, sponsor); join/leave.
3. Start/pause/resume/finish **foreground** GPS session; explicit visible GPS accuracy/coverage; show distance, time and route during recording. Handle GPS denial, offline, lost lock and short/long gaps without fabricated distance.
4. Server validates each session; accepted/review/rejected with human-readable reasons; separate walking/running coefficients in versioned configuration.
5. Server-side point ledger; balance, history; no negative balances and no duplicate awards.
6. Teams and user-generated non-sponsored challenges; team totals count only validated qualifying activity; invite links, native share/copy fallback.
7. Personal achievements, basic city/team rankings separated by running/walking; minimum data exposure and opt-out.
8. Merchants: onboard location, draft offer; admin approval and explicit capacity/terms, hours, expiry and sponsor commitment.
9. Reward wallet: earn/claim one-use entitlement; QR token + equivalent short one-time code; location-scoped merchant verifier; atomic single redemption; status and receipt; race-safe idempotency.
10. Referrals: inviter+invitee bonus only after first accepted session of invitee; limits/abuse review.
11. Admin dashboard: campaign moderation, suspicious sessions, inventory, redemption logs, manual adjustments with immutable audit.
12. Privacy/Terms/consent, deletion request, basic accessibility, telemetry, secure staging/prod, monitoring and backups.

### P1 — public 1,000-active-user release
- One prominent **Sacramento Moves Together** citywide challenge; configurable shared distance and **minimum unique active contributors**; progress, share text and referral deep link.
- Sponsor reward unlock for qualifying contributors, clearly specified before enrollment; sponsor inventory funded and approved before publishing.
- Team vs team leaderboard, public discoverability with moderation/report-abuse workflows, enhanced user achievements.
- Partner campaign reporting: views, joins, eligible activities, issued and redeemed rewards, qualified referrals, cohort retention.
- Influencer B2B attribution and commission **admin workflow**; payout accounting initially manual.
- Scalability, rate limiting, fraud review queues and load testing.

### P2 — after validated traction
- Premium subscriber billing/features after pricing research (do not sell competitive advantage).
- Strava, Garmin, Apple Health native integrations only with permissions/terms review; native companion if tracking demands.
- Merchant self-serve campaign purchases, POS integration, more regions, advanced personalization.
- Sweepstakes/random giveaways only after legal review; **not in MVP**.

## 4. UX screens & routes (proposed)
| Route | Audience | Primary action |
|---|---|---|
| `/` | Everyone | Understand and join city movement |
| `/auth`, `/onboarding` | Guest | Register, age/consent, select city |
| `/discover` | Participant | Search challenges/offers/teams |
| `/challenges/[id]` | Everyone | Rules/reward/sponsor, join |
| `/track` | Participant | Start, pause, finish session |
| `/activity/[id]` | Participant | Quality verdict and earned points |
| `/teams`, `/teams/[id]`, `/teams/new` | Participant | Join, invite, create goal |
| `/rankings` | Participant | Run/walk and time-window rankings |
| `/rewards`, `/rewards/[id]` | Participant | Balance, view QR/promo code |
| `/partners`, `/partners/[id]` | Everyone | Find participating merchants |
| `/merchant`, `/merchant/redeem` | Merchant | Offer status and redemption |
| `/admin` | Operator | Moderation, risk and metrics |
| `/settings/privacy` | Participant | Consent, privacy, export/delete |
Bottom mobile tabs: Home, Challenges, Track, Rewards, Profile. Fast first-run CTA: **Join challenge → Start moving**. English default; localization-ready.

## 5. Activity tracking & verification
**Client:** Geolocation API after explicit gesture and consent; HTTPS only. Track timestamp, latitude/longitude, horizontal accuracy (when available), derived distance and elapsed active time; client display is provisional. Provide accuracy badge and warnings.

**Server:** Accept bounded batches with session nonce, monotonically ordered timestamps, rate limits, device/session identity, max duration/point count; deduplicate uploads using unique event IDs. Recalculate distance between accepted sequential GPS fixes after accuracy, unrealistic speed, teleporting, stationary noise, duration and gap checks. Configurable parameters, initial provisional values only: reject samples with accuracy worse than 50 m, implausible movement above 8 m/s for run or 3 m/s for walk, and do not count a segment after a gap >60 s until a fresh valid segment starts. **These are hypotheses**, not clinically/scientifically established anti-fraud guarantees; tune on beta evidence. Ambiguous borderline sessions go to manual review. No points until accepted. Never reconstruct lost mileage.

**Session states:** created → recording → paused → submitted → processing → accepted / review / rejected. Freeze scoring rule version at submission. Prevent overlapping sessions from earning twice, duplicate upload and replay. Walking/running selection before session plus plausibility checks; do not infer activity type solely from speed. Set minimum session length/distance and maximum daily earnable points after calibration; publish rules in UI.

**Privacy:** default avoid persistent raw route storage. Calculate/map route on client; on upload process signed batches and retain only minimized verification evidence and derived aggregates when possible. If temporary coordinates are essential for antifraud, encrypted short retention with documented deletion; never show route to merchants, other runners or referrals. No public start/end coordinates. Avoid automatically disclosing residential locations.

## 6. Points, challenge rules and reward engine
- Points are a **promotional loyalty unit**, not cash, transferable money or guaranteed property. Define expiry and returns transparently; no cash withdrawal/transfers.
- Use config-driven versioned `earn_rule` for `run` and `walk`: `points_per_verified_mile`, minimum valid distance, daily cap, thresholds and effective dates. **Exact coefficients are OPEN**, not invented.
- Append-only wallet journal: source accepted session/referral/reversal, amount, idempotency key, rule version, timestamp. Current balance derived transactionally; no client-authoritative balance.
- Challenge eligibility: individual distance, combined validated team mileage, minimum distinct active contributors, start/end time (America/Los_Angeles), allowed activities, maximum eligible contribution/person and reward eligibility thresholds; no contribution before join unless campaign explicitly allows it.
- Group milestones unlock only once per scope; individual eligibility for milestone reward requires posted minimum contribution, preventing join-only reward farming.
- Sponsor offers fail closed if unapproved, expired, inventory exhausted, paused or terms unconfirmed.
- Claim reserves inventory in database transaction, generates cryptographically random opaque token; store token hash; QR encodes token or short claim URL, never user GPS/identity. Code must be independently random, length/rate-limits strong enough to resist guessing. Protect against screenshots/replay with short-lived display code where feasible.
- Redeem transaction checks token hash, merchant location, offer status, expiry and claims cap, locks reward, inserts one redemption under unique constraint and marks redeemed atomically. Two simultaneous attempts → exactly one succeeds. No merchant-created entitlements.
- Corrections/chargebacks use explicit audited compensating entries; do not rewrite ledger or redemption history.

## 7. Core database (PostgreSQL, draft)
- `users`, `profiles`, `consents`, `sessions`, `session_evidence` (short retention), `activity_reviews`, `earn_rules`
- `point_ledger` (unique source event), `teams`, `team_members`, `invites`, `referrals`
- `challenges`, `challenge_enrollments`, `challenge_contributions`, `challenge_milestones`
- `merchants`, `merchant_locations`, `merchant_members`, `offers`, `campaigns`
- `reward_entitlements`, `redemptions`, `partner_leads`, `commission_accruals`
- `audit_events`, `outbox_events`, `idempotency_keys`, `feature_flags`
Use UUID PKs, UTC timestamps (display in local Pacific time), foreign keys, indexed status+date fields, tenant constraints, DB migrations. Unique constraints: (challenge_id,user_id) enrollments, (team_id,user_id) membership, (referee_user_id) referral attribution, (session_id,rule_id) activity earning, (reward_id) redemption, idempotency keys per operation. Add partial/conditional indexes as appropriate after implementation review.

## 8. API contract (REST, versioned `/api/v1`; response errors structured)
**Auth:** hosted authentication session; all mutations require CSRF protection for cookie auth or appropriate token validation.
- `GET /challenges?city=&type=`, `GET /challenges/:id`, `POST /challenges/:id/join`
- `POST /activities` (initialize), `POST /activities/:id/points` (bounded batches), `POST /activities/:id/finish`, `GET /activities/:id`
- `GET /wallet`, `GET /offers`, `POST /offers/:id/claim`, `GET /rewards/:id`
- `POST /merchant/redeem` (token, location, idempotency key)
- `POST /teams`, `POST /teams/:id/join`, `POST /teams/:id/invites`
- `GET /rankings`, `GET /campaigns/:id/progress`, `POST /referrals/resolve`
- `POST /merchant/offers` (draft), `GET /merchant/summary`
- `POST /admin/campaigns/:id/approve`, `POST /admin/activities/:id/review`
- `POST /privacy/export`, `DELETE /account`
Use schema validation for each request, role-scoped queries, pagination, throttling and audit for sensitive mutations. Require idempotency keys on finishing, awards, claiming and redemption.

## 9. Architecture & Railway deployment
**Recommended stack (implementation decision to validate against codebase):** TypeScript + Next.js (responsive app and server API), PostgreSQL + ORM with schema migrations, established hosted authentication with MFA for administrators, basic transactional email, optional PWA manifest/service worker for static assets only. No offline earning promise. Start with a single deployable web service and DB; add a worker only when needed.

**Railway layout:** separate **staging** and **production** environments/projects; web service built from GitHub repo, managed PostgreSQL using `DATABASE_URL`, managed migrations before rollout, public HTTPS domain, health endpoint `/api/health`, readiness checks, application logs and error monitoring. Secrets in Railway variables (never repo); auth redirect origins for both environments. Configure region appropriate to target users and operational budget. Backups and **restore drill** before beta, database constraints, least-privilege credentials; seed demo data only in staging. Do not expose database publicly unless required for secure administration. No automatic destructive schema migration in production.

**Suggested structure:**
```text
app/                 Next.js pages/routes and components
src/server/          API handlers, RBAC, business services
src/domain/          activity validation, ledger, challenges, rewards
src/lib/             auth, schemas, logging, db
prisma/ or db/       PostgreSQL schema and migrations
tests/               unit, integration, e2e, GPS replay fixtures
docs/                product and operations documentation
```
CI: lint, typecheck, unit, integration, e2e smoke, migration check, secret scanning; deployment from main only after review. Production rollback plan must distinguish code rollback from irreversible database changes.

## 10. Security / legal / accessibility
- Adults 18+ (self-declaration and reasonable access controls); do not market service to children.
- Precise location is sensitive. Consent before GPS, easy stop/delete, minimum collection, transparent retention, encrypted transit/at rest, no sale of route data or sharing with merchants.
- Privacy policy, Terms, reward conditions, partnership contracts, California privacy/consumer promotion counsel review prior to broad public launch. This spec is not legal advice.
- No random-prize sweepstakes/paid lottery in P0/P1; assured threshold-based rewards and objective leaderboards only.
- Anti-bot on signup/referrals/claim; suspicious activities reviewed; protect reward token brute-force and enumeration; abuse reporting and admin MFA.
- WCAG 2.2 AA target, large touch areas, legible distance/accuracy/error state, screen-reader labels, color-independent status.
- Performance targets proposed: p75 initial mobile interaction responsive under 3 seconds on typical 4G, API p95 <500ms for routine reads (excluding external auth), 99.5% beta uptime target subject to actual hosting plan. Measure and revise.

## 11. Observability and KPIs
Instrument privacy-safe events: `signup_completed`, `challenge_joined`, `tracking_started`, `tracking_finished`, `activity_accepted`, `activity_rejected`, `invite_shared`, `referral_activated`, `offer_claimed`, `reward_redeemed`; no coordinates in analytics.

Dashboards: active validated participants (rolling 30 days), activation, D7/D30 retention, referral→first accepted activity, challenge completion, issued/redeemed vouchers, inventory remaining, partner campaign renewal, fraud/manual-review rate, GPS gap rate and client device breakdown. Require breakdown of **actual GPS validity by iOS vs Android**.

## 12. Test plan & acceptance gates
1. Registration: underage/consent decline blocked, valid 18+ registration succeeds.
2. GPS: deny location, weak accuracy, airplane mode, app-switch, locked phone, poor network, resume, duplicate points and teleporting; UI explains gaps and awards only validated distance. Gate GPS-01 documented with device/test matrix.
3. Scoring: walk/run coefficients separately configured; duplicate submissions yield single journal credit; late/invalid sessions not rewarded; manual override audited.
4. Team: two users join, contribute valid miles, progress aggregates uniquely and respects caps; group unlock occurs once; inviter cannot earn referral points by creating fake signups alone.
5. Sponsor: unapproved offer unavailable; explicit terms/inventory/date displayed; exhausted inventory blocks claim.
6. Redemption: QR/code parity; first valid redeem succeeds, replay fails; simultaneous redemptions result in exactly one; wrong merchant/location fails.
7. Security: horizontal privilege test, brute-force throttling, admin MFA, no personally identifying or route content in voucher, secrets/log leaks.
8. Deletion/export: routes/evidence lifecycle documented; deletion request fulfilled per policy; ledger financial/integrity records handled appropriately.
9. Reliability: staging smoke tests, production backup restore drill, verified Railway health checks, monitoring alerts.
10. Real-world beta: 50–100 testers, at least one real partner offer redeemable end-to-end, measured retention. **Go/no-go** signed by founder after reviewing fraud, GPS reliability, merchant acceptance and support load.

## 13. Sprint backlog / implementation order
- **S0 Foundation:** repo inventory, spec approval, Next.js scaffold, Postgres schema/migrations, Railway staging, CI, auth & permissions.
- **S1 GPS feasibility:** minimal track screen + device matrix; decision gate before monetized mileage.
- **S2 Core loop:** onboarding, challenge directory/join, accepted activity, points ledger, user wallet.
- **S3 Community:** teams, share/referral attribution, milestones, basic rankings, moderation.
- **S4 Merchants:** inventory-approved offers, QR/code, atomic redemption, partner dashboard.
- **S5 Beta hardening:** security/privacy/accessibility, analytics, e2e, support tooling, 50–100 tester launch.
- **S6 Public campaign:** sponsor city challenge, 1,000 active users target, instrumentation, operational scaling.

## 14. Open founder/product decisions (do not silently invent)
1. Exact points per verified mile for run vs walk, daily caps and conversion to discounts.
2. Monetary premium pricing and what features belong to premium (P2).
3. Partner campaign prices, funded reward supply, cancellation terms and commission schedule.
4. Public challenge default distances, time windows and individual eligibility floors.
5. GPS acceptable-device coverage threshold from S1, consent/retention durations, support escalation.
6. Choice of auth provider and precise stack libraries after repository check.
7. Naming, logo, branding, domain and partner agreements.
8. Whether all individual/team challenges are discoverable by default, and reporting/moderation policy.

## 15. Definition of done
No feature is complete until mobile UX + server validation + database constraints + negative tests + role security + telemetry + staging verification are present. Publishing a spec does not mean an app or Railway deployment exists. The next action is **S0 + S1**, with GPS feasibility as the earliest product-risk checkpoint.
