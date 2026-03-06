-- Room messages table (separate from 1-on-1 messages)
CREATE TABLE room_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,  -- NULL for user messages
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_room_messages_created ON room_messages(created_at ASC);

-- Same permissive RLS as existing tables (single-user app)
ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on room_messages" ON room_messages FOR ALL USING (true) WITH CHECK (true);
