import { Hono } from 'hono'
import { eq, and, or, isNull, sql } from 'drizzle-orm'
import { getDb, weeklyPlan, exercises } from '../db'
import { authMiddleware } from '../middleware/auth'
import { parseRepsConfig, serializeRepsConfig } from '../lib/repsConfig'
import type { Env } from '../index'

type Variables = { userId: number }

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

function validatePlanFields(fields: {
  dayOfWeek?: number
  sets?: number
  reps?: number
  repsConfig?: number[] | null
  weightKg?: number | null
  isCardio?: number
  durationMinutes?: number | null
}): string | null {
  const { dayOfWeek, sets, reps, repsConfig, weightKg, isCardio, durationMinutes } = fields
  if (dayOfWeek !== undefined && (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6))
    return 'dayOfWeek inválido (0-6)'
  if (isCardio) {
    const d = Number(durationMinutes)
    if (isNaN(d) || d < 1 || d > 600) return 'Duración inválida (1-600 min)'
  } else {
    const s = Number(sets)
    const r = Number(reps)
    if (!Number.isInteger(s) || s < 1 || s > 20) return 'Series inválidas (1-20)'
    if (!Number.isInteger(r) || r < 1 || r > 200) return 'Repeticiones inválidas (1-200)'
    if (repsConfig != null) {
      if (!Array.isArray(repsConfig) || repsConfig.length !== s)
        return 'repsConfig debe tener exactamente una entrada por serie'
      if (repsConfig.some(v => !Number.isInteger(v) || v < 1 || v > 200))
        return 'Cada rep en repsConfig debe ser un entero entre 1 y 200'
    }
    if (weightKg !== undefined && weightKg !== null) {
      const w = Number(weightKg)
      if (isNaN(w) || w < 0 || w > 1000) return 'Peso inválido (0-1000 kg)'
    }
  }
  return null
}

app.use('*', authMiddleware)

// Días planificados en un mes (para la vista de planificación mensual)
app.get('/month/:yearMonth', async (c) => {
  const userId = c.get('userId')
  const yearMonth = c.req.param('yearMonth')
  const db = getDb(c.env.DB)

  const dateExpr = sql<string>`date(${weeklyPlan.weekStart}, '+' || ${weeklyPlan.dayOfWeek} || ' days')`
  const pattern = yearMonth + '-%'

  const rows = await db.selectDistinct({ date: dateExpr })
    .from(weeklyPlan)
    .where(and(
      eq(weeklyPlan.userId, userId),
      eq(weeklyPlan.isDeleted, 0),
      sql`date(${weeklyPlan.weekStart}, '+' || ${weeklyPlan.dayOfWeek} || ' days') LIKE ${pattern}`
    ))

  return c.json(rows.map(r => r.date))
})

app.get('/', async (c) => {
  const userId = c.get('userId')
  const weekStart = c.req.query('weekStart') ?? ''
  const db = getDb(c.env.DB)

  const plan = await db
    .select({
      id: weeklyPlan.id,
      weekStart: weeklyPlan.weekStart,
      dayOfWeek: weeklyPlan.dayOfWeek,
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
    })
    .from(weeklyPlan)
    .innerJoin(exercises, eq(weeklyPlan.exerciseId, exercises.id))
    .where(and(eq(weeklyPlan.userId, userId), eq(weeklyPlan.weekStart, weekStart), eq(weeklyPlan.isDeleted, 0)))

  return c.json(plan.map(e => ({
    ...e,
    repsConfig: parseRepsConfig(e.repsConfig),
  })))
})

app.post('/', async (c) => {
  const userId = c.get('userId')
  const { weekStart, dayOfWeek, exerciseId, sets, reps, repsConfig, weightKg, orderIndex, isCardio, durationMinutes } = await c.req.json<{
    weekStart: string; dayOfWeek: number; exerciseId: number; sets?: number; reps?: number
    repsConfig?: number[] | null; weightKg?: number | null; orderIndex?: number; isCardio?: number; durationMinutes?: number | null
  }>()

  if (!weekStart || dayOfWeek === undefined || dayOfWeek === null || !exerciseId)
    return c.json({ error: 'Semana, día y ejercicio requeridos' }, 400)
  const errPost = validatePlanFields({ dayOfWeek, sets, reps, repsConfig, weightKg, isCardio, durationMinutes })
  if (errPost) return c.json({ error: errPost }, 400)

  const db = getDb(c.env.DB)

  const ex = await db.select().from(exercises)
    .where(and(eq(exercises.id, exerciseId), or(eq(exercises.userId, userId), isNull(exercises.userId))))
  if (!ex[0]) return c.json({ error: 'Ejercicio no encontrado' }, 404)

  const inserted = await db.insert(weeklyPlan).values({
    userId, weekStart, dayOfWeek, exerciseId,
    sets: sets ?? 3, reps: reps ?? 10,
    repsConfig: serializeRepsConfig(repsConfig),
    weightKg: weightKg ?? null,
    orderIndex: orderIndex ?? 0,
    isCardio: isCardio ?? 0,
    durationMinutes: durationMinutes ?? null,
  }).returning()

  const entry = inserted[0]
  return c.json({
    ...entry,
    repsConfig: parseRepsConfig(entry.repsConfig),
    exerciseName: ex[0].name,
    muscleGroup: ex[0].muscleGroup,
  }, 201)
})

app.put('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const { sets, reps, repsConfig, weightKg, isCardio, durationMinutes } = await c.req.json<{
    sets: number; reps: number; repsConfig?: number[] | null; weightKg?: number | null; isCardio?: number; durationMinutes?: number | null
  }>()
  const errPut = validatePlanFields({ sets, reps, repsConfig, weightKg, isCardio, durationMinutes })
  if (errPut) return c.json({ error: errPut }, 400)
  const db = getDb(c.env.DB)

  const updated = await db.update(weeklyPlan)
    .set({ sets, reps, repsConfig: serializeRepsConfig(repsConfig), weightKg: weightKg ?? null, isCardio: isCardio ?? 0, durationMinutes: durationMinutes ?? null })
    .where(and(eq(weeklyPlan.id, id), eq(weeklyPlan.userId, userId)))
    .returning()

  const u = updated[0]
  return c.json({ ...u, repsConfig: parseRepsConfig(u.repsConfig) })
})

app.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const db = getDb(c.env.DB)

  // Soft-delete: conservar la fila para no perder el historial de completed_sets.
  await db.update(weeklyPlan).set({ isDeleted: 1 })
    .where(and(eq(weeklyPlan.id, id), eq(weeklyPlan.userId, userId)))
  return c.json({ ok: true })
})

export default app
