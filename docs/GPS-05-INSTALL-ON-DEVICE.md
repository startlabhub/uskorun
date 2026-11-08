# GPS-05 — Install USKORUN LOCAL NATIVE QA on a physical phone

**NATIVE-05 · Documentation only · NOT DEVICE-VERIFIED · no server, deploy, PR, merge, paid account or store registration.**

This runbook gets the already-built, **offline** QA app onto a real Android or iPhone. It is the next prerequisite for runtime observations—not proof of GPS reliability. Follow [GPS-02-NATIVE-QA.md](./GPS-02-NATIVE-QA.md) for acceptance criteria and [GPS-03-DURABLE-NATIVE-QUEUE.md](./GPS-03-DURABLE-NATIVE-QUEUE.md) for the queue/security contract.

**Evidence rule:** every reported result belongs to **one named device, OS version, APK/app build and test run**. One successful 10-minute walk is **not** a pass for calls, process death, reboot, permissions, battery restrictions, durable queue recovery or server validation. **Initial status for all physical cases below: NOT RUN.** Choose PASS / FAIL / BLOCKED / NOT RUN separately for each observation; include failure evidence and the exact device.

## A — Android: sideload local debug APK (no purchase, no server)

1. **Obtain the correct binary.** Request/download **`app-debug.apk` from Instinct's verified local NATIVE-04 build associated with source commit `a6e4df343df43df84e3d3ea5ed6fc7613e8c9aa3`**. The GitHub source commit/diff is **not itself an APK download**, and no binary download URL is established in this document. Ask the build operator for the actual file, build log, original source SHA, and SHA-256 checksum; verify checksum before installing. **Do not silently substitute the older NATIVE-03 APK from `9d94345`.** If provenance or the APK is unavailable, mark installation BLOCKED rather than claiming a verified current binary.
2. Transfer the APK to the Android phone using a trusted cable/file transfer or a private download. Open it using the app that actually handles the file (Files, browser, etc.).
3. When Android blocks the install, open **Settings → Apps → Special app access → Install unknown apps** (wording differs by manufacturer), select **that specific installer app**, and enable **Allow from this source**. Retry the installation. Do not enable unknown installs globally or disable Play Protect/security scanning. After installation, turn the per-source permission **off** if no longer needed.
4. Open **USKORUN**. Confirm the banner **`LOCAL NATIVE QA · NO SERVER`**, no real account login requirement, and location/notification explanations. Grant only the permissions intentionally requested by this test. For Android 11+, background location may need **Settings → Location permissions → Allow all the time** after the foreground grant; record the actual prompt/Settings path, never assume grant. Confirm an ongoing foreground-service notification while recording.
5. Start **Run** or **Walk** outdoors with **real phone GPS** and run the separate GPS-02 / matrix observations below. No Railway, backend, network connection or USKORUN account is needed for **local GPS capture QA**. A device may need its normal OS connectivity for APK transfer/initial settings; test the app itself with airplane mode or Wi-Fi/data disabled as appropriate.
6. This is a **debug-signed QA APK only**. It is not a release-signed package, must **never be distributed as the product**, uploaded to a store or represented as production-ready. The Android emulator from NATIVE-03a could not boot in Instinct's non-KVM environment; a physical phone avoids that particular blocker.

Optional USB install if the operator already has local Android SDK/ADB and the device has authorized USB debugging:

```sh
sha256sum app-debug.apk               # compare with operator-supplied checksum
adb devices                          # phone must be listed as device/authorized
adb install app-debug.apk            # QA artifact only; does not deploy server
```

ADB is optional; enabling USB debugging is **not** required for the normal sideload route.

## B — iPhone: Xcode and free Apple Personal Team (Mac required)

**Cost for personal-device development QA: $0.** A free personal Apple Account selected as a **Personal Team** in Xcode is sufficient for eligible on-device QA. **Apple Developer Program membership ($99/year in the US, subject to region/program changes) is NOT required for this personal test.** It is needed later for TestFlight, App Store distribution and additional developer-program capabilities. Apple states Personal Team development provisioning profiles expire **7 days** after issuance; rebuild/reinstall and reprovision to continue testing. Account/device/App ID limits also apply. A free Personal Team is not a distribution/signing program.

