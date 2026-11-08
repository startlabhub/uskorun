# GPS-02 — Native Capacitor background location acceptance (NOT DEVICE-VERIFIED)

## Scope and release gate
Review-only feature branch `feat/native-background-gps`. The existing web runner and backend are unchanged. No deployment, merge, DB migration, store registration or paid account is authorized by this file.

Current native Track uses the owned MIT `USKDurableLocation` Capacitor plugin (Swift Core Location / Android location foreground service), which writes OS fixes to a durable native queue. The older `@capacitor-community/background-geolocation` callback adapter remains in the repository but is **not the active Track GPS source**. Ordinary browsers retain `ForegroundWatch`. The same `PendingRun` and server `/api/action` start/finish contract, `assessGPS`, 5-mile cap, earning rates and atomic points ledger remain unchanged.

**Native static package runs LOCAL QA without a server**: local-only start IDs, actual device GPS fixes, local pending draft. It refuses Finish confirmation and awards zero wallet credits. The default Capacitor configuration does not use `server.url`. An optional remote URL shell would use a separately approved running Next/API server and could be rejected by App Store as a thin website wrapper; it is not a replacement for offline packaged operation. Any real server integration, auth/CORS/cookies and recovery of local-only IDs requires its own QA; NEVER replay a `local-qa:` ID against a production backend.

## Required physical acceptance — iOS and Android

- [ ] Install an actual compiled, developer-signed native app from a device build; do not treat Chrome DevTools location simulation as a phone test.
- [ ] Before requesting location permission, verify on-screen reason: USKORUN records route/distance and provisional demo points only during explicit Start; user can Pause/Finish. iOS Always and Android background permission are only requested when necessary. Deny permission and confirm meaningful error with no watcher/credits.
- [ ] iOS Info.plist includes `UIBackgroundModes/location`, `NSLocationWhenInUseUsageDescription` and `NSLocationAlwaysAndWhenInUseUsageDescription`. Check actual entitlement, user-facing iOS permission flow and App Store explanation.
- [ ] Android manifest includes fine/coarse/background location, foreground-service location, Android 13+ `POST_NOTIFICATIONS`; native plugin service shows an **ongoing** notification while tracking. Confirm Android 14/15/16 behavior and notification permission flow; verify Settings restrictions do not silently lose fixes.
- [ ] Start Walk and Start Run in separate activities; selected kind freezes. Start another session while paused → explanation and single Resume primary action, not a silent no-op.
- [ ] Walk with real GPS in FOREGROUND; verify fix timestamps, accuracy filtering and no simulated location points; never infer distance from time alone.
- [ ] **Locked-screen 10-minute walk — its own PASS/FAIL (not proof of the entire core):** inspect timestamped real OS fixes, segment boundaries, and any gaps; verify the **implemented since NATIVE-02** disk queue and NATIVE-04 Android AES-GCM path using `drain → localStorage persist → ACK`. Independently test process kill/relaunch for restoration and unACKed redelivery, and key-loss/corruption quarantine. Do not interpolate missing GPS fixes. Record device/OS/build; none of this is device-verified yet.
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
1. **No guarantee of uninterrupted background GPS:** the owned native plugin implements an on-disk fix queue (NATIVE-02), with Android per-fix AES-GCM (NATIVE-04). This preserves only fixes the operating system actually delivered and the native code wrote successfully; force-quit, reboot, permissions, battery restrictions and OS throttling can still prevent new fixes. `drain`, ACK, process restoration and reboot behavior require separate physical PASS/FAIL observations, not one overall walk result.
2. **Local QA is explicitly not a functioning reward economy:** no server = no login, accepted miles, merchant balance, or credits. Local-only IDs are not valid server IDs. Running against real API requires separate reviewed config, authentication/cookie/origin/CORS design, anti-abuse checks and live tests.
3. **GPS privacy remains a release gate:** the full `PendingRun.points` is still in native WebView `localStorage` without additional app-managed encryption. Android native GPS JSONL is AES-GCM-encrypted since NATIVE-04; iOS uses locked-screen-compatible OS Data Protection. Neither change encrypts WebView `localStorage`, all metadata or diagnostic archives. Audit privacy/retention before wider beta; never upload raw trails to GitHub or share screenshots containing personal coordinates.
4. **Store listing/compliance:** iOS location background mode must justify essential user-initiated service; Android background location/foreground service and persistent notification require platform declarations/review. Developer accounts, signing and store review are not covered by these code commits.
5. **No confirmed real device run** and no guarantee of background continuity or Shake to Undo fix. An iOS/Android device is a release gate.

---

## NATIVE-02 addendum — persistent OS queue source added (not yet compiled on devices)

The original GPS-02 checklist describes the **NATIVE-01** callback-only plugin and
correctly recorded its missing native disk queue at that time. This remains
historical evidence, not the current implementation claim.

See [GPS-03-DURABLE-NATIVE-QUEUE.md](./GPS-03-DURABLE-NATIVE-QUEUE.md):
USKORUN now includes a custom MIT native recorder, app-private fsynced
GPS log, plus TS drain/ACK integration. NATIVE-03 independently confirmed an
Android compile at the earlier source SHA; NATIVE-04 added Android AES-GCM and
still needs fresh platform compilation. These commits do **not** prove actual on-device persistence,
OS background relaunch, or battery behavior. Re-test every GPS-02 scenario
against the **new exact branch SHA** after Xcode and Gradle compilation.

**Remaining release blockers:** app-managed encryption for WebView `localStorage`,
Android key-loss/quarantine and legacy migration on a real device, Android
background permission/store review, iOS compilation and force-quit/relaunch
semantics, separate foreground/lock/call/kill/reboot/revocation/OEM/offline-Finish
observations, and a real-server accepted Finish. See
[GPS-05-INSTALL-ON-DEVICE.md](./GPS-05-INSTALL-ON-DEVICE.md) for independent
PASS/FAIL records. No public deploy, stores or payments were authorized.
