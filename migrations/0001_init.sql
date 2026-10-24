-- Binflare v0.1 schema. Ciphertext is stored as BLOB; adata is stored as the
-- exact JSON array string so the client can rebuild the authenticated data.

CREATE TABLE pastes (
  id TEXT PRIMARY KEY,
  v INTEGER NOT NULL,
  ct BLOB NOT NULL,
  adata TEXT NOT NULL,
  formatter TEXT NOT NULL,
  discussion INTEGER NOT NULL CHECK (discussion IN (0, 1)),
  burn INTEGER NOT NULL CHECK (burn IN (0, 1)),
  expire_date INTEGER,
  salt TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (burn = 0 OR discussion = 0)
);

CREATE INDEX pastes_expire_idx ON pastes(expire_date) WHERE expire_date IS NOT NULL;

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  paste_id TEXT NOT NULL,
  parent_id TEXT NOT NULL,
  ct BLOB NOT NULL,
  adata TEXT NOT NULL,
  created INTEGER NOT NULL,
  size INTEGER NOT NULL
);

CREATE INDEX comments_paste_idx ON comments(paste_id, created, id);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE INDEX rate_limits_window_idx ON rate_limits(window_start);
