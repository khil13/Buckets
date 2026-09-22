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

**Phase 1 (Foundation): done, live on GitHub Pages.** **Phase 2 (Player props): core built, verified end to end.**

### Phase 1
- Single data source: [SportsGameOdds](https://sportsgameodds.com), not balldontlie + The Odds API as originally
  planned — the account's key turned out to be for SportsGameOdds, and probing it live (via `pg_net` from inside
  Supabase, bypassing this dev sandbox's blocked egress) showed one call returns schedule, team *and player* box
  scores, and odds with a pre-computed no-vig "fair" price per market. Confirmed with me before rebuilding around
  it (large-change rule above).
- Supabase project `buckets` (dedicated, separate from any other project on this account). Schema uses
  SportsGameOdds' own string ids (`teamID`/`eventID`/`playerID`) as primary keys throughout, RLS read-only for
  anon. `odds_snapshots.fair_price` / `player_prop_snapshots.fair_price` store the de-vigged price — serves this
  file's core principle years ahead of Phase 3.
- `daily-sync` edge function verified end to end with `SPORTSGAMEODDS_API_KEY` live: real games, teams, and odds
  snapshots land correctly (8 books, correct home/away mapping, consistent `fair_price`). Scheduled via
  `pg_cron`+`pg_net` daily at 08:07 UTC, no external scheduler needed.
- Hosting: GitHub Pages (`khil13.github.io/Buckets/`) as a free interim host since Netlify wasn't available (no
  credits) — see README's "Hosting" section. `netlify.toml` kept in place for an easy switch later.
- **Not yet exercised**: the team box-score/pace/rating computation path (`boxScoresUpserted: 0` in every
  verification so far — no games in the tested windows have finished). Schema-verified against real captured
  data, not yet proven through a live completed game. Worth a spot check once games finish after the season
  starts in October.

### Phase 2
- `daily-sync` extended (no new API call — parses more of the same `/v2/events` response): `players` upserted
  from the real `event.players` roster field (confirmed via `pg_net` probe to give a clean `{name, teamID}` per
  player, avoiding any ID-parsing guesswork), `player_game_stats` from `results.game`'s per-player entries, and
  `player_prop_snapshots` from `odds` entries whose `statEntityID` is a player id instead of `home`/`away`/`all`.
  Verified end to end: a real invocation upserted 4 players and 75 player-prop snapshots correctly (real names,
  correct team mapping, right over/under and yes/no sides, real prices and fair prices for points/rebounds/
  assists/3PM/combo markets across multiple books).
- `src/lib/playerContext.ts` (unit tested, 6 tests): season/last-5/last-10 averages, hit rate vs. a line,
  minutes trend, a shot/possession-involvement "usage" trend (FGA + 0.44×FTA + TOV — explicitly *not* a
  normalized usage-rate %, which needs on/off-court data this app doesn't have), home/away split, vs-opponent
  average.
- New pages: `/props` (Prop Board, sortable by hit rate or by "average − line" gap — explicitly not "edge" in
  the Phase 3 model-vs-no-vig sense) and `/player/:playerId` (Player Detail, reached via a prop row's link with
  `?stat=&line=&opponent=` query params).
- **Deferred**: "teammate out" splits. The box results don't score which team a player's on by themselves (the
  roster field solves player→team, but "who's out" and "which teammate to compare against" are separate design
  questions), and both are easier to verify once real games with real absences exist. Decided with me before
  starting Phase 2 (sequencing choice, not a scope cut).
- **Not yet exercised**: `player_game_stats` real data (same "no completed games yet" gap as team box scores).
- Next: once the season starts and games finish, spot-check box scores/pace/ratings and player game stats
  against real completed games, then pick up "teammate out" splits before moving to Phase 3.
