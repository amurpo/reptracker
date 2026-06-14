-- Soft-delete en weekly_plan: al quitar un ejercicio del plan se marca como
-- inactivo en vez de borrarlo, para no perder por cascade el historial de
-- completed_sets asociado. Mismo patrón que exercises.is_deleted.
ALTER TABLE weekly_plan ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;
