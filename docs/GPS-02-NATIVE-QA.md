# GPS-02 — Native Capacitor background location acceptance (NOT DEVICE-VERIFIED)

## Scope and release gate
Review-only feature branch `feat/native-background-gps`. The existing web runner and backend are unchanged. No deployment, merge, DB migration, store registration or paid account is authorized by this file.

This code uses `@capacitor-community/background-geolocation@1.2.26` (MIT) in an iOS/Android Capacitor WebView and the existing `ForegroundWatch` in an ordinary web browser. Both feed `PendingRun` and the existing server `/api/action` start/finish payload, without changing `assessGPS`, 5-mile cap, earning rates, or atomic points ledger.

**Native static package runs LOCAL QA without a server**: local-only start IDs, actual device GPS fixes, local pending draft. It refuses Finish confirmation and awards zero wallet credits. The default Capacitor configuration does not use `server.url`. An optional remote URL shell would use a separately approved running Next/API server and could be rejected by App Store as a thin website wrapper; it is not a replacement for offline packaged operation. Any real server integration, auth/CORS/cookies and recovery of local-only IDs requires its own QA; NEVER replay a `local-qa:` ID against a production backend.

## Required physical acceptance — iOS and Android

- [ ] Install an actual compiled, developer-signed native app from a device build; do not treat Chrome DevTools location simulation as a phone test.
- [ ] Before requesting location permission, verify on-screen reason: USKORUN records route/distance and provisional demo points only during explicit Start; user can Pause/Finish. iOS Always and Android background permission are only requested when necessary. Deny permission and confirm meaningful error with no watcher/credits.
- [ ] iOS Info.plist includes `UIBackgroundModes/location`, `NSLocationWhenInUseUsageDescription` and `NSLocationAlwaysAndWhenInUseUsageDescription`. Check actual entitlement, user-facing iOS permission flow and App Store explanation.
- [ ] Android manifest includes fine/coarse/background location, foreground-service location, Android 13+ `POST_NOTIFICATIONS`; native plugin service shows an **ongoing** notification while tracking. Confirm Android 14/15/16 behavior and notification permission flow; verify Settings restrictions do not silently lose fixes.
- [ ] Start Walk and Start Run in separate activities; selected kind freezes. Start another session while paused → explanation and single Resume primary action, not a silent no-op.
- [ ] Walk with real GPS in FOREGROUND; verify fix timestamps, accuracy filtering and no simulated location points; never infer distance from time alone.
- [ ] Lock phone while recording, walk 10 minutes, unlock; verify a sequence of actual points with original timestamps (not repeated/displaced interpolation). Record missing/late fixes separately. Kill the process; document whether plugin drops fixes (native durable queue is NOT implemented).
- [ ] Accept a phone call while recording, speak, return to app; verify observer survives or an explicit recoverable pause, and whether missing call-time points really exist. Repeat with iOS/Android OS versions documented.
- [ ] Toggle airplane mode DURING recording, Finish offline; confirm saved `pending_finish` retains `clientId`, `activityId`, kind, segment and GPS array after app relaunch. With an approved real API only, retry Finish using identical activity ID, get at most one ledger award.
- [ ] Pause/Resume across visibility switch: no second watcher; old callbacks ignored; new segment with no bridging across pause. Test Finish, Rejected and Abandon terminal cleanup.
- [ ] Confirm 5-mile limit, 0.03 mi minimum, session/daily caps, anti-spoof checks with the unchanged backend; local QA stub cannot validate server acceptance.
- [ ] Compare phone battery usage after 10/30/60 minutes of recording. Check notification removal, GPS watcher removal, location permission revocation, and screen lock.
- [ ] Confirm app About → Licenses shows full plugin MIT (Copyright 2021 James Diacono) and Capacitor MIT (Copyright 2017-present Drifty Co.) plus installed dependency license inventory.
- [ ] Validate accessibility, screen sizes, text in prompts, privacy notice and App Store review requirements; store account/signing/testflight/google play operations require separate approval.

## Repeatable local commands — not evidence that a device QA passed
```sh
cd apps/web
npm install
npm test
npm run typecheck
npm run build                 # existing Next server production build; no server started
npm run build:native          # temporary Next static export; no Next API/server required
npx cap add ios               # native scaffold requires supported macOS toolchain
npx cap add android
node scripts/configure-native.mjs
npx cap sync                  # local platform files, no cloud deploy
```

The build-native script excludes route handlers from a temporary export tree, not from the production web app. It also gathers dependency notices from the installed npm tree. Platform signing and binary build on an actual Mac/Android SDK are NOT accomplished by the web build.

## Known limitations / release blockers
1. **No guarantee of uninterrupted background GPS:** OS throttling, force-quit, permissions, and WebView JavaScript suspension may drop points. This community plugin does NOT implement a durable native disk queue; claims of uninterrupted 10-minute background walk require physical proof.
2. **Local QA is explicitly not a functioning reward economy:** no server = no login, accepted miles, merchant balance, or credits. Local-only IDs are not valid server IDs. Running against real API requires separate reviewed config, authentication/cookie/origin/CORS design, anti-abuse checks and live tests.
3. **Sensitive GPS points are stored in localStorage in the native WebView** for process-relaunch recovery; this is not encrypted-at-rest. Before wider beta, use encrypted native storage and a privacy/retention audit. Never copy GPS trails into Github or screenshots.
4. **Store listing/compliance:** iOS location background mode must justify essential user-initiated service; Android background location/foreground service and persistent notification require platform declarations/review. Developer accounts, signing and store review are not covered by these code commits.
5. **No confirmed real device run** and no guarantee of background continuity or Shake to Undo fix. An iOS/Android device is a release gate.

---

## NATIVE-02 addendum — persistent OS queue source added (not yet compiled on devices)

The original GPS-02 checklist describes the **NATIVE-01** callback-only plugin and
correctly recorded its missing native disk queue at that time. This remains
historical evidence, not the current implementation claim.

See [GPS-03-DURABLE-NATIVE-QUEUE.md](./GPS-03-DURABLE-NATIVE-QUEUE.md):
USKORUN now includes **uncompiled Swift and Kotlin source** for a custom
MIT native recorder, app-private fsynced JSONL fix log, plus TS drain/ACK
integration. These commits do **not** prove actual on-device persistence,
OS background relaunch, or battery behavior. Re-test every GPS-02 scenario
against the **new exact branch SHA** after Xcode and Gradle compilation.

**Remaining release blockers:** unencrypted app localStorage and native route
files (no app-managed encryption keys), Android background permission/store
review, iOS force-quit/relaunch semantics, recovery of damaged JSONL, physical
10-minute phone-call/lock tests, and actual API accepted Finish. No public
deploy, stores or payments were authorized.
