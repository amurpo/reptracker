-- Restaurar weekly_plan como fuente de verdad del plan diario
CREATE TABLE IF NOT EXISTS weekly_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- Restaurar completed_sets con weekly_plan_id
DROP TABLE IF EXISTS completed_sets;
CREATE TABLE completed_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  weekly_plan_id INTEGER NOT NULL REFERENCES weekly_plan(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  completed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(session_id, weekly_plan_id, set_number)
);

-- Eliminar day_schedule (concepto incorrecto)
DROP TABLE IF EXISTS day_schedule;
