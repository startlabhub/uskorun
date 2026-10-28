# USKORUN Home + Goals + DEMO Shop — isolated review handoff

**Base:** `0b056ec14ce314eadf80b1f0f12f6e2f6212b9ed` (independent iOS interruption patch).  
**Branch:** `review/home-goals-demo-shop-20261028`.  
**Scope:** owner-requested in-app value demonstration. **No cloud, merge, paid service, real rewards, economy changes or native GPS.**  
**Release status:** NOT DEPLOYED / NOT A NEW WORKING LINK.

## What the app must visibly show
- **Home:** Walk/Run choice; live foreground distance only from an actual GPS watch; approximate session points (not wallet), server-confirmed wallet points; clear labels and rounding/minimum/cap disclaimers. Switching Home ↔ Track does not stop the current foreground watch because both views use the same React state.
- **Track:** locked run/walk type during active/paused/pending_finish session; live distance; distinct estimated points and confirmed balance; existing Pause/Resume/Finish and offline Retry. iOS hidden/call interruptions never claim to fill missing distance.
- **Goals:** Choose goal button uses existing list and `joinChallenge`. Home displays first enrolled goal and existing verified city progress, with no new goal engine.
- **Reward shop:** points-needed indicator based **only** on confirmed ledger, claim button disabled when insufficient, sold out or already claimed. Server remains authoritative and will reject stale balance with exact points needed. Existing QR and equivalent code are a **single** voucher; redemption remains restricted to assigned merchants/admin and transactional.
- **Partner area:** accessible to assigned merchant/admin, displays real database counts of issued, outstanding, redeemed DEMO vouchers by authorized offer. These counts do not prove any new customers, incremental revenue or ROI.

## Fictional fixture prices — NOT an approved business model
| Manual fixture | Hypothetical benefit | Cost | Total claim cap |
| --- | --- | ---: | ---: |
| DEMO Partner A | 10% off a hypothetical eligible purchase | 5 confirmed points | 25 |
| DEMO Partner B | Fictional free snack | 10 confirmed points | 15 |
| DEMO Partner C | Fixed fictional $5 off | 20 confirmed points | 20 |
Existing 10-point demo coffee may remain unchanged. All A/B/C offers are `is_demo=TRUE`; no real product/discount and no partner attribution. Per-user claim limit is already enforced by existing `UNIQUE(offer_id,user_id)`, plus offer inventory and atomic points debit.

**Seed is intentionally NOT part of startup migration:** `scripts/seed-demo-shop.ts`.
To seed **only after an owner-authorized future disposable local or staging test**, prepare a separate DB and use:

```sh
cd apps/web
# Only with explicitly approved, isolated demo DATABASE_URL:
SEED_DEMO_SHOP_CONFIRM=I_ACKNOWLEDGE_DEMO_ONLY npx tsx scripts/seed-demo-shop.ts
```

The script refuses production, acquires a dedicated advisory lock, checks exact title/price/merchant/cap on existing fixtures, and inserts missing rows without silently updating old ones. **Do not run this command against the live USKORUN staging DB without a new approval.** There is no seed action in `migrate.ts`, `railway.json` or CI.

## Local verification checklist (no cloud)
- [ ] `npm test` — actual count and result to be filled by independent QA.
- [ ] `npm run typecheck` — must pass with JSX and new partner API.
- [ ] `npm run build` — must pass in a disconnected/local DB build context.
- [ ] PostgreSQL 14/18 disposable suite `TEST_DATABASE_URL=... npx tsx --test tests/db-races.integration.ts`: start/finish, points atomic debit, claim race, QR code replay, unauthorized merchant, expired redemption. Prior passes apply **only to prior SHA**; review branch not rerun.
- [ ] Real Chrome E2E with **SIMULATED** GPS: Start Walk → Home with moving meter and tentative points → Track → Pause/Resume → Finish, then wallet changes only after server accepted. A rejected/offline finish must not mint points. No fake points inserted.
- [ ] Shop before accepted session: Need X more, cannot claim. After server-confirmed credit: sufficient balance enables claim, one claim and point debit, no second claim or redemption replay.
- [ ] A/B/C offers appear ONLY after manually authorized demo seed. Verify exact cap, price and conditions, no non-demo offer.
- [ ] Merchant A cannot see/redeem merchant B's vouchers; admin/merchant may view authorized aggregate counts only.
- [ ] 320×740, 390×844 and desktop 1440×900 screenshots from **running local app**. Check fixed nav no overlap or horizontal overflow; Home and Shop must be usable. Don't commit emails, voucher tokens or individual location.
- [ ] Run the existing physical-device GPS-01 checklist after separately approved test window. **NOT RUN for this build.**

A local-only screenshot tool is included at `scripts/capture-local-review.mjs`. It **refuses remote URLs** and requires a dedicated demo account and existing local server. If Playwright for Node is available, run it with `DEMO_LOGIN_EMAIL`, `DEMO_LOGIN_PASSWORD` and optional `SCREENSHOT_BASE_URL=http://127.0.0.1:3000`. Output is kept outside GitHub by default; never publish credentials or real user content.

## Unknowns / owner decisions
- Whether A/B/C demo costs and benefit labels should change based on actual partner negotiations (current values are **pure test fixtures**, not promises).
- Real sponsorship contracts, accessible/privacy policies, safe closed signup, technical reliability on iOS/Android, and cost/time window remain independent release blockers.
- A live URL reflecting this new code **does not exist** until an independently authorized deployment. The existing staging URL cannot be used as evidence of this review branch.
- Browser GPS cannot guarantee locked-screen or interrupted phone-call mileage. A native Core Location recorder would require a separate product decision. This sprint does not build one.

## Handoff evidence
Review **exact commit SHA** reported with GitHub compare link. New stand-alone tests are in `apps/web/tests/experience.test.ts`; the existing tests remain unchanged. No screenshots or browser claims may be stated as passed without corresponding local browser execution evidence.
