-- Add published_at to pages for recency-based filtering
ALTER TABLE pages ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Index for efficient filtering in suggest query
CREATE INDEX IF NOT EXISTS pages_published_at_idx
  ON pages (project_id, published_at DESC NULLS LAST);