1. On a **Mac with current supported Xcode**, check out the review-only `feat/native-background-gps` source at a documented exact SHA and install local npm dependencies. **Do not use Railway or the remote-URL variant.** From the repo root:
   ```sh
   cd apps/web
   npm ci                         # or npm install if lockfile requires it
   npm run build:native           # packages local, no-server QA web assets
   npx cap add ios                # once for a fresh checkout
   node scripts/configure-native.mjs
   node scripts/install-durable-location.mjs
   ruby scripts/link-ios-xcodeproj.rb   # if xcodeproj gem is available
   ```
   If Ruby/Xcodeproj is not installed, **manually add all four** `USKDiskQueue.swift`, `USKLocationRecorder.swift`, `USKDurableLocationPlugin.swift`, and `USKBridgeViewController.swift` to the **App Xcode target** using Xcode; check **Target Membership**. If `npx cap add ios` says the platform already exists, do not repeat; use `npx cap sync ios` when needed, then rerun the native setup/link steps and inspect the generated files.
2. Open `ios/App/App.xcworkspace` (if CocoaPods generated it) in Xcode. Check the target's `Info.plist` for **`UIBackgroundModes/location`**, When-In-Use and Always usage descriptions, the app's `USKBridgeViewController` registration, `AppDelegate` restore hook, and all four Swift files in the target. **Swift compilation has not yet been independently verified**; resolve ordinary build/signing errors locally and record them as FAIL/BLOCKED rather than skipping checks.
3. In **Xcode → Settings → Accounts**, add the personal Apple Account. In **App target → Signing & Capabilities**, enable **Automatically manage signing** and select **Personal Team**. If required, give the *local test target* a unique bundle identifier (e.g., `com.example.uskorun.qa`); preserve project defaults in GitHub and do not commit personal signing identifiers. Some capabilities/entitlements may be unavailable for free signing—record the limitation; do not bypass Apple policies or claim an approved build.
4. Connect and trust an **actual iPhone**, select it as the Xcode run destination. Enable **Settings → Privacy & Security → Developer Mode** when prompted, restart/confirm if required. Click **Run** in Xcode to compile, sign and install on that device. A simulator-only build does not count.
5. Open the installed app, confirm **LOCAL NATIVE QA / NO SERVER**, grant the required foreground/background location permissions with the real iOS flow, and execute the **separate** GPS cases below. Locked phone and incoming-call cases must be tested on a real device. The OS may suppress automatic relaunch after force-quit; significant-location updates do not guarantee continuous tracking. The `completeUntilFirstUserAuthentication` file class permits access after **first unlock since boot** when re-locked; test reboot separately.

**No TestFlight, App Store upload, membership purchase, remote-URL activation or server restart** is part of this path.

## Device QA: eight independent observations — record each separately

Complete an independent row **for each device/OS/build**, with **PASS, FAIL, BLOCKED or NOT RUN** and evidence. A PASS means *only that observation on that device during that run*. Distinguish **real GPS observations**, simulated/mock coordinates and any real-backend evidence in your notes; screenshots alone cannot establish server ledger acceptance.

