# NATIVE-02 — USKORUN-owned durable GPS queue (review only)

## Scope and real guarantee

This is an **MIT-licensed, repository-owned Capacitor 7 plugin** named
`USKDurableLocation`. Swift (`CLLocationManager`) and Kotlin
(`LocationManager` in a foreground service) append **real OS-delivered fixes**
to an app-private on-disk JSONL log, with a filesystem sync **before** the
WebView sees the fix. Metadata is saved atomically. The old
`@capacitor-community/background-geolocation` callback adapter remains in
the tree for historical comparison, but **Track now exclusively uses our
USKDurableLocation plugin**, and fails closed if it is not installed.

**No hardware/software can create GPS points while the OS does not run
a location provider.** This preserves points already delivered to the native
process and written to disk. It does **not** guarantee samples through a
user force-quit, aggressive battery management, disabled permissions, or a
failed iOS significant-change relaunch.

The same `PendingRun`/`clientId`/`activityId`, `/api/action` start/finish
and server `assessGPS`/5-mi rules remain unchanged.

## Native disk protocol v1

- `begin({clientId, activityId, kind, segment})`: authorizes one on-disk
  session, starts native provider. A second session is rejected until
  completion/reset. Resuming reuses IDs and requires a nondecreasing segment.
- Every OS fix is `{seq,clientId,activityId,segment,lat,lon,accuracy,t}`.
  `t` is UTC milliseconds **from the OS observation**, never current JS time.
  `seq` is a durable monotonic sequence within the session.
- Native append writes one JSON line and calls `fsync`/synchronizeFile,
  then updates on-disk metadata. If disk write fails, the recorder stops
  rather than emitting an unpersisted point.
- `drain({limit:500})` is non-destructive, sorted by seq; it can run
  after WebView restart (and can return old segments).
- JS `mergeNativeFixes` validates session identity, accuracy, segment and
  monotonic timestamp order, deduplicates by **segment + timestamp**; it
  persists the full PendingRun to localStorage **before** issuing
  `ack({clientId,activityId,seqs})`.
- Native ACK advances only a verified **contiguous prefix**. A lost ACK
  response is safe: the next drain returns the same points, JS deduplicates,
  and the server still enforces one award per idempotent Finish.
- `pause/end` stop collection before drain. `reset` requires stopped
  recording and no unacknowledged fixes. No gap interpolation.
- Backlog limit 10,000 fixes: a full queue signals overflow and stops, not
  silently evicting route data. Corrupted/incomplete JSONL fails closed,
  requiring documented recovery, not automatic deletion.
- NATIVE-04 adds **Android Keystore AES-256-GCM to the native JSONL GPS
  queue** (details below), while iOS retains OS Data Protection class
  `completeUntilFirstUserAuthentication`. JS `localStorage`, queue metadata,
  archives of unreadable/legacy data, retention and whole-app privacy are
  separate release gates; this is **not** end-to-end encryption.

## NATIVE-04 — GPS storage protection decision (source implemented, device unverified)

### iOS: choose `completeUntilFirstUserAuthentication` (not `.complete`)

Apple's `FileProtectionType.complete` prevents **both reading and writing
while locked**, which directly breaks an ongoing, user-started background
walk/run. `completeUnlessOpen` permits access to an already-open file on
lock, but after close the file cannot be reopened until unlock; this code
**opens and closes the JSONL log on each GPS fix**, and atomically replaces
metadata. It is therefore not appropriate for reliable locked-device append
or recovery after a background process relaunch.

**Chosen:** existing `completeUntilFirstUserAuthentication` on the GPS
log, metadata and now explicitly on the containing directory and the
atomically replaced log after `reset`. Apple specifies that after **first
device unlock since boot**, files stay accessible even when re-locked.
Before that first unlock, access is unavailable — document this important
reboot edge case; never claim an app can capture at every boot stage.
This is OS Data Protection, not an additional app-managed AES key.
iOS Xcode/device testing remains OPEN.

Apple source: https://developer.apple.com/documentation/foundation/fileprotectiontype/completeuntilfirstuserauthentication
and https://developer.apple.com/documentation/foundation/fileprotectiontype/completeunlessopen

### Android: app-private FBE plus AES/GCM per GPS record

