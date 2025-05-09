-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- Main tracks table
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  artist TEXT,
  src TEXT NOT NULL,
  artwork TEXT NOT NULL,
  duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metadata stored as JSONB for flexibility
CREATE TABLE track_metadata (
  track_id UUID PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  metadata JSONB NOT NULL DEFAULT '{}',
  searchable_text TEXT, -- Denormalized for full-text search
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_tracks_title ON tracks USING GIN (to_tsvector('english', title));
CREATE INDEX idx_tracks_artist ON tracks USING GIN (to_tsvector('english', artist));
CREATE INDEX idx_track_metadata_genre ON track_metadata USING GIN ((metadata->'genre'));
CREATE INDEX idx_track_metadata_mood ON track_metadata USING GIN ((metadata->'mood'));
CREATE INDEX idx_track_metadata_therapy ON track_metadata USING GIN ((metadata->'therapyType'));
CREATE INDEX idx_track_metadata_search ON track_metadata USING GIN (to_tsvector('english', searchable_text));

-- Function to update searchable_text automatically
CREATE OR REPLACE FUNCTION update_searchable_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.searchable_text := LOWER(
    COALESCE((SELECT title FROM tracks WHERE id = NEW.track_id), '') || ' ' ||
    COALESCE((SELECT artist FROM tracks WHERE id = NEW.track_id), '') || ' ' ||
    COALESCE(NEW.metadata->>'genre', '') || ' ' ||
    COALESCE(NEW.metadata->>'mood', '') || ' ' ||
    COALESCE(NEW.metadata->>'tags', '') || ' ' ||
    COALESCE(NEW.metadata->>'description', '') || ' ' ||
    COALESCE(NEW.metadata->>'therapyType', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain searchable_text
CREATE TRIGGER update_track_searchable_text
  BEFORE INSERT OR UPDATE ON track_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_searchable_text();

-- Function to search tracks
CREATE OR REPLACE FUNCTION search_tracks(search_query TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  artist TEXT,
  src TEXT,
  artwork TEXT,
  duration INTEGER,
  metadata JSONB,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.artist,
    t.src,
    t.artwork,
    t.duration,
    tm.metadata,
    ts_rank(to_tsvector('english', tm.searchable_text), to_tsquery('english', search_query)) AS rank
  FROM tracks t
  JOIN track_metadata tm ON t.id = tm.track_id
  WHERE to_tsvector('english', tm.searchable_text) @@ to_tsquery('english', search_query)
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to filter tracks by metadata
CREATE OR REPLACE FUNCTION filter_tracks(
  genre_filter TEXT DEFAULT NULL,
  mood_filter TEXT DEFAULT NULL,
  therapy_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  artist TEXT,
  src TEXT,
  artwork TEXT,
  duration INTEGER,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.artist,
    t.src,
    t.artwork,
    t.duration,
    tm.metadata
  FROM tracks t
  JOIN track_metadata tm ON t.id = tm.track_id
  WHERE 
    (genre_filter IS NULL OR tm.metadata->'genre' ? genre_filter)
    AND (mood_filter IS NULL OR tm.metadata->'mood' ? mood_filter)
    AND (therapy_filter IS NULL OR tm.metadata->'therapyType' ? therapy_filter)
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tracks_updated_at
  BEFORE UPDATE ON tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_track_metadata_updated_at
  BEFORE UPDATE ON track_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();