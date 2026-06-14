-- Snapshot histórico en completed_sets: congela el peso, reps y duración usados
-- al completar cada serie, para que editar el plan después NO reescriba reportes
-- pasados. Antes todo se derivaba por JOIN a weekly_plan (mutable).
ALTER TABLE completed_sets ADD COLUMN weight_kg REAL;
ALTER TABLE completed_sets ADD COLUMN reps INTEGER;
ALTER TABLE completed_sets ADD COLUMN duration_minutes REAL;
ALTER TABLE completed_sets ADD COLUMN is_cardio INTEGER NOT NULL DEFAULT 0;

-- Backfill de filas existentes con los valores actuales del plan (mejor esfuerzo:
-- no hay historial previo, así que se toma el estado actual como aproximación).
UPDATE completed_sets
SET
  is_cardio = COALESCE((SELECT wp.is_cardio FROM weekly_plan wp WHERE wp.id = completed_sets.weekly_plan_id), 0),
  weight_kg = (
    SELECT CASE WHEN wp.is_cardio = 1 THEN NULL ELSE wp.weight_kg END
    FROM weekly_plan wp WHERE wp.id = completed_sets.weekly_plan_id
  ),
  reps = (
    SELECT CASE WHEN wp.is_cardio = 1 THEN NULL
      ELSE COALESCE(json_extract(wp.reps_config, '$[' || (completed_sets.set_number - 1) || ']'), wp.reps)
    END
    FROM weekly_plan wp WHERE wp.id = completed_sets.weekly_plan_id
  ),
  duration_minutes = (
    SELECT CASE WHEN wp.is_cardio = 1 THEN wp.duration_minutes ELSE NULL END
    FROM weekly_plan wp WHERE wp.id = completed_sets.weekly_plan_id
  );
