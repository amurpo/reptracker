import { Hono } from 'hono'
import { eq, and, or, isNull } from 'drizzle-orm'
import { getDb, weeklyPlan, exercises } from '../db'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../index'

type Variables = { userId: string }

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', authMiddleware)

app.get('/', async (c) => {
  const userId = parseInt(c.get('userId'))
  const db = getDb(c.env.DB)

  const plan = await db
    .select({
      id: weeklyPlan.id,
      dayOfWeek: weeklyPlan.dayOfWeek,
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
    .where(eq(weeklyPlan.userId, userId))

  return c.json(plan)
})

app.post('/', async (c) => {
  const userId = parseInt(c.get('userId'))
  const { dayOfWeek, exerciseId, sets, reps, weightKg, orderIndex, isCardio, durationMinutes } = await c.req.json<{
    dayOfWeek: number
    exerciseId: number
    sets?: number
    reps?: number
    weightKg?: number | null
    orderIndex?: number
    isCardio?: number
    durationMinutes?: number | null
  }>()

  if (dayOfWeek === undefined || dayOfWeek === null || !exerciseId) {
    return c.json({ error: 'Día y ejercicio requeridos' }, 400)
  }

  const db = getDb(c.env.DB)

  // Verify exercise belongs to user
  const ex = await db.select().from(exercises)
    .where(and(eq(exercises.id, exerciseId), or(eq(exercises.userId, userId), isNull(exercises.userId))))
  if (!ex[0]) return c.json({ error: 'Ejercicio no encontrado' }, 404)

  const inserted = await db.insert(weeklyPlan).values({
    userId,
    dayOfWeek,
    exerciseId,
    sets: sets ?? 3,
    reps: reps ?? 10,
    weightKg: weightKg ?? null,
    orderIndex: orderIndex ?? 0,
    isCardio: isCardio ?? 0,
    durationMinutes: durationMinutes ?? null,
  }).returning()

  const entry = inserted[0]
  return c.json({ ...entry, exerciseName: ex[0].name, muscleGroup: ex[0].muscleGroup }, 201)
})

app.put('/:id', async (c) => {
  const userId = parseInt(c.get('userId'))
  const id = parseInt(c.req.param('id'))
  const { sets, reps, weightKg, isCardio, durationMinutes } = await c.req.json<{ sets: number; reps: number; weightKg?: number | null; isCardio?: number; durationMinutes?: number | null }>()
  const db = getDb(c.env.DB)

  const updated = await db.update(weeklyPlan)
    .set({ sets, reps, weightKg: weightKg ?? null, isCardio: isCardio ?? 0, durationMinutes: durationMinutes ?? null })
    .where(and(eq(weeklyPlan.id, id), eq(weeklyPlan.userId, userId)))
    .returning()

  return c.json(updated[0])
})

app.delete('/:id', async (c) => {
  const userId = parseInt(c.get('userId'))
  const id = parseInt(c.req.param('id'))
  const db = getDb(c.env.DB)

  await db.delete(weeklyPlan).where(and(eq(weeklyPlan.id, id), eq(weeklyPlan.userId, userId)))
  return c.json({ ok: true })
})

export default app
