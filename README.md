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

To run it on a schedule, add a `pg_cron` job that calls the function once a
day, e.g. via the SQL editor:

```sql
select cron.schedule(
  'daily-sync',
  '0 9 * * *', -- 9am UTC daily; adjust to your timezone
  $$
  select net.http_post(
    url := 'https://<your-project-ref>.functions.supabase.co/daily-sync',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
```

The function has `verify_jwt` disabled since it's an internal scheduled job
with no user-facing auth — it's safe because every write is an idempotent
upsert, but don't put anything sensitive behind it later without adding a
shared-secret check.

**Known gap:** this was built in a sandboxed dev environment whose network
egress blocks both balldontlie's and The Odds API's docs sites, so the zod
schemas in `src/lib/schemas/{balldontlie,oddsapi}.ts` (and their duplicates
in the edge function) are written from well-established public API shapes,
not a verified live response. Once you add real API keys, check a `sync_log`
row after the first run — if parsing fails, the fix is isolated to those
schema files.

## Data honesty

Advanced team metrics (offensive/defensive rating, pace) are **not**
computed in Phase 1 — balldontlie's schedule endpoint only gives final
scores, and fabricating a "rating" from insufficient inputs would violate
this app's honesty-over-hype principle. The game detail page shows real
per-game point averages and leaves pace/ratings blank until a real data
source for them is wired up (Phase 2/3).
