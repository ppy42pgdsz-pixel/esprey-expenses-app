-- 0014: Concierge AI (#43), chat phase.
-- concierge_messages: persistent per-user chat history (private, like receipts).
-- concierge_pending_actions: destructive actions awaiting an explicit in-app
-- confirm click. Chat-only by design — email (phase 2) will never be allowed
-- to trigger these (Carl, 2026-07-04).

CREATE TABLE IF NOT EXISTS concierge_messages (
  id         TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  role       TEXT NOT NULL,      -- 'user' | 'assistant'
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_concierge_messages_user
  ON concierge_messages(user_email, created_at);

CREATE TABLE IF NOT EXISTS concierge_pending_actions (
  id         TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  action     TEXT NOT NULL,      -- JSON, e.g. {"type":"delete_receipt","receipt_id":"..."}
  summary    TEXT NOT NULL,      -- human-readable, shown on the confirm button
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL    -- unconfirmed actions die after 10 minutes
);
