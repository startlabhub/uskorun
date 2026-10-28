# USKORUN Web — GPS-first alpha

**Status:** executable implementation branch, not yet independently tested or approved for public users.

## Included
Mobile Next.js application, 18+ signup/login, challenges and joining, foreground GPS with server plausibility checks, separate run/walk points, teams/invites, demo voucher issuance, QR/manual-code merchant redemption, audit records and Railway health check.

**Important:** iPhone/Android mobile browser GPS can stop recording with the screen locked. GPS traces can be spoofed. Until GPS-01 and independent security/privacy QA pass, only capped DEMO rewards may be issued; no real merchant benefits are promised.

## Local setup
1. Node 22 and PostgreSQL 15+.
2. `cd apps/web && npm install`
3. Add `.env.local` with `DATABASE_URL` and strong random `APP_SECRET` of at least 32 characters.
4. `npm run migrate` for DB and harmless demo data.
5. `npm run dev` to open http://localhost:3000.
6. `npm test && npm run typecheck && npm run build`

### Role setup for restricted test operations
Create user normally; run `npm run grant-role -- admin@example.com admin` in a trusted shell connected to the database. Grant merchant roles separately and bind staff to explicitly approved offers in `merchant_access`. Never allow arbitrary public role assignment.

## Railway staging
Set GitHub source to `startlabhub/uskorun` with branch `feat/mvp-foundation-gps` until PR is reviewed, root directory `apps/web`. Create PostgreSQL and reference its internal `DATABASE_URL`; set `APP_SECRET` as Railway secret, never commit it. Migrations run during startup, `/api/health` is deployment health check. Configure separate uptime monitoring and backups with restoration test.

## Not ready for public launch
Email verification, rate limits, account export/delete, final terms/privacy, independent GPS-01 device matrix, QA against coordinate spoofing, and formal sponsor offer agreements remain necessary. Tests must include concurrent voucher redemption, point caps, abuse/authorization and merchant scopes.

Coordination: [Issue #5](https://github.com/startlabhub/uskorun/issues/5); other agent is independent reviewer and should not create duplicate app.