Default `Context.filesDir` is already Android **credential-encrypted,
app-private file-based encryption (FBE)**. On devices launched with Android
10+, FBE is required. It protects stored bytes before the first unlock;
afterward, the OS decrypts data transparently for the owning app.
The new app-level encryption adds AES-256-GCM-authenticated ciphertext
to the **native GPS fix JSONL**, especially to limit **passive offline file
extraction** from a rooted/unlocked system or a leaked app-private file.
It does **not** stop a fully compromised/running/rooted process from
invoking Keystore and reading the route, nor protect JS localStorage.

- Owned `USKQueueCrypto.kt` uses Android Keystore key alias
  `uskorun_gps_queue_aes_v1`, AES-256 with GCM/NoPadding.
  **No user-auth requirement, no biometric-enrollment invalidation**:
  `setUserAuthenticationRequired(false)`; neither
  `setUserAuthenticationRequired(true)` nor
  `setInvalidatedByBiometricEnrollment` is used. Screen lock and biometric
  changes do **not** intentionally invalidate the key.
- One record = `gcm1:` + Base64(**12-byte unique Keystore-generated IV**
  || ciphertext || **128-bit authentication tag**), then newline.
  Encryption/tag are complete **before** the append/FD `sync`;
  `drain` decrypts and authenticates before giving records to JS.
  The wire format `{seq,clientId,activityId,segment,lat,lon,accuracy,t}`,
  sequence boundaries, `drain → durable PendingRun → ACK`, retry,
  dedup by `segment+timestamp` and existing server 5-mi cap are unchanged.
- Pre-existing *plaintext* NATIVE-03 JSONL logs are decoded and converted
  on initialization, with a fully fsynced encrypted staged file before
  replacement. Deleting legacy plaintext does **not** guarantee secure
  physical overwrite on flash; legacy-device privacy review is still needed.
- If a file cannot be read/decrypted (Keystore key missing, auth tag
  failure, corruption), the original file and metadata are preserved under
  `unreadable-<timestamp>` diagnostic names. The app starts a fresh native
  queue, persists a `loss` warning from `drain`, and **does not silently
  ACK, reconstruct samples or credit a Finish**. JS explicitly reports
  that GPS points could not be recovered and requires user Abandon before
  a new activity. The prior encrypted log is left for owner-approved
  diagnostics, **not** uploaded or wiped automatically. On disk write/key
  errors during recording the existing foreground service catches failure
  and stops; crash-free handling is a **physical runtime test gate**,
  not a claim of completed device QA.
- Queue **metadata**, `lostRun`, unencrypted JS `localStorage`
  (including complete `PendingRun.points`), legacy diagnostic files,
  backup eligibility, archival deletion and retention need separate
  security review. Do not call the whole app or all location information
  encrypted by our new AES code.

Android sources: https://developer.android.com/privacy-and-security/keystore ,
https://developer.android.com/reference/android/security/keystore/KeyGenParameterSpec.Builder ,
https://source.android.com/docs/security/features/encryption/file-based .

### Verification and next release gates

Run exact-SHA `npm test` (81 previous tests + new queue-loss tests),
`npm run typecheck`, `npm run build`, `npm run build:native`.
Then rebuild the native Android project using
`npm run native:install-owned` (copies `USKQueueCrypto.kt` as a **fourth
Kotlin file**), `cd android && ./gradlew assembleDebug`.
The NATIVE-03 Android compile result at SHA `9d943454...` does not
verify these new security changes. A fresh APK inspection and physical
locked-screen, call, key loss/queue quarantine and migration test are
mandatory. iOS Swift compile remains OPEN. No server/deploy/store actions
are authorized.

For optional server-required account/points test builds, see
[GPS-04-REMOTE-SERVER-BUILD.md](./GPS-04-REMOTE-SERVER-BUILD.md).
No `server.url` is enabled by these changes.

## Exact platform build steps after a disposable checkout

No staging service, DB migration, API key, store registration, paid library,
cloud resource or Railway action is used by these commands.

```sh
cd apps/web
npm ci || npm install               # local npm dependency install
npm test
npm run typecheck
npm run build                       # Next production web build
npm run build:native                # packaged static web, local QA stub
npm run native:platforms            # cap add iOS/Android + permissions + owned source installer
```

After native platforms exist, `npm run native:sync` rebuilds static assets
and re-runs the own plugin installer. Run these on local developer machines;
they are not executed by this GitHub change.

### iOS (macOS/Xcode required)

