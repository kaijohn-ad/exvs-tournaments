-- Add deleted_at column to pairs table for soft delete
ALTER TABLE pairs ADD COLUMN deleted_at TEXT;

-- Create index for efficient filtering by event_id and deleted_at
CREATE INDEX IF NOT EXISTS idx_pairs_event_id_deleted ON pairs(event_id, deleted_at);

