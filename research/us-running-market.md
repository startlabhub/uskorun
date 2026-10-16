# US Running & Reward Apps — Research Base
_As of 2026-10-15. Status: PARTIAL RESEARCH / FULL DEEP RESEARCH PENDING._

## Purpose
Evaluate whether the US market can support USKORUN, a local running club/challenge + merchant reward marketplace, with a plausible path to sustainable revenue. This is **not** the completed Deep Research report, and this file contains **no verified total market size, competitor revenues, CAC estimates or adoption statistics** yet.

## Market map (qualitative taxonomy)
1. **Activity capture and social graph:** Strava, Garmin Connect, Nike Run Club, ASICS Runkeeper, MapMyRun.
2. **Training programs/coaching:** Runna, Nike Run Club, Garmin plans.
3. **Virtual races, medals and challenges:** The Conqueror Challenges and similar products.
4. **Steps/activity-to-incentives:** Sweatcoin, StepBet, Paceline, Vitality-style wellness initiatives.
5. **Charity-linked activities:** Charity Miles and local charity races.
6. **Offline distribution:** running clubs, retail running shops, local 5K series and park gatherings.

**Key segmentation hypothesis:** Users already have activity-tracking tools. USKORUN should not win by replicating tracking, but by providing a **merchant-funded local outcome** and club acquisition/distribution layer.

## Research questions / evidence needed
- US running participation and frequency, broken down by casual runners, frequent runners and club runners.
- Growth of run clubs and race registrations, with date/source/method.
- Competitor install estimates, engagement, retention, monetization and pricing from transparent sources.
- Specific U.S. precedents for a **verified run → local discount** program, with live examples and their actual merchant economics.
- Are nearby merchants willing to pay for verified footfall instead of ordinary coupons?
- Do runners prefer a free smoothie, % off, access to an event or charitable impact? How often?
- What level of verification is appropriate to the reward value?
- Can Strava data be used for these challenges? **Platform-rule gate is open and potentially blocking.**
- Legal review of sponsorship, earned discounts, charitable pledges and paid-entry competitions.

## Research evidence ledger
| Claim | Status | Source or next action |
| --- | --- | --- |
| Apple HealthKit is exposed through native iOS/watchOS entitlements rather than browser JavaScript | VERIFIED, official docs | https://developer.apple.com/documentation/Xcode/configuring-healthkit-access |
| HealthKit-origin health data may not be repurposed for third-party marketing | VERIFIED, Apple policy | https://developer.apple.com/documentation/HealthKit/protecting-user-privacy and https://developer.apple.com/app-store/review/guidelines/ |
| Strava OAuth can authorize athlete activity retrieval for approved uses | VERIFIED, official docs | https://developers.strava.com/docs/getting-started/ |
| Strava APIs may be revoked for prohibited virtual races/competitions | VERIFIED, platform warning; scope of specific design requires review | https://developers.strava.com/ |
| U.S. TAM/SAM/SOM, merchant willingness, conversion and cost | NOT YET ESTABLISHED | Await dedicated Deep Research + field validation |

## Import plan for Deep Research
When a full, source-linked Deep Research deliverable is actually available:
- save **verbatim research plus retrieval date** under research/deep-research-report-YYYY-MM-DD.md;
- copy sources to research/sources.md, noting original publication dates;
- create structured competitor pricing / acquisition matrix with links;
- reconcile disagreements in an evidence log;
- update business and roadmap **only after** evidence review.
No fabricated extracts and no placeholder labeled “final report”.

## Initial recommendation (hypothesis)
Pilot with local clubs + supervised verification + merchant vouchers via web. Integrate any third-party workout data **only** after its agreement explicitly permits the precise reward use.
