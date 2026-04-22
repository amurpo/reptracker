import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { getDb, routines, routineExercises, weeklyPlan, exercises } from '../db'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../index'

type Variables = { userId: string }

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', authMiddleware)

// Listar rutinas del usuario (con conteo de ejercicios)
app.get('/', async (c) => {
  const userId = parseInt(c.get('userId'))
  const db = getDb(c.env.DB)

  const list = await db.select().from(routines).where(eq(routines.userId, userId))

  const withCount = await Promise.all(list.map(async (r) => {
    const exs = await db.select().from(routineExercises).where(eq(routineExercises.routineId, r.id))
    return { ...r, exerciseCount: exs.length }
  }))

  return c.json(withCount)
})

// Guardar rutina (nombre + ejercicios del día actual)
app.post('/', async (c) => {
  const userId = parseInt(c.get('userId'))
  const { name, exercises: exList } = await c.req.json<{
    name: string
    exercises: { exerciseId: number; sets: number; reps: number; repsConfig?: number | null; weightKg?: number | null; orderIndex: number }[]
  }>()

  const nameTrimmed = String(name ?? '').trim()
  if (!nameTrimmed || nameTrimmed.length > 50) return c.json({ error: 'El nombre debe tener entre 1 y 50 caracteres' }, 400)
  if (!exList?.length) return c.json({ error: 'La rutina debe tener al menos un ejercicio' }, 400)
  if (exList.length > 30) return c.json({ error: 'La rutina no puede tener más de 30 ejercicios' }, 400)

  const db = getDb(c.env.DB)

  const inserted = await db.insert(routines).values({ userId, name: nameTrimmed }).returning()
  const routine = inserted[0]

  await db.insert(routineExercises).values(
    exList.map((e) => ({
      routineId: routine.id,
      exerciseId: e.exerciseId,
      sets: e.sets,
      reps: e.reps,
      repsConfig: e.repsConfig ? JSON.stringify(e.repsConfig) : null,
      weightKg: e.weightKg ?? null,
      orderIndex: e.orderIndex,
    }))
  )

  return c.json({ ...routine, exerciseCount: exList.length }, 201)
})

// Eliminar rutina
app.delete('/:id', async (c) => {
  const userId = parseInt(c.get('userId'))
  const id = parseInt(c.req.param('id'))
  const db = getDb(c.env.DB)

  await db.delete(routines).where(and(eq(routines.id, id), eq(routines.userId, userId)))
  return c.json({ ok: true })
})

// Aplicar rutina a un día de una semana específica (reemplaza los ejercicios del día)
app.post('/:id/apply', async (c) => {
  const userId = parseInt(c.get('userId'))
  const id = parseInt(c.req.param('id'))
  const { dayOfWeek, weekStart } = await c.req.json<{ dayOfWeek: number; weekStart: string }>()

  const dow = Number(dayOfWeek)
  if (!Number.isInteger(dow) || dow < 0 || dow > 6) return c.json({ error: 'dayOfWeek inválido (0-6)' }, 400)
  if (!weekStart) return c.json({ error: 'weekStart requerido' }, 400)

  const db = getDb(c.env.DB)

  const routine = await db.select().from(routines).where(and(eq(routines.id, id), eq(routines.userId, userId)))
  if (!routine[0]) return c.json({ error: 'Rutina no encontrada' }, 404)

  const routineExs = await db.select().from(routineExercises).where(eq(routineExercises.routineId, id))

  // Borrar plan del día para esa semana específica
  await db.delete(weeklyPlan).where(
    and(eq(weeklyPlan.userId, userId), eq(weeklyPlan.weekStart, weekStart), eq(weeklyPlan.dayOfWeek, dayOfWeek))
  )

  if (!routineExs.length) return c.json([])

  const inserted = await db.insert(weeklyPlan).values(
    routineExs.map((e) => ({
      userId, weekStart, dayOfWeek,
      exerciseId: e.exerciseId,
      sets: e.sets,
      reps: e.reps,
      repsConfig: e.repsConfig ?? null,
      weightKg: e.weightKg,
      orderIndex: e.orderIndex,
    }))
  ).returning()

  // Join con nombre de ejercicio para devolver PlanEntry completo
  const result = await Promise.all(inserted.map(async (entry) => {
    const ex = await db.select({ name: exercises.name, muscleGroup: exercises.muscleGroup })
      .from(exercises).where(eq(exercises.id, entry.exerciseId))
    return {
      ...entry,
      repsConfig: entry.repsConfig ? JSON.parse(entry.repsConfig) as number[] : null,
      exerciseName: ex[0]?.name ?? '',
      muscleGroup: ex[0]?.muscleGroup ?? '',
    }
  }))

  return c.json(result)
})

export default app
