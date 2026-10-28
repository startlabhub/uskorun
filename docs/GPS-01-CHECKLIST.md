# USKORUN GPS-01: device acceptance worksheet

**Status:** NOT PERFORMED ON PHYSICAL DEVICES. This is a manual test plan. No real devices have been checked by this sprint.

## Prerequisites
- Ilya explicitly approves a test build/deploy and any associated cloud budget. **Do not use the existing Railway staging URL as a validated build without verifying the deployed commit and QA gates.**
- Build commit SHA recorded; HTTPS test URL and code version known; only test users and DEMO offers; no real sponsor obligations.
- Latest Safari (iOS) and installed iOS home-screen PWA on two iPhone models if possible; Android Chrome and installed PWA on at least one Android phone.
- Each phone's battery level, OS version, browser version, device clock, permission state and GPS accuracy noted.
- A known reference path (e.g. measured 0.25 mi and 1.0 mi), outdoors, not near traffic. Compare against a properly measured route; do not use fabricated measurements.

## Device-by-device worksheet (fill actual observations)
| Device, OS, browser | Test | Expected evidence | Result | Error / notes |
|---|---|---|---|---|
| iPhone Safari | 1 Hz running vs known route | Accurate foreground distance (proposed p90 error <=10%, TBD) | NOT RUN | |
| iPhone Safari | 1 Hz walking vs known route | Distance from short steps counts | NOT RUN | |
| iPhone Safari | Pause 2s, walk 10m, resume | Paused 10m excluded | NOT RUN | |
| iPhone Safari | Pause 30s, walk 60m, resume | Paused 60m excluded | NOT RUN | |
| iPhone Safari | Switch apps 30s, walk, return | Forced pause, background movement excluded | NOT RUN | |
| iPhone Safari | Lock screen 60s | Clear tracking interruption; no invented miles | NOT RUN | |
| iPhone installed PWA | Above tests, plus resume | No assumption of native background tracking | NOT RUN | |
| Android Chrome | Above foreground/pause/lock tests | Same segment rules; capture real device metrics | NOT RUN | |
| Android installed PWA | Above tests | No claims of uninterrupted locked-screen tracking | NOT RUN | |
| Both | Weak GPS, denied permission | Explain why activity is uncredited | NOT RUN | |
| Both | Airplane mode/offline Finish | Preserve local draft, retry exact payload after reconnect | NOT RUN | |
| Both | Server commits then response lost | Retry gives same terminal result; points once | NOT RUN | |
| Both | Reload after recording | Draft recovered in paused state; safe resume or abandon | NOT RUN | |
| Both | Start rapidly twice | One recording only, UI busy lock and DB invariant | NOT RUN | |

## Analysis and sign-off
Report p50/p90/p95 distance error, interrupted-session rate, battery use, GPS false rejection, raw/credited distance and app usability. Data must distinguish **foreground** vs **screen-off** conditions. The current 10% p90 target is a proposed gate requiring Ilya's acceptance, not demonstrated performance.

**Independent QA:** review test logs; **Ilya:** final go/no-go for further deployment, partners, credits and real-user beta. No commercial claims based on synthetic unit tests.
