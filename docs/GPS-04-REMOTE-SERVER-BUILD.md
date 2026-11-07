# GPS-04 — Optional remote-server Capacitor build (DOCUMENTATION ONLY)

**Status: NOT ENABLED / NOT APPROVED / NOT DEPLOYED.** No committed
`server.url` and no Railway, backend, account, payment, store or DNS action
is authorized by this document. The default `apps/web/capacitor.config.ts`
continues to package `native-dist` with LOCAL NATIVE QA / NO SERVER.

## Why this is a separate option

The packaged static Next.js export excludes API route handlers. It can record
and persist **real device GPS locally** without a live server, but
`Start` returns `local-qa:<clientId>`; `Finish` intentionally responds
HTTP 503, and it cannot authenticate accounts or award points.

A remote-URL shell loads a separately approved **running** Next.js server,
including its `/api/action` and `/api/data` routes. It is **not** a
replacement for the offline GPS QA build, and loses its UI/account capabilities
when that server is offline.

**Vendor warning:** Capacitor v7 `server.url` is intended for
live-reload/development. Capacitor documentation explicitly states that it
is **not intended for production**. Treat a remote-URL shell as
a temporary, separately approved testing build only, not an approved
App Store distribution architecture. App Store guideline 4.2 requires
meaningful app functionality beyond a repackaged website.

## Separately approved development build procedure (not executed)

1. Obtain **new written owner approval** of the backend hostname, active
   staging window, Railway budget/monitoring/stop time, test accounts,
   privacy terms and deployment branch. Never enable an automatic deployment
   from `feat/native-background-gps` or touch `feat/mvp-foundation-gps`
   without additional approval.
2. Create a **local, uncommitted, ignored** copy of the Capacitor config
   or temporary disposable worktree. For an approved HTTPS QA server only,
   use a temporary `server` option such as:
   ```ts
   server: {
     url: 'https://APPROVED-QA-HOST.example',
     cleartext: false,
     androidScheme: 'https',
     iosScheme: 'capacitor'
   }
   ```
   The example hostname is a placeholder, **not** a live endpoint. Do
   **not** commit or push this setting; restore the checked-in config
   before concluding the test.
3. A running Next.js server is required. Verify HTTPS, valid certificate,
   application-origin behavior, authenticated cookies/SameSite/CSRF,
   routing, and that the remote page runs inside Capacitor with the owned
   `USKDurableLocation` plugin registered. Never assume a standard browser
   background GPS or a remote website can use native plugins without testing.
4. **Never replay a local QA ID** (`local-qa:<clientId>`) to the real
   backend. The current `apiFetch` rejects those IDs. Explicitly Abandon
   the local activity and verify the native queue is cleared before
   switching modes. Real server-generated IDs must remain stable across
   Retry Finish; confirm exactly one server-side award on retries.
5. On a disposable local build, run `npm ci`, `npm test`,
   `npm run typecheck`, `npm run build`, then regenerate/sync the
   **native** project with the temporary config, and compile iOS/Android
   on supported SDK hosts. Native platform files and generated artifacts
   are local, not staged or published. Check the effective bundled config
   and ensure the production/release variant does not retain `server.url`.
6. Test online/offline transitions, location permission while locked,
   phone calls, OS process termination and relaunch, background service
   notification, native disk queue drain/ACK, invalid session handling,
   server assessGPS and 5-mile cap, duplicate Finish protection,
   battery and privacy. A network outage must **not** invent
   GPS fixes, activity IDs or confirmed points.
7. Shut down any separately approved test infrastructure inside its
   authorized window. Remove the temporary `server.url` worktree/config
   and independently verify the checked-in default remains offline.
   Record exact source SHA, platform binaries, backend environment,
   test evidence and stop confirmation in Ledger.

## Decision / release gates

- A remote-URL build cannot operate account/login/validated Finish/points
  with staging shut down. Standalone offline native GPS QA does **not**
  need a backend and should be tested first.
- The native queue's Android AES/GCM encryption does **not** encrypt
  the JS `localStorage` `PendingRun`, metadata or iOS app data; privacy,
  retention, export/deletion and device QA remain release gates.
- iOS app background location justification, Apple App Store guideline
  4.2 minimum functionality, Android Play background location and
  foreground-service declarations require a fresh store review. No
  purchase, enrollment, signing identity, upload or release is implied.
- Alternative product architecture for release is a packaged app-native
  client with a separately approved API base URL, secure authentication,
  durable queue and explicit offline synchronization. Design and QA
  would need a new, owner-approved change set; it is **not** implemented
  here.

## Authoritative references

- Capacitor 7 config (`server.url` live reload, not for production):
  https://capacitorjs.com/docs/v7/config
- Apple App Review Guidelines 2.1 and 4.2:
  https://developer.apple.com/app-store/review/guidelines/
- Android background location restrictions:
  https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
