# USKORUN GPS-01 — iPhone Safari phone-call interruption acceptance (NOT RUN)

**Reference code:** `review/ios-interruption-20261028` (origin `37d9ffb16e3bb8fff463cce1cc1e3cd63c38d5a8`).  
**Owner:** Ilya; independent QA confirms results. **No changes to iPhone system settings.**  
**Environment:** A separately authorized demo-only staging window, not this documentation update. No live sponsor rewards.

## Before testing
1. Record iPhone model, iOS version, Safari version and local test date **in private QA notes**; publish only anonymized outcome in GitHub.
2. Use a demo account; no real merchant promises. Check that the permitted test window is open. Do not deploy without a separate owner decision.
3. Keep normal iPhone settings, including Shake to Undo. Do not turn features off to make the app appear to work.
4. Ensure the app clearly says **foreground-only**. A browser cannot promise missing background or locked-screen distance.

## Exact acceptance walkthrough
1. **Editing focus:** Sign in. Use the keyboard to submit and enter Track. Verify no text cursor/keyboard remains focused. Walk normally with the phone without changing any iOS setting. Note whether the native Undo Typing dialog appears; its cause is **not proven**, and this patch is not a guaranteed cure.
2. **Foreground baseline:** Tap Start Walk. With Safari visible, confirm fresh GPS fixes and nonzero increasing provisional distance over a known, safe outdoor segment. Note sample count and distance, **not raw GPS coordinates**.
3. **Incoming call:** Receive or answer a call. Allow Safari to become hidden/inactive. After returning, ensure the app displays **Activity paused — GPS not recording** and an explicit Resume control. It must not silently resume in the background. Missed distance must not be credited.
4. **Manual Resume:** Tap Resume once. A new foreground `watchPosition` session and GPS segment should start using the **same existing clientId/activityId**. New fixes may need a short acquisition period. Verify subsequent valid movement contributes only from the new segment. No straight-line bridge may be added across the call.
5. **Silent visible GPS:** Simulate/observe no new location callbacks while Safari remains visible for 30 seconds. The app must report no new GPS fixes and safely pause; **it must not infer that the user is standing still**. Tap Resume to get a fresh watch. Repeated focus/visibility events must not open extra watches.
6. **Finish / offline retry:** Finish with connectivity. Separately, in a controlled demo test, interrupt network during Finish, verify ID and points are saved in sessionStorage and Retry Finish uses exactly the same payload. Once the server responds with terminal status, saved draft is cleared; repeated submission must not award extra points.
7. **Integrity and UI:** Validate total accepted mileage reflects only sampled foreground segments, no duplicate point awards, no hidden continued tracking, and no controls covered by bottom navigation. Record behavior before and after the call and whether Undo Typing recurs.

## Pass conditions
- [ ] Editing field not focused after successful sign-in / Track transition.
- [ ] No system-setting change requested. Any Undo Typing recurrence documented, not explained away.
- [ ] App hidden -> tracking visibly paused on return; no auto-resume, no invented distance.
- [ ] Visible but no new GPS fixes -> paused warning, manual Resume.
- [ ] Manual Resume -> new watch and new segment; prior IDs and collected points preserved.
- [ ] Repeated focus/visibility -> no concurrent watches or duplicated records.
- [ ] Finish accepted/rejected matches recorded segments; offline retry idempotent.
- [ ] User-visible safety message accurately says web GPS is foreground-only.

**Evidence type:** Physical device testing is NOT RUN for this patch. Automated mock-based tests do not establish iPhone Safari behavior.

## Product decision outside this patch
If the owner requires continuous recording through incoming calls, backgrounding and locked screens, **browser Geolocation alone is not a viable assurance**. A separately approved native iOS Core Location tracker (with correct background location privileges and privacy controls) would be needed. No native build, infrastructure, budgets or device-setting changes are authorized by this checklist.

References: https://www.w3.org/TR/geolocation/ and https://support.apple.com/en-euro/guide/iphone/iph77bcdd132/ios
