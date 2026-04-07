-- Agregar soporte cardio a routine_exercises
-- (is_cardio y duration_minutes ya existen en weekly_plan desde 0006)
ALTER TABLE routine_exercises ADD COLUMN is_cardio INTEGER NOT NULL DEFAULT 0;
ALTER TABLE routine_exercises ADD COLUMN duration_minutes REAL;
