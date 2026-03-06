-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Personas table
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🤖',
  accent_color TEXT NOT NULL DEFAULT '#6366f1',
  system_prompt TEXT NOT NULL,
  tagline TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  memory_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast message retrieval per persona
CREATE INDEX idx_messages_persona_created
  ON messages(persona_id, created_at ASC);

-- Index for persona ordering
CREATE INDEX idx_personas_sort_order
  ON personas(sort_order ASC);

-- RPC function to get personas with their last message (for sidebar)
CREATE OR REPLACE FUNCTION get_personas_with_last_message()
RETURNS TABLE (
  id UUID,
  name TEXT,
  emoji TEXT,
  accent_color TEXT,
  system_prompt TEXT,
  tagline TEXT,
  sort_order INTEGER,
  memory_summary TEXT,
  created_at TIMESTAMPTZ,
  last_message_content TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_role TEXT
) AS $$
  SELECT
    p.id, p.name, p.emoji, p.accent_color,
    p.system_prompt, p.tagline, p.sort_order,
    p.memory_summary, p.created_at,
    m.content AS last_message_content,
    m.created_at AS last_message_at,
    m.role AS last_message_role
  FROM personas p
  LEFT JOIN LATERAL (
    SELECT content, created_at, role
    FROM messages
    WHERE persona_id = p.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  ORDER BY p.sort_order ASC;
$$ LANGUAGE sql;

-- Disable RLS for single-user app
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Permissive policies (no auth required)
CREATE POLICY "Allow all on personas" ON personas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on messages" ON messages FOR ALL USING (true) WITH CHECK (true);
