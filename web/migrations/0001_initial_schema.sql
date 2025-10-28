
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);

CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    name TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_players_event_id ON players(event_id);
CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);

CREATE TABLE IF NOT EXISTS pairs (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    player1_id TEXT NOT NULL,
    player2_id TEXT NOT NULL,
    seed INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (player1_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (player2_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pairs_event_id ON pairs(event_id);
CREATE INDEX IF NOT EXISTS idx_pairs_player1_id ON pairs(player1_id);
CREATE INDEX IF NOT EXISTS idx_pairs_player2_id ON pairs(player2_id);

CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    name TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'single-elimination',
    seeding_mode TEXT NOT NULL DEFAULT 'random',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tournaments_event_id ON tournaments(event_id);

CREATE TABLE IF NOT EXISTS bracket_matches (
    id TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    position INTEGER NOT NULL,
    participant_a_type TEXT CHECK(participant_a_type IN ('pair', 'bye')),
    participant_a_pair_id TEXT,
    participant_b_type TEXT CHECK(participant_b_type IN ('pair', 'bye')),
    participant_b_pair_id TEXT,
    score_a INTEGER,
    score_b INTEGER,
    winner_side TEXT CHECK(winner_side IN ('a', 'b', NULL)),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (participant_a_pair_id) REFERENCES pairs(id) ON DELETE SET NULL,
    FOREIGN KEY (participant_b_pair_id) REFERENCES pairs(id) ON DELETE SET NULL,
    UNIQUE(tournament_id, round, position)
);

CREATE INDEX IF NOT EXISTS idx_bracket_matches_tournament_id ON bracket_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_bracket_matches_round ON bracket_matches(tournament_id, round);

CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_teams_event_id ON teams(event_id);

CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE(team_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_player_id ON team_members(player_id);

CREATE TABLE IF NOT EXISTS team_battles (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    team_a_id TEXT NOT NULL,
    team_b_id TEXT NOT NULL,
    slots_count INTEGER NOT NULL DEFAULT 3 CHECK(slots_count >= 1 AND slots_count <= 5),
    format TEXT NOT NULL DEFAULT 'waseda',
    allow_double_appearance_per_team INTEGER NOT NULL DEFAULT 1,
    tiebreak TEXT NOT NULL DEFAULT 'off' CHECK(tiebreak IN ('off', 'representative')),
    status TEXT NOT NULL DEFAULT 'pending',
    result TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (team_a_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (team_b_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_team_battles_event_id ON team_battles(event_id);

CREATE TABLE IF NOT EXISTS team_battle_slots (
    id TEXT PRIMARY KEY,
    team_battle_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    slot_index INTEGER NOT NULL,
    assignment_type TEXT NOT NULL CHECK(assignment_type IN ('pair', 'adhoc')),
    pair_id TEXT,
    player1_id TEXT,
    player2_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (team_battle_id) REFERENCES team_battles(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE SET NULL,
    FOREIGN KEY (player1_id) REFERENCES players(id) ON DELETE SET NULL,
    FOREIGN KEY (player2_id) REFERENCES players(id) ON DELETE SET NULL,
    UNIQUE(team_battle_id, team_id, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_team_battle_slots_team_battle_id ON team_battle_slots(team_battle_id);
CREATE INDEX IF NOT EXISTS idx_team_battle_slots_team_id ON team_battle_slots(team_id);

CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    context TEXT NOT NULL CHECK(context IN ('bracket', 'teamBattle', 'tiebreak')),
    context_id TEXT NOT NULL,
    slot_index INTEGER,
    side_a_type TEXT NOT NULL CHECK(side_a_type IN ('pair', 'adhoc')),
    side_a_pair_id TEXT,
    side_a_player1_id TEXT,
    side_a_player2_id TEXT,
    side_b_type TEXT NOT NULL CHECK(side_b_type IN ('pair', 'adhoc')),
    side_b_pair_id TEXT,
    side_b_player1_id TEXT,
    side_b_player2_id TEXT,
    score_a INTEGER NOT NULL,
    score_b INTEGER NOT NULL,
    winner_side TEXT NOT NULL CHECK(winner_side IN ('a', 'b')),
    status TEXT NOT NULL DEFAULT 'completed',
    played_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (side_a_pair_id) REFERENCES pairs(id) ON DELETE SET NULL,
    FOREIGN KEY (side_a_player1_id) REFERENCES players(id) ON DELETE SET NULL,
    FOREIGN KEY (side_a_player2_id) REFERENCES players(id) ON DELETE SET NULL,
    FOREIGN KEY (side_b_pair_id) REFERENCES pairs(id) ON DELETE SET NULL,
    FOREIGN KEY (side_b_player1_id) REFERENCES players(id) ON DELETE SET NULL,
    FOREIGN KEY (side_b_player2_id) REFERENCES players(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_matches_context_slot ON matches(context, context_id, slot_index);
CREATE INDEX IF NOT EXISTS idx_matches_context ON matches(context, context_id);
CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches(played_at);

CREATE TABLE IF NOT EXISTS match_participations (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    team_id TEXT,
    pair_id TEXT,
    role TEXT,
    won INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE SET NULL,
    UNIQUE(match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_participations_match_id ON match_participations(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participations_player_id ON match_participations(player_id);

CREATE TABLE IF NOT EXISTS player_stats (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL CHECK(scope IN ('event', 'tournament', 'teamBattle', 'global')),
    scope_id TEXT,
    player_id TEXT NOT NULL,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    last_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_player_stats_scope ON player_stats(scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_player_id ON player_stats(player_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    by TEXT,
    at TEXT NOT NULL DEFAULT (datetime('now')),
    payload TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_at ON audit_logs(at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
