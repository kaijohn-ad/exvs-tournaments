-- Add deleted_at column to players table for soft delete
ALTER TABLE players ADD COLUMN deleted_at TEXT;

-- Create index for efficient filtering by event_id and deleted_at
CREATE INDEX IF NOT EXISTS idx_players_event_id_deleted ON players(event_id, deleted_at);


