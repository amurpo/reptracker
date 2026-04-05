ALTER TABLE weekly_plan ADD COLUMN is_cardio INTEGER NOT NULL DEFAULT 0;
ALTER TABLE weekly_plan ADD COLUMN duration_minutes REAL;
