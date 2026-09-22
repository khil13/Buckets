-- Switching from balldontlie (numeric ids) + The Odds API to a single
-- SportsGameOdds source (string teamID/eventID ids). Dropping and
-- recreating rather than migrating in place: the existing rows are all
-- balldontlie-sourced verification data, incompatible with the new id
-- scheme anyway.
drop table if exists odds_snapshots;
drop table if exists team_game_box_scores;
drop table if exists games;
drop table if exists teams;

create table teams (
  id text primary key, -- SportsGameOdds teamID, e.g. "DETROIT_PISTONS_NBA"
  abbreviation text not null,
  name text not null,
  full_name text not null,
  conference text,
  division text
);

create table games (
  id text primary key, -- SportsGameOdds eventID
  season int not null,
  game_date date not null,
  tip_time timestamptz,
  home_team_id text references teams(id),
  away_team_id text references teams(id),
  status text not null default 'scheduled',
  home_score int,
  away_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_game_date_idx on games (game_date);

-- Real per-team box score inputs (SportsGameOdds' /v2/events results.game)
-- let us compute genuine pace/off/def rating estimates, rather than the
-- null placeholders used when balldontlie's free tier only gave scores.
create table team_game_box_scores (
  id bigserial primary key,
  game_id text not null references games(id) on delete cascade,
  team_id text not null references teams(id),
  pts int,
  opp_pts int,
  possessions_est numeric,
  pace_est numeric,
  off_rating_est numeric,
  def_rating_est numeric,
  unique (game_id, team_id)
);

-- Append-only odds snapshots: powers "best available line" now and the
-- line-movement chart in Phase 3. fair_price is SportsGameOdds' own
-- de-vigged consensus price for the market -- directly serves the app's
-- "book's implied probability (vig removed)" principle ahead of Phase 3.
create table odds_snapshots (
  id bigserial primary key,
  game_id text not null references games(id) on delete cascade,
  book text not null,
  market text not null check (market in ('spread', 'total', 'moneyline')),
  side text,
  line numeric,
  price int,
  fair_price int,
  captured_at timestamptz not null default now()
);

create index odds_snapshots_game_id_idx on odds_snapshots (game_id);
create index odds_snapshots_captured_at_idx on odds_snapshots (captured_at);

alter table teams enable row level security;
alter table games enable row level security;
alter table team_game_box_scores enable row level security;
alter table odds_snapshots enable row level security;

create policy "public read teams" on teams for select using (true);
create policy "public read games" on games for select using (true);
create policy "public read team_game_box_scores" on team_game_box_scores for select using (true);
create policy "public read odds_snapshots" on odds_snapshots for select using (true);
