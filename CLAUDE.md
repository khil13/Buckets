# Buckets — NBA Betting Insights App

## What this is
Buckets is a personal NBA research app: everything I want to check before placing a bet, on one screen. It surfaces matchup context, player prop trends, injuries, line movement, and a model projection, then compares that projection to the sportsbook line so I can see whether there's a real edge or not.

**Core principle: honesty over hype.** The app should say "no edge" often. Never inflate confidence. Every projection shows its implied probability, the book's implied probability (vig removed), and the gap. Every recommendation gets logged and graded so the model is accountable.

## Stack
- **Frontend:** React + Vite + TypeScript, Tailwind, installable PWA (mobile-first — I check this on my phone)
- **Backend/data:** Supabase (Postgres, auth, edge functions, scheduled jobs)
- **Hosting:** Netlify (auto-deploy from `main`)
- **Repo:** GitHub, feature branches + PRs, conventional commits
- **Charts:** Recharts

## Data sources (verify current pricing/limits before wiring up)
- **Stats, schedule, box scores:** balldontlie NBA API (or similar hosted API). Avoid scraping stats.nba.com directly from servers — it blocks cloud IPs.
- **Odds & props:** The Odds API (spreads, totals, moneylines, player props, multiple books)
- **Injuries:** source TBD — manual entry fallback is acceptable for v1
- All API keys live in Supabase secrets / `.env.local`, never committed. Provide `.env.example`.
- Cache everything in Supabase; the frontend never hits third-party APIs directly. Respect rate limits with scheduled pulls.

## Features by phase

### Phase 1 — Foundation
- Today's slate: games, tip times, spread/total/ML, best available line across books
- Game detail page: records, last-10 form, offensive/defensive rating, pace, rest days, back-to-back flags, home/away splits
- Daily data sync job (schedule, results, odds snapshots)

### Phase 2 — Player props
- Player page: last 5 / 10 / season averages vs the prop line, hit rate over the line
- Minutes trend and usage, performance vs this opponent, home/away split
- "Teammate out" split: how a player produces when a key teammate sits
- Prop board: every prop for the day, sortable by hit rate and edge

### Phase 3 — Model
- Game projection: team ratings adjusted for pace, rest, home court, injuries → projected score, spread, total
- Monte Carlo simulation (10k sims) → win %, cover %, over %
- Prop projections: minutes × per-minute rate with variance
- Edge display: model probability vs no-vig book probability; flag only when edge clears a threshold
- Line movement chart from odds snapshots

### Phase 4 — Accountability
- Bet log (manual entry): pick, line, odds, stake, result
- Auto-grade model picks after games finish
- Calibration chart (predicted % vs actual hit rate by bucket), ROI, CLV (closing line value)
- Performance split by bet type

## Design
- Dark theme, basketball-orange accent, clean card layout, fast to scan
- Confidence shown as numbers and plain language, not flashy badges
- Every screen loads fast on mobile; skeleton loaders, no layout jank
- Small responsible-gambling footer link

## Working rules for Claude Code
- Build one phase at a time; don't start the next phase until the current one works end to end
- Before a large change, outline the plan and wait for my OK
- Write types for all API responses; validate external data (zod)
- Unit-test the model math (probability conversion, vig removal, simulation)
- Commit in small, logical chunks with clear messages; open a PR per feature
- Keep this file updated when decisions change

## Status

**Phase 1 (Foundation): live on GitHub Pages, balldontlie verified, still needs an Odds API key.**

- Supabase project: a dedicated `buckets` project was created (separate from
  any other unrelated Supabase project on this account) — see project id in
  your Supabase dashboard. Schema (`teams`, `games`, `team_game_box_scores`,
  `odds_snapshots`, `sync_log`) is applied with RLS (read-only anon access).
- `daily-sync` edge function is deployed with `BALLDONTLIE_API_KEY` set and
  **verified against a real, populated response** (Feb 2026 date range: 10
  games, 20 teams, 20 box scores upserted correctly, zero schema errors).
  `ODDS_API_KEY` is still not set, so odds sync is skipped (logged as a
  warning, not an error) until that key is added.
- Scheduled via `pg_cron` + `pg_net` (`supabase/migrations/20260917080*.sql`)
  to run daily at 08:07 UTC — no external scheduler needed.
- Hosting: deployed to GitHub Pages (`khil13.github.io/Buckets/`) as a free
  interim host since Netlify wasn't available (no credits) — see README's
  "Hosting" section. `netlify.toml` is kept in place for an easy switch
  later.
- Frontend: Slate + Game Detail pages are built, tested against the schema,
  and confirmed rendering live (empty-state correctly shown during the
  off-season, since today's date has no games — the Feb 2026 backfill data
  used for verification is intentionally left in the DB as real historical
  data, not cleaned up). Advanced team metrics (off/def rating, pace) are
  intentionally left blank rather than estimated from insufficient inputs —
  see README's "Data honesty" section.
- Next: get an Odds API key, verify `src/lib/schemas/oddsapi.ts` against a
  live response the same way balldontlie was verified, confirm odds show up
  on the Slate page once the season starts (or via a manual backfill call),
  then move to Phase 2.
