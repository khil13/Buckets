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
- **Stats, schedule, box scores, odds & props:** [SportsGameOdds](https://sportsgameodds.com) — one API for
  schedule, team/player box scores, and odds (spreads/totals/moneylines/props) across multiple books, plus a
  pre-computed no-vig "fair" price per market. Originally planned as balldontlie (stats) + The Odds API (odds)
  as two separate vendors, until testing the account's actual API key showed SportsGameOdds covers both in one
  call with richer data (see Status). Avoid scraping stats.nba.com directly from servers — it blocks cloud IPs.
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

**Phase 1 (Foundation): live on GitHub Pages, rebuilt on SportsGameOdds, awaiting the live secret to close the loop.**

- **Data source change:** the account's odds API key turned out to be for
  SportsGameOdds, not The Odds API as originally planned. Probing it live
  (via `pg_net` from inside Supabase, bypassing this dev sandbox's blocked
  egress) showed it returns, per event: full schedule with real tip times,
  team *and player* box scores (enough to compute real pace/off/def
  ratings instead of leaving them blank), and odds across 6+ books with a
  pre-computed no-vig "fair" price per market. That's enough to replace
  both balldontlie and The Odds API with one source — confirmed with me
  before rebuilding `daily-sync` and the schema around it (large-change
  rule above).
- Supabase project: a dedicated `buckets` project was created (separate from
  any other unrelated Supabase project on this account) — see project id in
  your Supabase dashboard. Schema (`teams`, `games`, `team_game_box_scores`,
  `odds_snapshots`, `sync_log`) uses SportsGameOdds' own string ids
  (`teamID`/`eventID`) as primary keys and is applied with RLS (read-only
  anon access). `odds_snapshots.fair_price` stores the de-vigged price —
  serves this file's core principle years ahead of Phase 3.
- `daily-sync` edge function is rewritten for the single-source flow and
  deployed, but needs `SPORTSGAMEODDS_API_KEY` set as a secret (same
  manual step as before — no tool exists to set Supabase secrets remotely)
  before it can run for real. The zod schemas and `oddID` filtering rules
  (which markets are team-level moneyline/spread/total vs. player props)
  were built from real captured responses, not guessed.
- Scheduled via `pg_cron` + `pg_net` (`supabase/migrations/20260917080100_...sql`)
  to run daily at 08:07 UTC — no external scheduler needed. (An earlier
  migration enabling `pg_net`/`pg_cron` and the original balldontlie-shaped
  schema were superseded by `20260917090000_switch_to_sportsgameodds_ids.sql`,
  which drops and recreates the 4 data tables with the new id types — the
  10 test games from the balldontlie verification were incompatible with
  the new scheme anyway and weren't preserved.)
- Hosting: deployed to GitHub Pages (`khil13.github.io/Buckets/`) as a free
  interim host since Netlify wasn't available (no credits) — see README's
  "Hosting" section. `netlify.toml` is kept in place for an easy switch
  later.
- Frontend: Slate + Game Detail pages, hooks, and lib layer are all updated
  for string ids and the `fair_price` field; typecheck/lint/test/build all
  clean (19 tests). Off/def rating and pace are now computed from real box
  score inputs (FGA/OREB/TOV/FTA) via the standard single-game possession
  approximation, still labeled "est." since it's simplified — see README's
  "Data honesty" section.
- Next: set `SPORTSGAMEODDS_API_KEY` as a Supabase secret, invoke
  `daily-sync` via `pg_net` against the real Oct 20 Pistons @ Celtics game
  (already confirmed to have live odds) the same way balldontlie was
  verified, confirm games/odds/box scores land correctly end to end, then
  move to Phase 2.
