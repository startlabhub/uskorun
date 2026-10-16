# R&D: Apple Health / HealthKit for USKORUN
_Date: 2026-10-15. Source: Apple official developer documentation. Status: TECHNICAL VERDICT VERIFIED; business-use approval OPEN._

## Short answer
A normal website, Safari page, or installed PWA **cannot directly read the Apple Health store**. HealthKit APIs require Apple-platform application targets with the HealthKit capability, user authorization and relevant entitlements. A web app hosted remotely does not acquire access simply because it runs on iPhone.

Official sources:
- https://developer.apple.com/documentation/Xcode/configuring-healthkit-access
- https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data
- https://developer.apple.com/documentation/HealthKit/protecting-user-privacy
- https://developer.apple.com/app-store/review/guidelines/

## Feasibility table
| Approach | iOS App required? | Can read Apple Health? | Launch assessment |
| --- | --- | --- | --- |
| Mobile browser or installable PWA | No | **No** | Launch web features only |
| Native iOS client + HealthKit | **Yes** | With per-type user permission | Later, contingent on legal/compliance |
| Hybrid WKWebView shell + native HealthKit bridge | **Yes** | Native bridge can request permissions | Not a browser-only workaround; review privacy/app policy |
| Apple Health export uploaded manually | No native USKORUN app | Import only user-exported files | Not automatic sync, sensitive and inconvenient; avoid as MVP |
| Third-party service which syncs Apple Health via its own iOS app | Usually the provider needs native software | May supply data under license | Contract, consent and use restrictions require detailed review |
| Strava OAuth web integration | No | **Not direct Apple Health access** | Separate third-party use restrictions; see Strava doc |
| Organizer QR check-in | No | N/A | Recommended MVP |
| Foreground browser geolocation | No | Does not read HealthKit | Possible controlled test; limited reliability |

## More serious issue than the API: Apple policy
Apple's App Review Guidelines section 5.1.3(i) restrict use and disclosure of health/fitness data for advertising, marketing and data mining. It describes a narrow direct-benefit case (e.g. reduced insurance premium) **provided the app is submitted by the benefit-providing entity and data are not shared with a third party**. The section is not a blanket license to supply unrelated merchants with workout-based advertising or referral data.

From Apple's privacy guidance: HealthKit-origin information must not be used to serve ads, and disclosures to third parties are restricted to health/fitness service purposes and express user permission.

**Therefore:** It is not enough to anonymize a workout before passing a perk to a merchant and declare the whole commercial mechanism permitted. The underlying purpose and benefit-provider rule demand **legal and platform compliance review**. Do not engineer around Apple policy or make an unsupported compatibility claim.

## If native HealthKit is reconsidered
- First write an exact use-case, user benefit and who pays/provides the benefit.
- Obtain specific review of Apple's current App Review Guidelines, Developer Program License Agreement and privacy law.
- Request minimum HealthKit permissions at the moment of use; do not infer permission from an empty result.
- Collect only verified run metadata necessary for the permitted feature; no route/heart-rate access by default.
- Avoid sharing HealthKit-derived data or targeting third-party commercial offers from that data unless explicitly approved.
- Provide delete/export and consent withdrawal behavior; keep HealthKit and marketing permissions separated.
- Only then consider SwiftUI native app or narrow native bridge and backend reward eligibility.

## Engineering recommendation
Build event membership, challenges, merchant offers, reward eligibility and claims as **source-agnostic server modules**. Add evidence adapters in the future with explicit provider/policy contracts.

## Decision
**No HealthKit dependency for MVP.** Keep “Apple Health integration” gated as an R&D investigation, not a feature commitment.
