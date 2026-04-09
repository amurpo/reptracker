-- Agregar campos cardio a routine_exercises
ALTER TABLE routine_exercises ADD COLUMN is_cardio INTEGER NOT NULL DEFAULT 0;
ALTER TABLE routine_exercises ADD COLUMN duration_minutes REAL;

-- Nueva tabla: rutina asignada a cada día de la semana
CREATE TABLE day_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  UNIQUE(user_id, day_of_week)
);
CREATE INDEX IF NOT EXISTS idx_day_schedule_user ON day_schedule(user_id);

-- Recrear completed_sets con routine_exercise_id en lugar de weekly_plan_id
DROP TABLE IF EXISTS completed_sets;
CREATE TABLE completed_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  routine_exercise_id INTEGER NOT NULL REFERENCES routine_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  completed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(session_id, routine_exercise_id, set_number)
);

-- Limpiar sesiones (incompatibles con nuevo schema)
DELETE FROM workout_sessions;

-- Eliminar weekly_plan
DROP TABLE IF EXISTS weekly_plan;