1. Generated files are at `ios/App/App`. The installer copies four Swift
   files from `native-plugins/durable-location/ios`, updates
   `AppDelegate.swift` to call
   `USKLocationRecorder.shared.restoreAfterLaunch(options: launchOptions)`,
   and changes `Base.lproj/Main.storyboard` to
   `USKBridgeViewController`. The existing
   `scripts/configure-native.mjs` adds usage descriptions and
   `UIBackgroundModes/location`.
2. **Target membership is mandatory**. Run
   `ruby scripts/link-ios-xcodeproj.rb` if the `xcodeproj` gem is
   installed; otherwise open `ios/App/App.xcworkspace` (or `.xcodeproj`),
   **Add Files to App** for all four Swift files, select **App** Target
   Membership. Confirm no duplicate references.
3. Verify storyboard controller class `USKBridgeViewController`, module
   `App`; `AppDelegate` calls the restore hook on every launch,
   including `UIApplication.LaunchOptionsKey.location` wake-ups.
4. Compile locally with a valid Xcode/iOS SDK (for example,
   `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator build`
   when the workspace is generated). Signing on a physical phone is an
   **independent approval/device gate**.
5. Location: user must grant **Always**. Start/Resume may request
   When In Use and then Always across multiple attempts, with clear UI.
   If unavailable, start fails closed.

**Important:** Apple's significant-change monitoring is only a possible
background relaunch mechanism, typically after large displacement (around
500 metres), potentially with several minutes between events. Standard
continuous GPS ends on process termination. Force-quit, Background App
Refresh settings and system policies can suppress relaunch entirely.
Do not present it as guaranteed 10-minute tracking while killed.

### Android (local Android SDK/Gradle required)

1. Installer copies `USKQueueCrypto.kt`, `USKDurableStore.kt`, `USKLocationService.kt`,
   `USKDurableLocationPlugin.kt` to generated
   `android/app/src/main/java/com/uskorun/app`; registers plugin in
   `MainActivity`; declares a non-exported service with
   `android:foregroundServiceType="location"`; adds Kotlin
   Gradle plugin `1.9.25`.
2. `scripts/configure-native.mjs` adds
   `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`,
   `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`,
   `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`.
   Confirm permissions and service in **merged** Android manifest.
3. Build locally with installed JDK 21 and Android SDK:
   `cd android && ./gradlew :app:assembleDebug`; inspect Kotlin version,
   Android Gradle Plugin compatibility, notification icon, and service type.
4. Start the service **from the visible app** after location permission and
   notification disclosure; Android 12+/14+ restrict background service
   creation and location while-in-use access. Background permission
   and Play policy disclosure require independent platform verification.
   Android `START_STICKY` is a restart request, **not a guarantee** after
   force-stop/Task Manager stop/battery optimization.

## Tests and release gates

- [ ] Independent **exact-SHA** `npm test`, `npm run typecheck`,
      `npm run build`, `npm run build:native`, `npm run native:platforms`.
- [ ] iOS Swift compiler + Android Kotlin/Gradle compiler; generated project
      linking/manifest merger. Source files alone do not prove compilation.
- [ ] Device 10-minute walk (screen locked), phone call, foreground
      navigation, process kill/relaunch, Android service notification and
      system battery restrictions. Capture **actual timestamped fix sequence**;
      log unrecorded intervals, with no artificial distance.
- [ ] Offline Finish/retry with the **same activity ID** and at most one
      server ledger credit, 0.03 mi minimum, 5-mi cap, per-day and session
      caps, and strict offer permissions.
- [ ] Native disk corruption/incomplete tail/overflow and data retention
      policy; Android 11+ background location grant flow;
      privacy audit (JS localStorage/metadata/legacy diagnostics, plus native encrypted queue);
      Apple/Google declarations; genuine hardware and signing.
- [ ] Do not run staging, migrations, stores, payments or release without
      further owner approval. Physical QA **NOT RUN**; NATIVE-03 Android compiled the prior SHA,
      but NATIVE-04 Android codec and iOS changes are **NOT YET REBUILT**.

## Sources for platform claims
- Capacitor 7 custom Swift/Kotlin native plugin registration:
  https://capacitorjs.com/docs/v7/ios/custom-code and
  https://capacitorjs.com/docs/v7/android/custom-code
- Apple significant location wake-up:
  https://developer.apple.com/documentation/corelocation/cllocationmanager/startmonitoringsignificantlocationchanges()
- Android foreground service location:
  https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
