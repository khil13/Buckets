# Buckets

NBA betting research app — matchup context, props, and model edge in one
place. See `CLAUDE.md` for the full product spec and phased roadmap. This is
**Phase 1: Foundation** — today's slate, a game detail page, and the daily
data sync job. No props, model, or bet tracking yet.

## Stack

- React + Vite + TypeScript + Tailwind, installable PWA
- Supabase (Postgres, edge functions) for data + the daily sync job
- Netlify for hosting (`netlify.toml` is set up; connect the repo to deploy)
- Zod for validating all external data (API responses and DB rows)
- Vitest for unit tests

## Hosting

Currently deployed to **GitHub Pages** (`khil13.github.io/Buckets/`) as a
free interim host via `.github/workflows/deploy-pages.yml`, which builds
and deploys on every push to `main`. This requires hash-based routing
(`createHashRouter` in `src/router.tsx`) and a `VITE_BASE_PATH=/Buckets/`
build-time override (`vite.config.ts`), since Pages serves a project site
under a subpath with no server-side rewrites.

`netlify.toml` and Netlify's SPA redirect config are left in place — moving
to Netlify later means connecting the repo there (see steps below) and
switching `src/router.tsx` back to `createBrowserRouter`.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's URL + publishable key
npm run dev
```

`.env.local` is git-ignored. The Supabase URL/key are safe to have client-side
(read-only via RLS) but should still come from your own project, not be
committed.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — typecheck + production build
- `npm run typecheck` — TypeScript project-references check
- `npm run lint` — ESLint
- `npm run test` — Vitest (pure-function/model math + zod schema tests)

## Backend (Supabase)

Schema lives in `supabase/migrations/`. Tables: `teams`, `games`,
`team_game_box_scores`, `odds_snapshots`, `sync_log`. All tables are
read-only to the anon/publishable key (RLS); writes only happen through the
`daily-sync` edge function's service-role key.

### `daily-sync` edge function

`supabase/functions/daily-sync/index.ts` pulls the next ~week of games from
balldontlie and odds (spreads/totals/moneyline) from The Odds API, upserts
them, and logs every run to `sync_log` — including a clean "not configured"
log entry if API keys are missing, rather than crashing.

Required secrets (set with `supabase secrets set KEY=value`, or in the
Supabase dashboard — **never** commit these):

- `BALLDONTLIE_API_KEY`
- `ODDS_API_KEY`

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by
Supabase for every edge function — nothing to set.)

It runs on a schedule via `pg_cron` (`supabase/migrations/20260917080100_schedule_daily_sync_cron.sql`),
once daily at 08:07 UTC, calling itself through `pg_net` from inside the
database rather than an external scheduler. To change the time or add a
second run, `cron.schedule('daily-sync', ...)` with a new cron expression
replaces the existing job of the same name.

You can also invoke it manually with an optional `start_date`/`end_date`
override — useful for backfilling or re-verifying against a specific range:

```bash
curl "https://smtpfhinrmjpxxthqnie.functions.supabase.co/daily-sync?start_date=2026-02-03&end_date=2026-02-03"
```

The function has `verify_jwt` disabled since it's an internal scheduled job
with no user-facing auth — it's safe because every write is an idempotent
upsert, but don't put anything sensitive behind it later without adding a
shared-secret check.

**Verified against live data:** the `balldontlie` integration has been
confirmed against a real, populated response (a February 2026 date range) —
the zod schema in `src/lib/schemas/balldontlie.ts` and its edge-function
duplicate parse real games correctly (see `CLAUDE.md`'s Status section).
`ODDS_API_KEY` is still unset, so `oddsapi.ts`'s schemas remain unverified
against a live response until that key is added.

## Data honesty

Advanced team metrics (offensive/defensive rating, pace) are **not**
computed in Phase 1 — balldontlie's schedule endpoint only gives final
scores, and fabricating a "rating" from insufficient inputs would violate
this app's honesty-over-hype principle. The game detail page shows real
per-game point averages and leaves pace/ratings blank until a real data
source for them is wired up (Phase 2/3).
