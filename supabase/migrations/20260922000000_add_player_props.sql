create table players (
  id text primary key, -- SportsGameOdds playerID, e.g. "JAYSON_TATUM_1_NBA"
  name text not null,
  team_id text references teams(id)
);

create index players_team_id_idx on players (team_id);

create table player_game_stats (
  id bigserial primary key,
  game_id text not null references games(id) on delete cascade,
  player_id text not null references players(id),
  team_id text references teams(id),
  minutes numeric,
  points int,
  rebounds int,
  assists int,
  steals int,
  blocks int,
  turnovers int,
  three_pointers_made int,
  field_goals_made int,
  field_goals_attempted int,
  free_throws_attempted int,
  unique (game_id, player_id)
);

create index player_game_stats_player_id_idx on player_game_stats (player_id);

-- Same shape as odds_snapshots, plus player_id and which stat the prop is
-- on. stat covers every player-prop market SportsGameOdds exposes for the
-- statID/betTypeID combinations daily-sync captures.
create table player_prop_snapshots (
  id bigserial primary key,
  game_id text not null references games(id) on delete cascade,
  player_id text not null references players(id),
  stat text not null check (stat in (
    'points', 'rebounds', 'assists', 'three_pointers_made',
    'points_assists', 'points_rebounds', 'rebounds_assists',
    'points_rebounds_assists', 'double_double', 'triple_double'
  )),
  book text not null,
  side text not null,
  line numeric,
  price int,
  fair_price int,
  captured_at timestamptz not null default now()
);

create index player_prop_snapshots_game_id_idx on player_prop_snapshots (game_id);
create index player_prop_snapshots_player_id_idx on player_prop_snapshots (player_id);
create index player_prop_snapshots_captured_at_idx on player_prop_snapshots (captured_at);

alter table players enable row level security;
alter table player_game_stats enable row level security;
alter table player_prop_snapshots enable row level security;

create policy "public read players" on players for select using (true);
create policy "public read player_game_stats" on player_game_stats for select using (true);
create policy "public read player_prop_snapshots" on player_prop_snapshots for select using (true);
