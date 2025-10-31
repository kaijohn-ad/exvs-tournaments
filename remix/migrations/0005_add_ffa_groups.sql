-- Add 'ffa-2up' format support
-- Note: SQLite doesn't support adding CHECK constraints via ALTER TABLE,
-- so format validation will be handled at the application level.
-- For new databases, the CHECK constraint will be enforced at table creation time.

-- Create ffa_groups table for FFA 2-up bracket format
CREATE TABLE IF NOT EXISTS ffa_groups (
    id TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    position INTEGER NOT NULL,
    participant_1_type TEXT CHECK(participant_1_type IN ('player', 'bye', 'empty')),
    participant_1_player_id TEXT,
    participant_2_type TEXT CHECK(participant_2_type IN ('player', 'bye', 'empty')),
    participant_2_player_id TEXT,
    participant_3_type TEXT CHECK(participant_3_type IN ('player', 'bye', 'empty')),
    participant_3_player_id TEXT,
    participant_4_type TEXT CHECK(participant_4_type IN ('player', 'bye', 'empty')),
    participant_4_player_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
    winner1_player_id TEXT,
    winner2_player_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (participant_1_player_id) REFERENCES players(id) ON DELETE SET NULL,
    FOREIGN KEY (participant_2_player_id) REFERENCES players(id) ON DELETE SET NULL,
    FOREIGN KEY (participant_3_player_id) REFERENCES players(id) ON DELETE SET NULL,
    FOREIGN KEY (participant_4_player_id) REFERENCES players(id) ON DELETE SET NULL,
    FOREIGN KEY (winner1_player_id) REFERENCES players(id) ON DELETE SET NULL,
    FOREIGN KEY (winner2_player_id) REFERENCES players(id) ON DELETE SET NULL,
    UNIQUE(tournament_id, round, position)
);

CREATE INDEX IF NOT EXISTS idx_ffa_groups_tournament_id ON ffa_groups(tournament_id);
CREATE INDEX IF NOT EXISTS idx_ffa_groups_round ON ffa_groups(tournament_id, round);


