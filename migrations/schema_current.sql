-- ============================================================
-- Schema completo de RepTracker
-- Generado desde la DB local — listo para instalaciones nuevas
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  age INTEGER,
  weight_kg REAL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  date_format TEXT NOT NULL DEFAULT 'dd-mm-yyyy',
  time_format TEXT NOT NULL DEFAULT '24h',
  week_start INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'indigo',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exercise_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  image_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exercise_catalog_muscle ON exercise_catalog(muscle_group);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  catalog_id INTEGER REFERENCES exercise_catalog(id),
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  image_url TEXT,
  is_custom INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exercises_user ON exercises(user_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_exercises_global ON exercises(is_custom, is_deleted);

CREATE TABLE IF NOT EXISTS routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_routines_user ON routines(user_id);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sets INTEGER NOT NULL DEFAULT 3,
  reps INTEGER NOT NULL DEFAULT 10,
  weight_kg REAL,
  is_cardio INTEGER NOT NULL DEFAULT 0,
  duration_minutes REAL,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine ON routine_exercises(routine_id);

CREATE TABLE IF NOT EXISTS weekly_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL DEFAULT '',
  day_of_week INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sets INTEGER NOT NULL DEFAULT 3,
  reps INTEGER NOT NULL DEFAULT 10,
  weight_kg REAL,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_cardio INTEGER NOT NULL DEFAULT 0,
  duration_minutes REAL
);

CREATE INDEX IF NOT EXISTS idx_weekly_plan_user ON weekly_plan(user_id);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS completed_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  weekly_plan_id INTEGER NOT NULL REFERENCES weekly_plan(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  completed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(session_id, weekly_plan_id, set_number)
);
