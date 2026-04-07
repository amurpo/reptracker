ALTER TABLE weekly_plan ADD COLUMN week_start TEXT;

-- Asignar semana actual (lunes) a entradas existentes
UPDATE weekly_plan SET week_start = CASE CAST(strftime('%w', 'now') AS INTEGER)
  WHEN 0 THEN date('now', '-6 days')
  WHEN 1 THEN date('now')
  WHEN 2 THEN date('now', '-1 day')
  WHEN 3 THEN date('now', '-2 days')
  WHEN 4 THEN date('now', '-3 days')
  WHEN 5 THEN date('now', '-4 days')
  WHEN 6 THEN date('now', '-5 days')
END;

CREATE INDEX IF NOT EXISTS idx_weekly_plan_user_week ON weekly_plan(user_id, week_start);
