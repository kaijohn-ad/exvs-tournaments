-- Add bracket column to bracket_matches table for double elimination support
-- Note: SQLite doesn't support adding CHECK constraints via ALTER TABLE,
-- so CHECK constraint will be enforced at the application level for existing databases.
-- For new databases, the CHECK constraint will be enforced at table creation time.

-- Add bracket column with default value 'winners' for backward compatibility
ALTER TABLE bracket_matches ADD COLUMN bracket TEXT NOT NULL DEFAULT 'winners';

-- Drop the old unique constraint
DROP INDEX IF EXISTS idx_bracket_matches_round;

-- Create new unique constraint including bracket
-- Note: SQLite doesn't support DROP CONSTRAINT, so we'll need to recreate the table
-- For existing data, we'll use a workaround by creating a new unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_bracket_matches_unique 
ON bracket_matches(tournament_id, bracket, round, position);

-- Create index for efficient queries by bracket and round
CREATE INDEX IF NOT EXISTS idx_bracket_matches_bracket_round 
ON bracket_matches(tournament_id, bracket, round);

