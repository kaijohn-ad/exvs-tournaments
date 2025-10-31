-- Add entry_mode column to tournaments table
ALTER TABLE tournaments ADD COLUMN entry_mode TEXT NOT NULL DEFAULT 'pair' CHECK(entry_mode IN ('pair','solo'));

-- Create tournament_participants table
CREATE TABLE IF NOT EXISTS tournament_participants (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL,
  participant_type TEXT NOT NULL CHECK(participant_type IN ('pair','solo')),
  pair_id TEXT,
  player_id TEXT,
  seed INTEGER,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','removed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE(tournament_id, pair_id),
  UNIQUE(tournament_id, player_id),
  CHECK( (participant_type='pair' AND pair_id IS NOT NULL AND player_id IS NULL)
      OR (participant_type='solo' AND player_id IS NOT NULL AND pair_id IS NULL) )
);

CREATE INDEX IF NOT EXISTS idx_tp_tournament_id ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tp_tournament_seed ON tournament_participants(tournament_id, seed);

