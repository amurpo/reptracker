import { Hono } from 'hono'
import { eq, and, like, sql, desc } from 'drizzle-orm'
import { getDb, workoutSessions, completedSets, weeklyPlan, exercises, users } from '../db'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../index'

type Variables = { userId: number }

const app = new Hono<{ Bindings: Env; Variables: Variables }>()
app.use('*', authMiddleware)

app.get('/summary', async (c) => {
  const userId = c.get('userId')
  const db = getDb(c.env.DB)

  const yearMonth = c.req.query('month') ?? new Date().toISOString().slice(0, 7)
  const today = c.req.query('today') ?? new Date().toISOString().split('T')[0]

  const [daysRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), like(workoutSessions.date, `${yearMonth}-%`)))

  const [setsRow] = await db
    .select({ count: sql<number>`count(${completedSets.id})` })
    .from(completedSets)
    .innerJoin(workoutSessions, eq(completedSets.sessionId, workoutSessions.id))
    .where(and(eq(workoutSessions.userId, userId), like(workoutSessions.date, `${yearMonth}-%`)))

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, userId))

  // Todas las fechas con sesión (para racha y grid de actividad)
  const dates = await db
    .select({ date: workoutSessions.date })
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, userId))
    .orderBy(desc(workoutSessions.date))

  // Racha actual
  let streak = 0
  if (dates.length > 0) {
    const dateSet = new Set(dates.map(d => d.date))
    const cursor = new Date(today + 'T12:00:00')
    while (dateSet.has(cursor.toISOString().split('T')[0])) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }
  }

  // Datos del usuario para IMC
  const [userRow] = await db
    .select({ weightKg: users.weightKg, heightCm: users.heightCm, sex: users.sex, age: users.age })
    .from(users)
    .where(eq(users.id, userId))

  // 1RM estimado por Epley por ejercicio (peso × (1 + reps/30))
  // Solo ejercicios de fuerza con peso registrado
  const strengthRatios = userRow?.weightKg
    ? await db
        .select({
          name: exercises.name,
          muscleGroup: exercises.muscleGroup,
          estimated1RM: sql<number>`max(${weeklyPlan.weightKg} * (1.0 + ${weeklyPlan.reps} / 30.0))`,
          bestWeightKg: sql<number>`max(${weeklyPlan.weightKg})`,
        })
        .from(completedSets)
        .innerJoin(workoutSessions, eq(completedSets.sessionId, workoutSessions.id))
        .innerJoin(weeklyPlan, eq(completedSets.weeklyPlanId, weeklyPlan.id))
        .innerJoin(exercises, eq(weeklyPlan.exerciseId, exercises.id))
        .where(and(
          eq(workoutSessions.userId, userId),
          eq(weeklyPlan.isCardio, 0),
          sql`${weeklyPlan.weightKg} > 0`,
        ))
        .groupBy(exercises.id)
        .having(sql`count(distinct ${workoutSessions.date}) >= 2`)
        .orderBy(desc(sql`max(${weeklyPlan.weightKg} * (1.0 + ${weeklyPlan.reps} / 30.0))`))
        .limit(8)
    : []

  // Top 5 ejercicios este mes por series completadas
  const topExercises = await db
    .select({
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      sets: sql<number>`count(${completedSets.id})`,
    })
    .from(completedSets)
    .innerJoin(workoutSessions, eq(completedSets.sessionId, workoutSessions.id))
    .innerJoin(weeklyPlan, eq(completedSets.weeklyPlanId, weeklyPlan.id))
    .innerJoin(exercises, eq(weeklyPlan.exerciseId, exercises.id))
    .where(and(eq(workoutSessions.userId, userId), like(workoutSessions.date, `${yearMonth}-%`)))
    .groupBy(exercises.id)
    .orderBy(desc(sql`count(${completedSets.id})`))
    .limit(5)

  return c.json({
    daysThisMonth: daysRow.count,
    setsThisMonth: setsRow.count,
    totalDays: totalRow.count,
    streak,
    topExercises,
    weightKg: userRow?.weightKg ?? null,
    heightCm: userRow?.heightCm ?? null,
    sex: userRow?.sex ?? null,
    age: userRow?.age ?? null,
    strengthRatios,
  })
})

// Progresión histórica de un ejercicio: max weight por sesión
app.get('/progression/:exerciseId', async (c) => {
  const userId = c.get('userId')
  const exerciseId = parseInt(c.req.param('exerciseId'))
  const db = getDb(c.env.DB)

  const rows = await db
    .select({
      // Un único max() garantiza (regla de SQLite para min/max) que las columnas
      // "bare" (reps y el 1RM) salgan de la misma fila: la serie más pesada de la sesión.
      date: workoutSessions.date,
      maxWeightKg: sql<number>`max(${weeklyPlan.weightKg})`,
      repsAtMax: sql<number>`${weeklyPlan.reps}`,
      estimated1RM: sql<number>`${weeklyPlan.weightKg} * (1.0 + ${weeklyPlan.reps} / 30.0)`,
    })
    .from(completedSets)
    .innerJoin(workoutSessions, eq(completedSets.sessionId, workoutSessions.id))
    .innerJoin(weeklyPlan, eq(completedSets.weeklyPlanId, weeklyPlan.id))
    .where(and(
      eq(workoutSessions.userId, userId),
      eq(weeklyPlan.exerciseId, exerciseId),
      eq(weeklyPlan.isCardio, 0),
      sql`${weeklyPlan.weightKg} > 0`,
    ))
    .groupBy(workoutSessions.date)
    .orderBy(workoutSessions.date)

  return c.json(rows)
})

// Lista de ejercicios de fuerza que el usuario ha registrado con peso
app.get('/progression-exercises', async (c) => {
  const userId = c.get('userId')
  const db = getDb(c.env.DB)

  const rows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
    })
    .from(completedSets)
    .innerJoin(workoutSessions, eq(completedSets.sessionId, workoutSessions.id))
    .innerJoin(weeklyPlan, eq(completedSets.weeklyPlanId, weeklyPlan.id))
    .innerJoin(exercises, eq(weeklyPlan.exerciseId, exercises.id))
    .where(and(
      eq(workoutSessions.userId, userId),
      eq(weeklyPlan.isCardio, 0),
      sql`${weeklyPlan.weightKg} > 0`,
    ))
    .groupBy(exercises.id)
    .having(sql`count(distinct ${workoutSessions.date}) >= 2`)
    .orderBy(exercises.name)

  return c.json(rows)
})

export default app
