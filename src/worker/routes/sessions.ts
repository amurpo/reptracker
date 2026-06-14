import { Hono } from 'hono'
import { eq, and, like, sql, inArray } from 'drizzle-orm'
import { getDb, workoutSessions, completedSets, weeklyPlan, exercises, users } from '../db'
import { authMiddleware } from '../middleware/auth'
import { calcWeekStart, calcDayOfWeek } from '../lib/dates'
import { parseRepsConfig } from '../lib/repsConfig'
import type { Env } from '../index'

type Variables = { userId: number }
type Db = ReturnType<typeof getDb>

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', authMiddleware)

// Columnas del plan + nombre/grupo del ejercicio para la vista de sesión.
const planColumns = {
  id: weeklyPlan.id,
  exerciseId: weeklyPlan.exerciseId,
  sets: weeklyPlan.sets,
  reps: weeklyPlan.reps,
  repsConfig: weeklyPlan.repsConfig,
  weightKg: weeklyPlan.weightKg,
  orderIndex: weeklyPlan.orderIndex,
  isCardio: weeklyPlan.isCardio,
  durationMinutes: weeklyPlan.durationMinutes,
  exerciseName: exercises.name,
  muscleGroup: exercises.muscleGroup,
}

// El plan trae repsConfig como texto JSON; convertirlo a number[] para el cliente.
type PlanRow = { repsConfig: string | null } & Record<string, unknown>
function withParsedReps<T extends PlanRow>(plan: T[]) {
  return plan.map(e => ({ ...e, repsConfig: parseRepsConfig(e.repsConfig) }))
}

async function getOrCreateSession(db: Db, userId: number, date: string) {
  const rows = await db.select().from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.date, date)))
  if (rows[0]) return rows[0]
  const inserted = await db.insert(workoutSessions).values({ userId, date }).returning()
  return inserted[0]
}

// Todas las sesiones de un mes (YYYY-MM)
app.get('/month/:yearMonth', async (c) => {
  const userId = c.get('userId')
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

// Sesión de una fecha
app.get('/:date', async (c) => {
  const userId = c.get('userId')
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
      .select(planColumns)
      .from(weeklyPlan)
      .innerJoin(exercises, eq(weeklyPlan.exerciseId, exercises.id))
      .where(inArray(weeklyPlan.id, planIds))

    return c.json({ session, plan: withParsedReps(plan), completedSets: completed })
  }

  // Para hoy: usar el plan de la semana actual
  const plan = await db
    .select(planColumns)
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

  // No crear la sesión al solo abrir la página: se crea al completar la primera
  // serie (POST /complete). Así "días entrenados" y la racha solo cuentan días
  // con actividad real, no días en los que únicamente se abrió el plan.
  const sessionRows = await db.select().from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.date, date)))
  const session = sessionRows[0] ?? null

  const completed = session
    ? await db.select().from(completedSets).where(eq(completedSets.sessionId, session.id))
    : []

  return c.json({ session, plan: withParsedReps(plan), completedSets: completed })
})

// Marcar un set como completado
app.post('/:date/complete', async (c) => {
  const userId = c.get('userId')
  const date = c.req.param('date')
  const { weeklyPlanId, setNumber } = await c.req.json<{ weeklyPlanId: number; setNumber: number }>()
  const db = getDb(c.env.DB)

  const session = await getOrCreateSession(db, userId, date)

  await db.insert(completedSets).values({
    sessionId: session.id,
    weeklyPlanId,
    setNumber,
  }).onConflictDoNothing()

  return c.json({ ok: true })
})

// Desmarcar un set
app.delete('/:date/complete', async (c) => {
  const userId = c.get('userId')
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
