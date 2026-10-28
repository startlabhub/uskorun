# Sprint 2 — Change summary against PR #6 head 97244892

**No GitHub commit and no Railway deployment in this sprint.** This is the review diff plan and offline apply bundle, NOT an uploaded PR patch.

### Replaced / edited by apply_sprint.py
| File | Change |
| --- | --- |
| `apps/web/src/domain/gps.ts` | Mandatory GPS segment markers; reset previous anchor at pause/visibility; stricter timestamp windows; preserve 1Hz cumulative short-step algorithm |
| `apps/web/src/app/page.tsx` | Durable tab-scoped draft with immutable failed-Finish payload, retry same client/server IDs, abandon, in-flight Start guard, visibility pause, QR fragment and history scrub, no-referrer behavior |
| `apps/web/src/app/api/action/route.ts` | Use transaction-safe activity and reward services, recover/abandon actions, auth limits and redeem-attempt limits |
| `apps/web/src/app/api/data/route.ts` | Return owner-only client ID to recover orphaned server recording |
| `apps/web/src/server/security.ts` | Async scrypt hashing/check and bounded auth input before hash attempt |
| `apps/web/next.config.mjs` | `Referrer-Policy: no-referrer` and `X-Content-Type-Options: nosniff` |
| `apps/web/scripts/migrate.ts` | Run safe preflight SQL migration before serving |
| `apps/web/tsconfig.json` | Enable type-safe `.ts` imports in noEmit project for portable Node22 test suite |
| `apps/web/src/app/privacy/page.tsx` | Explicitly disclose unencrypted tab sessionStorage of raw GPS points during recovery |

### New code / tests
- `apps/web/src/domain/{pending,auth-guard,voucher-handoff}.ts`
- `apps/web/src/server/{activity-service,reward-service,auth-rate}.ts`
- `apps/web/scripts/sprint-2-migration.sql` (one recording per user partial unique index and auth throttle table)
- `apps/web/tests/{gps,pending,auth-guard,voucher-handoff}.test.ts`
- `apps/web/tests/db-races.integration.ts` (**written, not executed; real test PostgreSQL needed**)
- `docs/GPS-01-CHECKLIST.md` (manual device worksheet; no physical tests run)

### Verification and remaining blockers
- Baseline anchors validated through read-only GitHub file reads for all expected file markers.
- Local standalone Node22 pure tests **23 passed**; not the Next.js application build.
- DB integration test **skipped** because TEST_DATABASE_URL unset.
- New branch CI, full Next.js typecheck/build, migration dry-run, device tests, end-to-end browser checks and independent review **not yet passed**.
- Public signup, raw location retention policy, merchant legal approval, rate control hardening and paid deployment remain blocked.

### How to generate the actual git diff without triggering deploy
Clone commit `97244892` on a **local non-connected branch** and run `python apply_sprint.py /path/to/repo`, then `git diff --stat; git diff -- apps/web`. The script never pushes and refuses mismatched HEAD. It is not safe to push directly to `feat/mvp-foundation-gps` while automatic Railway source deployment remains configured.


## Publication clarification
The preceding change summary describes the **original offline package**. On review/sprint2-offline-hardening, changes are directly applied to the sources in apps/web and committed as a review-only snapshot based on 97244892e586fe88b42f0c6b4bfa4c060c0ca23f. New review branch has no PR or deployment. Full integrated app build, PostgreSQL races and phone GPS tests remain unverified.
