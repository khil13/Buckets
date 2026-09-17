-- Teams (balldontlie team id used directly as primary key)
create table teams (
  id bigint primary key,
  abbreviation text not null,
  name text not null,
  full_name text not null,
  conference text,
  division text
);

-- Games (balldontlie game id used directly as primary key)
create table games (
  id bigint primary key,
  season int not null,
  game_date date not null,
  tip_time timestamptz,
  home_team_id bigint references teams(id),
  away_team_id bigint references teams(id),
  status text not null default 'scheduled',
  home_score int,
  away_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_game_date_idx on games (game_date);

-- Best-effort per-team, per-game box score / advanced-stat proxies.
-- off_rating_est / def_rating_est / pace_est are approximations we compute
-- ourselves (balldontlie's free tier does not reliably expose true
-- advanced stats) and must be labeled as estimates in the UI.
create table team_game_box_scores (
  id bigserial primary key,
  game_id bigint not null references games(id) on delete cascade,
  team_id bigint not null references teams(id),
  pts int,
  opp_pts int,
  possessions_est numeric,
  pace_est numeric,
  off_rating_est numeric,
  def_rating_est numeric,
  unique (game_id, team_id)
);

-- Append-only odds snapshots: powers "best available line" now and the
-- line-movement chart in Phase 3.
create table odds_snapshots (
  id bigserial primary key,
  game_id bigint not null references games(id) on delete cascade,
  book text not null,
  market text not null check (market in ('spread', 'total', 'moneyline')),
  side text,
  line numeric,
  price int,
  captured_at timestamptz not null default now()
);

create index odds_snapshots_game_id_idx on odds_snapshots (game_id);
create index odds_snapshots_captured_at_idx on odds_snapshots (captured_at);

-- Observability for the scheduled daily-sync job.
create table sync_log (
  id bigserial primary key,
  job_name text not null,
  run_at timestamptz not null default now(),
  status text not null check (status in ('success', 'partial', 'error')),
  detail jsonb
);

-- Single-user personal app: anon key gets read-only access everywhere.
-- All writes go through the daily-sync edge function's service-role key,
-- which bypasses RLS entirely.
alter table teams enable row level security;
alter table games enable row level security;
alter table team_game_box_scores enable row level security;
alter table odds_snapshots enable row level security;
alter table sync_log enable row level security;

create policy "public read teams" on teams for select using (true);
create policy "public read games" on games for select using (true);
create policy "public read team_game_box_scores" on team_game_box_scores for select using (true);
create policy "public read odds_snapshots" on odds_snapshots for select using (true);
create policy "public read sync_log" on sync_log for select using (true);
