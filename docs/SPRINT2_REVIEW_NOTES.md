# USKORUN Sprint 2 — independent review handoff

This branch was created from exact baseline commit `97244892e586fe88b42f0c6b4bfa4c060c0ca23f`. The modifications have been **applied directly to apps/web** and can be checked without ZIP extraction or running an apply script.

**Cloud hold:** No changes to the Railway-connected `feat/mvp-foundation-gps` or `main`. No PR or deployment is requested/authorized. Railway web is still connected to the old feature branch; do not connect it to this review branch without Ilya's approval.

## Scope
24 anchored replacements in 8 existing source/config files, plus new GPS segment/recovery, auth limits, transactional activity/reward modules and tests. See `docs/SPRINT2_REVIEW_CHANGE_SUMMARY.md`. Phone GPS checklist: `docs/GPS-01-CHECKLIST.md`.

## Verification boundaries
- 23/23 standalone pure-unit tests were run in the previous offline package (output in docs/SPRINT2_REVIEW_UNIT_TEST_RUN.txt). This is **not** a verification of the full published review branch.
- Previous 97244892 branch passed 8/8, typecheck and build, per independent review, **not** evidence for Sprint 2.
- This review branch's npm test, typecheck, build and disposable PostgreSQL concurrency suite remain **not run** until independent QA applies a local checkout with dependencies. Physical GPS-01 tests remain not run.
- SQL migration `apps/web/scripts/sprint-2-migration.sql` is included; do not run against Railway or any personal database. Use disposable local test DB only.

## Local QA (NO PUSH)
```bash
git clone https://github.com/startlabhub/uskorun.git
cd uskorun
git switch review/sprint2-offline-hardening
cd apps/web
npm install --ignore-scripts
npm test
npm run typecheck
npm run build
# Test DB only, with written approval for that isolated local DB:
TEST_DATABASE_URL=postgresql://localhost:5432/uskorun_test npx tsx --test tests/db-races.integration.ts
```

QA findings to PR #6 and issue #5. Do not open a PR from this branch or merge without Ilya's explicit decision.
