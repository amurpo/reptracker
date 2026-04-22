import { Hono } from 'hono'
import { eq, and, like, sql, inArray } from 'drizzle-orm'
import { getDb, workoutSessions, completedSets, weeklyPlan, exercises, users } from '../db'
import { authMiddleware } from '../middleware/auth'
import { calcWeekStart, calcDayOfWeek } from '../lib/dates'
import type { Env } from '../index'

type Variables = { userId: string }

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', authMiddleware)

// Get all sessions for a month (YYYY-MM)
app.get('/month/:yearMonth', async (c) => {
  const userId = parseInt(c.get('userId'))
  const yearMonth = c.req.param('yearMonth')
  const db = getDb(c.env.DB)

  const rows = await db
    .select({
      date: workoutSessions.date,
      completedSets: sql<number>`count(${completedSets.id})`,
    })
    .from(workoutSessions)
    .leftJoin(completedSets, eq(completedSets.sessionId, workoutSessions.id))
    .where(and(eq(workoutSessions.userId, userId), like(workoutSessions.date, `${yearMonth}-%`)))
    .groupBy(workoutSessions.date)

  return c.json(rows)
})

// Get session for a date
app.get('/:date', async (c) => {
  const userId = parseInt(c.get('userId'))
  const date = c.req.param('date') // YYYY-MM-DD
  const db = getDb(c.env.DB)

  // Obtener preferencia de inicio de semana del usuario
  const userRows = await db.select({ weekStart: users.weekStart }).from(users).where(eq(users.id, userId))
  const weekStartPref = userRows[0]?.weekStart ?? 0

  const weekStart = calcWeekStart(date, weekStartPref)
  const dayOfWeek = calcDayOfWeek(date, weekStartPref)

  // Usar la fecha local del cliente para evitar problemas de zona horaria
  const today = c.req.query('today') ?? date

  // Para fechas pasadas: mostrar solo lo que fue completado realmente
  if (date < today) {
    const sessionRows = await db.select().from(workoutSessions)
      .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.date, date)))
    const session = sessionRows[0]

    if (!session) return c.json({ session: null, plan: [], completedSets: [] })

    const completed = await db.select().from(completedSets)
      .where(eq(completedSets.sessionId, session.id))

    if (completed.length === 0) return c.json({ session, plan: [], completedSets: [] })

    const planIds = [...new Set(completed.map(s => s.weeklyPlanId))]

    const plan = await db
      .select({
        id: weeklyPlan.id,
        exerciseId: weeklyPlan.exerciseId,
        sets: weeklyPlan.sets,
        reps: weeklyPlan.reps,
        weightKg: weeklyPlan.weightKg,
        orderIndex: weeklyPlan.orderIndex,
        isCardio: weeklyPlan.isCardio,
        durationMinutes: weeklyPlan.durationMinutes,
        exerciseName: exercises.name,
        muscleGroup: exercises.muscleGroup,
      })
      .from(weeklyPlan)
      .innerJoin(exercises, eq(weeklyPlan.exerciseId, exercises.id))
      .where(inArray(weeklyPlan.id, planIds))

    return c.json({ session, plan, completedSets: completed })
  }

  // Para hoy: usar el plan de la semana actual
  const plan = await db
    .select({
      id: weeklyPlan.id,
      exerciseId: weeklyPlan.exerciseId,
      sets: weeklyPlan.sets,
      reps: weeklyPlan.reps,
      weightKg: weeklyPlan.weightKg,
      orderIndex: weeklyPlan.orderIndex,
      isCardio: weeklyPlan.isCardio,
      durationMinutes: weeklyPlan.durationMinutes,
      exerciseName: exercises.name,
      muscleGroup: exercises.muscleGroup,
    })
    .from(weeklyPlan)
    .innerJoin(exercises, eq(weeklyPlan.exerciseId, exercises.id))
    .where(and(
      eq(weeklyPlan.userId, userId),
      eq(weeklyPlan.weekStart, weekStart),
      eq(weeklyPlan.dayOfWeek, dayOfWeek),
    ))

  if (plan.length === 0) {
    return c.json({ session: null, plan: [], completedSets: [] })
  }

  // Obtener o crear sesión
  const sessionRows = await db.select().from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.date, date)))
  let session = sessionRows[0]

  if (!session) {
    const inserted = await db.insert(workoutSessions).values({ userId, date }).returning()
    session = inserted[0]
  }

  const completed = await db.select().from(completedSets)
    .where(eq(completedSets.sessionId, session.id))

  return c.json({ session, plan, completedSets: completed })
})

// Marcar un set como completado
app.post('/:date/complete', async (c) => {
  const userId = parseInt(c.get('userId'))
  const date = c.req.param('date')
  const { weeklyPlanId, setNumber } = await c.req.json<{ weeklyPlanId: number; setNumber: number }>()
  const db = getDb(c.env.DB)

  const sessionRows = await db.select().from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.date, date)))
  let session = sessionRows[0]

  if (!session) {
    const inserted = await db.insert(workoutSessions).values({ userId, date }).returning()
    session = inserted[0]
  }

  await db.insert(completedSets).values({
    sessionId: session.id,
    weeklyPlanId,
    setNumber,
  }).onConflictDoNothing()

  return c.json({ ok: true })
})

// Desmarcar un set
app.delete('/:date/complete', async (c) => {
  const userId = parseInt(c.get('userId'))
  const date = c.req.param('date')
  const { weeklyPlanId, setNumber } = await c.req.json<{ weeklyPlanId: number; setNumber: number }>()
  const db = getDb(c.env.DB)

  const sessionRows = await db.select().from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.date, date)))
  const session = sessionRows[0]

  if (!session) return c.json({ ok: true })

  await db.delete(completedSets).where(
    and(
      eq(completedSets.sessionId, session.id),
      eq(completedSets.weeklyPlanId, weeklyPlanId),
      eq(completedSets.setNumber, setNumber)
    )
  )

  return c.json({ ok: true })
})

export default app