| ID | Test on physical device | PASS only if observed (otherwise FAIL/BLOCKED) | Result |
|---|---|---|---|
| **D1 Foreground** | Walk/run outdoors with location enabled; inspect received fixes, accuracy/timestamps and displayed distance | Real OS fixes recorded in sequence; simulated/mock points flagged separately; no invented gap/interpolation | **NOT RUN** |
| **D2 Locked 10 minutes** | Start, lock, walk 10 min, unlock; inspect native persisted records and route | Timestamped real fixes **actually delivered while locked**; drain/persist/ACK evidenced, gaps documented | **NOT RUN** |
| **D3 Phone call** | Receive/answer call during recording, return to app | Independent fix sequence and recorder/notification state during/after call; missing intervals recorded, not assumed | **NOT RUN** |
| **D4 Kill → relaunch** | Save route, terminate app/process under clearly stated method, reopen; force an unACKed test window if instrumented | Preserved PendingRun + native queued records recovered; **unACKed** fixes redelivered once into route via timestamp+segment dedup, no fake points; method/OS restrictions logged | **NOT RUN** |
| **D5 Full device reboot** | Record, reboot device, unlock once, relaunch and inspect; separately observe OS-triggered startup | Pre-reboot persisted fixes recovered correctly; **Android BOOT_COMPLETED receiver must be verified/implemented—not inferred from manifest permission alone**; iOS significant-change relaunch is opportunistic, not continuous GPS. Automatic restart is a distinct pass/fail and may be BLOCKED/not implemented | **NOT RUN** |
| **D6 Permission denial/revocation** | Deny at Start; separately revoke permission while recording; restore and try Resume | No false recording/award, explicit message, OS collector stops or recovers safely; existing saved fixes remain available; record platform permission screen | **NOT RUN** |
| **D7 Android OEM/battery** | Check battery-optimization settings/OS service status; repeat with OEM restrictions and app backgrounded | Document actual service survival/kill, notification and data gaps for this OEM/OS; do not generalize beyond this device; iOS: mark N/A with reason | **NOT RUN** |
| **D8 Offline Finish** | Network off, Finish, close/relaunch, inspect pending; Abandon deliberately in a separate test | Local-only Finish returns **503**, `pending_finish` + recorded fixes remain for retry and **zero points**; explicit Abandon clears this local QA session; never claim server acceptance | **NOT RUN** |

**Critical interpretation:** `drain` reads native records; JS saves the complete `PendingRun` to **on-device `localStorage`**; native `ACK` means **only that the records were locally persisted and may be removed from native backlog**. It is **NOT** acceptance by a real backend, not validation of the 5-mile cap, not a successful `Finish`, not points and not a durable encrypted server record. The current `localStorage` remains without additional app-level encryption. The Android native JSONL was hardened with Keystore AES/GCM in NATIVE-04, but encrypted-data recovery is **not device-proven**.

**Never replay `local-qa:<clientId>` activity IDs to a real API.** The client deliberately rejects them. **Server-validated Finish**, distance checks, idempotent points/ledger and account login remain a separate, owner-approved integration gate described in [GPS-04-REMOTE-SERVER-BUILD.md](./GPS-04-REMOTE-SERVER-BUILD.md). Its remote-`server.url` option is **not enabled**, requires a live authorized server and is not a production distribution approach. A simulated GPS route, emulator screenshot or local API 200 cannot be reported as real-server verification.

### Per-device evidence record (copy once for *each* test/device)

```text
Date/time + timezone:
Platform, maker/model, OS version, battery/OEM policy:
Installed app source commit SHA / build ID:
APK SHA-256 (Android) or Xcode signing/build identity (iOS):
Real outdoor GPS / developer simulated / mock coordinates?:
Test ID (D1…D8):
Start conditions + permission state:
Actual observation; timestamped native fix count and gaps (privacy-redacted):
Native queue drain count / local persist confirmed / ACK redelivery observed:
PASS / FAIL / BLOCKED / NOT RUN (one outcome, one reason):
Other tests NOT implied by this result:
```

Do not put personal coordinate trails, credentials, full device identifiers or captured location logs into public GitHub issues/commits. Collect redacted counts/times and ask for user consent before exporting diagnostic files.

## Review gates and source links

This runbook **documents steps only**: no APK attached here, no iPhone app signed, and **no runtime result can be called PASS until someone actually runs it on a physical phone**. Source inspection, an Android `assembleDebug` success, an installed emulator/AVD, and the absence of a server are all different facts.

- Apple free Personal Team / 7-day limits: https://developer.apple.com/help/account/basics/about-your-developer-account
- Apple free device testing: https://developer.apple.com/help/account/membership/programs-overview/
- Apple Developer Mode: https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device/
- Android per-source unknown-app install: https://developer.android.com/studio/publish
- Android Google Play restrictions/release signing are **not** bypassed by this QA procedure.
