CREATE TABLE IF NOT EXISTS weight_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT    NOT NULL,
  weight_kg  REAL    NOT NULL,
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_weight_log_user ON weight_log(user_id, date);

-- Migrar el peso actual de cada usuario como punto de partida del historial
INSERT OR IGNORE INTO weight_log (user_id, date, weight_kg)
SELECT id, date('now'), weight_kg
FROM users
WHERE weight_kg IS NOT NULL;
