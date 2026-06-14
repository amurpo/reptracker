import { sql } from 'drizzle-orm'
import { integer, real, text, sqliteTable, index, unique, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  age: integer('age'),
  weightKg: real('weight_kg'),
  heightCm: integer('height_cm'),
  sex: text('sex'),
  emailVerified: integer('email_verified').notNull().default(0),
  tokenVersion: integer('token_version').notNull().default(0),
  dateFormat: text('date_format').notNull().default('dd-mm-yyyy'),
  timeFormat: text('time_format').notNull().default('24h'),
  weekStart: integer('week_start').notNull().default(0),
  theme: text('theme').notNull().default('indigo'),
  restTimerSeconds: integer('rest_timer_seconds').notNull().default(0),
  restTimerSound: text('rest_timer_sound').notNull().default('bell'),
  restTimerRepeat: integer('rest_timer_repeat').notNull().default(1),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

export const emailVerificationTokens = sqliteTable('email_verification_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

export const exerciseCatalog = sqliteTable('exercise_catalog', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  muscleGroup: text('muscle_group').notNull(),
  imageUrl: text('image_url'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, (t) => ({
  idxMuscle: index('idx_exercise_catalog_muscle').on(t.muscleGroup),
}))

// Aliases de búsqueda del catálogo global (nombres en inglés y sinónimos comunes).
// Solo existen para ejercicios del seed; los custom de usuario no tienen aliases.
export const exerciseAliases = sqliteTable('exercise_aliases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  catalogId: integer('catalog_id').notNull().references(() => exerciseCatalog.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull(),
}, (t) => ({
  idxCatalog: index('idx_exercise_aliases_catalog').on(t.catalogId),
  uqCatalogAlias: uniqueIndex('uq_exercise_aliases').on(t.catalogId, t.alias),
}))

export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  catalogId: integer('catalog_id').references(() => exerciseCatalog.id),
  name: text('name').notNull(),
  muscleGroup: text('muscle_group').notNull(),
  imageUrl: text('image_url'),
  isCustom: integer('is_custom').notNull().default(0),
  isDeleted: integer('is_deleted').notNull().default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, (t) => ({
  idxUser: index('idx_exercises_user').on(t.userId, t.isDeleted),
  idxGlobal: index('idx_exercises_global').on(t.isCustom, t.isDeleted),
}))

export const weeklyPlan = sqliteTable('weekly_plan', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weekStart: text('week_start').notNull().default(''),
  dayOfWeek: integer('day_of_week').notNull(),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  sets: integer('sets').notNull().default(3),
  reps: integer('reps').notNull().default(10),
  repsConfig: text('reps_config'),
  weightKg: real('weight_kg'),
  orderIndex: integer('order_index').notNull().default(0),
  isCardio: integer('is_cardio').notNull().default(0),
  durationMinutes: real('duration_minutes'),
  // Soft-delete: al quitar el ejercicio del plan se marca aquí en vez de borrar
  // la fila, para conservar el historial de completed_sets (evita el cascade).
  isDeleted: integer('is_deleted').notNull().default(0),
})

export const workoutSessions = sqliteTable('workout_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, (t) => ({
  uniqUserDate: unique().on(t.userId, t.date),
}))

export const routines = sqliteTable('routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, (t) => ({
  idxUser: index('idx_routines_user').on(t.userId),
}))

export const routineExercises = sqliteTable('routine_exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routineId: integer('routine_id').notNull().references(() => routines.id, { onDelete: 'cascade' }),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  sets: integer('sets').notNull().default(3),
  reps: integer('reps').notNull().default(10),
  repsConfig: text('reps_config'),
  weightKg: real('weight_kg'),
  orderIndex: integer('order_index').notNull().default(0),
}, (t) => ({
  idxRoutine: index('idx_routine_exercises_routine').on(t.routineId),
}))

export const weightLog = sqliteTable('weight_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  weightKg: real('weight_kg').notNull(),
}, (t) => ({
  idxWeightLog: index('idx_weight_log_user').on(t.userId, t.date),
  uniqUserDate: unique().on(t.userId, t.date),
}))

export const completedSets = sqliteTable('completed_sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => workoutSessions.id, { onDelete: 'cascade' }),
  weeklyPlanId: integer('weekly_plan_id').notNull().references(() => weeklyPlan.id, { onDelete: 'cascade' }),
  setNumber: integer('set_number').notNull(),
  // Snapshot de lo realmente hecho al completar (congela peso/reps/duración para
  // que editar el plan después no reescriba el historial).
  weightKg: real('weight_kg'),
  reps: integer('reps'),
  durationMinutes: real('duration_minutes'),
  isCardio: integer('is_cardio').notNull().default(0),
  completedAt: text('completed_at').default(sql`(datetime('now'))`),
}, (t) => ({
  uniqSetPerSession: unique().on(t.sessionId, t.weeklyPlanId, t.setNumber),
}))
