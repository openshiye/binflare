const statements = [
  `CREATE TABLE IF NOT EXISTS pastes (
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
    r2_key TEXT,
    CHECK (burn = 0 OR discussion = 0)
  )`,
  'CREATE INDEX IF NOT EXISTS pastes_expire_idx ON pastes(expire_date) WHERE expire_date IS NOT NULL',
  `CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    paste_id TEXT NOT NULL,
    parent_id TEXT NOT NULL,
    ct BLOB NOT NULL,
    adata TEXT NOT NULL,
    created INTEGER NOT NULL,
    size INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS comments_paste_idx ON comments(paste_id, created, id)',
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL,
    count INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON rate_limits(window_start)',
  `CREATE TABLE IF NOT EXISTS d1_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0001_init.sql'), ('0002_r2.sql')`,
]

let bootstrap: Promise<void> | null = null

export function ensureSchema(db: D1Database): Promise<void> {
  if (!bootstrap) {
    bootstrap = db
      .batch(statements.map((statement) => db.prepare(statement)))
      .then(() => undefined)
      .catch((error) => {
        bootstrap = null
        throw error
      })
  }
  return bootstrap
}
