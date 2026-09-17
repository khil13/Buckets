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

**Phase 1 (Foundation): scaffolded, awaiting real API keys.**

- Supabase project: a dedicated `buckets` project was created (separate from
  any other unrelated Supabase project on this account) — see project id in
  your Supabase dashboard. Schema (`teams`, `games`, `team_game_box_scores`,
  `odds_snapshots`, `sync_log`) is applied with RLS (read-only anon access).
- `daily-sync` edge function is deployed but has no API keys configured yet
  (`BALLDONTLIE_API_KEY`, `ODDS_API_KEY`) — set them as Supabase secrets, then
  wire up a `pg_cron` schedule (see README) to start populating real data.
- Frontend: Slate + Game Detail pages are built and tested against the
  schema, but haven't been checked against live data yet since no keys are
  set. Advanced team metrics (off/def rating, pace) are intentionally left
  blank rather than estimated from insufficient inputs — see README's "Data
  honesty" section.
- Next: add real API keys, verify a `sync_log` row after the first live
  `daily-sync` run, fix any field-name mismatches in
  `src/lib/schemas/{balldontlie,oddsapi}.ts` if the zod parse fails, then
  confirm the Slate/Game Detail pages render real games end to end before
  starting Phase 2.
