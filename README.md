# Buckets

NBA betting research app — matchup context, props, and model edge in one
place. See `CLAUDE.md` for the full product spec and phased roadmap.
**Phase 1 (Foundation)** and the core of **Phase 2 (Player props)** are
built: today's slate, a game detail page, a player page, a prop board, and
the daily data sync job. No model or bet tracking yet, and "teammate out"
splits are deferred (see `CLAUDE.md`'s Status).

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
`team_game_box_scores`, `odds_snapshots`, `players`, `player_game_stats`,
`player_prop_snapshots`, `sync_log`. `teams.id`/`games.id`/`players.id` are
SportsGameOdds' own string ids (`teamID`/`eventID`/`playerID`), used
directly as primary keys. All tables are read-only to the anon/publishable
key (RLS); writes only happen through the `daily-sync` edge function's
service-role key.

### `daily-sync` edge function

`supabase/functions/daily-sync/index.ts` pulls the next ~week of games,
team + player box scores, and team + player-prop odds from a single
source — [SportsGameOdds](https://sportsgameodds.com) — upserts them, and
logs every run to `sync_log`, including a clean "not configured" log entry
if the API key is missing rather than crashing. (balldontlie + The Odds
API were the original plan, but SportsGameOdds turned out to offer
schedule, box scores, *and* odds — with a pre-computed no-vig "fair" price
per market — in one call, so it replaced both. See `CLAUDE.md`'s Status
section for how that decision was made.) Player data (roster, box stats,
prop odds) comes from the *same* API response as team data — no extra
fetch, just more of it parsed.

Required secret (set with `supabase secrets set KEY=value`, or in the
Supabase dashboard — **never** commit this):

- `SPORTSGAMEODDS_API_KEY`

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
curl "https://smtpfhinrmjpxxthqnie.functions.supabase.co/daily-sync?start_date=2026-10-20&end_date=2026-10-20"
```

The function has `verify_jwt` disabled since it's an internal scheduled job
with no user-facing auth — it's safe because every write is an idempotent
upsert, but don't put anything sensitive behind it later without adding a
shared-secret check.

**Verified against live data:** the SportsGameOdds integration (schedule,
team + player odds, roster) was confirmed against real responses and real
`daily-sync` invocations during development — see `CLAUDE.md`'s Status
section for specifics and what's still pending (box scores/player game
stats need a completed game to fully verify, since the season hasn't
started yet).

## Frontend pages

- `/` — today's slate
- `/game/:gameId` — game detail (records, form, splits, rest, pace/ratings)
- `/props` — prop board, sortable by hit rate or by average-vs-line gap
- `/player/:playerId` — player detail (averages, hit rate, minutes/usage
  trend, home/away and vs-opponent splits); reached from a prop board row,
  which passes `?stat=&line=&opponent=` in the URL

## Data honesty

Offensive/defensive rating and pace are computed from real per-game box
score inputs (`FGA`, `OREB`, `TOV`, `FTA`) using the standard single-game
possession approximation, and labeled "est." in the UI — they're a
simplified per-game number, not a true seasonal advanced stat. A player's
"usage trend" is a raw shot/possession-involvement count
(`FGA + 0.44×FTA + TOV`), not a normalized usage-rate percentage, which
would need on/off-court data this app doesn't have. The prop board's "gap"
(season average minus the line) is a simple directional signal, not a
model edge — that's Phase 3, once a real model exists. Line/odds values
shown are the best available price found across the books SportsGameOdds'
current API tier returns (its own response notes that a higher tier would
include more bookmakers).
