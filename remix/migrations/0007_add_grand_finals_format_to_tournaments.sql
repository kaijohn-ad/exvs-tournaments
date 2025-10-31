-- Add grand_finals_format column to tournaments table for double elimination support
-- Note: SQLite doesn't support adding CHECK constraints via ALTER TABLE,
-- so CHECK constraint will be enforced at the application level for existing databases.
-- For new databases, the CHECK constraint will be enforced at table creation time.

-- Add grand_finals_format column with default value 'single'
ALTER TABLE tournaments ADD COLUMN grand_finals_format TEXT NOT NULL DEFAULT 'single';

