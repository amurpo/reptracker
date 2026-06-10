import { Hono } from 'hono'
import { eq, and, or, isNull, inArray, sql } from 'drizzle-orm'
import { getDb, routines, routineExercises, weeklyPlan, exercises } from '../db'
import { authMiddleware } from '../middleware/auth'
import { parseRepsConfig, serializeRepsConfig } from '../lib/repsConfig'
import type { Env } from '../index'

type Variables = { userId: number }

type RoutineExerciseInput = {
  exerciseId: number
  sets: number
  reps: number
  repsConfig?: number[] | null
  weightKg?: number | null
  orderIndex: number
}

// Valida nombre y ejercicios de una rutina. Devuelve el error a responder o null si es válida.
function validateRoutineBody(nameTrimmed: string, exList: RoutineExerciseInput[] | undefined): string | null {
  if (!nameTrimmed || nameTrimmed.length > 50) return 'El nombre debe tener entre 1 y 50 caracteres'
  if (!exList?.length) return 'La rutina debe tener al menos un ejercicio'
  if (exList.length > 30) return 'La rutina no puede tener más de 30 ejercicios'

  for (const e of exList) {
    const id = Number(e.exerciseId)
    const s = Number(e.sets)
    const r = Number(e.reps)
    if (!Number.isInteger(id) || id < 1) return 'Ejercicio inválido'
    if (!Number.isInteger(s) || s < 1 || s > 20) return 'Series inválidas (1-20)'
    if (!Number.isInteger(r) || r < 1 || r > 200) return 'Repeticiones inválidas (1-200)'
    if (e.weightKg != null) {
      const w = Number(e.weightKg)
      if (isNaN(w) || w < 0 || w > 1000) return 'Peso inválido (0-1000 kg)'
    }
    if (e.repsConfig != null) {
      if (!Array.isArray(e.repsConfig) || e.repsConfig.length !== s ||
          e.repsConfig.some(v => !Number.isInteger(v) || v < 1 || v > 200))
        return 'repsConfig debe tener un entero (1-200) por serie'
    }
  }
  return null
}

// Verifica que todos los ejercicios sean del catálogo global o propios no eliminados.
async function allExercisesAllowed(db: ReturnType<typeof getDb>, userId: number, exList: RoutineExerciseInput[]): Promise<boolean> {
  const ids = [...new Set(exList.map(e => Number(e.exerciseId)))]
  const allowed = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(
      inArray(exercises.id, ids),
      eq(exercises.isDeleted, 0),
      or(isNull(exercises.userId), and(eq(exercises.userId, userId), eq(exercises.isCustom, 1))),
    ))
  const allowedSet = new Set(allowed.map(r => r.id))
  return ids.every(id => allowedSet.has(id))
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', authMiddleware)

// Listar rutinas del usuario (con conteo de ejercicios)
app.get('/', async (c) => {
  const userId = c.get('userId')
  const db = getDb(c.env.DB)

  const list = await db
    .select({
      id: routines.id,
      userId: routines.userId,
      name: routines.name,
      createdAt: routines.createdAt,
      exerciseCount: sql<number>`count(${routineExercises.id})`,
    })
    .from(routines)
    .leftJoin(routineExercises, eq(routineExercises.routineId, routines.id))
    .where(eq(routines.userId, userId))
    .groupBy(routines.id)

  return c.json(list)
})

// Guardar rutina (nombre + ejercicios del día actual)
app.post('/', async (c) => {
  const userId = c.get('userId')
  const { name, exercises: exList } = await c.req.json<{ name: string; exercises: RoutineExerciseInput[] }>()

  const nameTrimmed = String(name ?? '').trim()
  const validationError = validateRoutineBody(nameTrimmed, exList)
  if (validationError) return c.json({ error: validationError }, 400)

  const db = getDb(c.env.DB)

  if (!(await allExercisesAllowed(db, userId, exList))) {
    return c.json({ error: 'Algún ejercicio no existe o no te pertenece' }, 404)
  }

  const inserted = await db.insert(routines).values({ userId, name: nameTrimmed }).returning()
  const routine = inserted[0]

  await db.insert(routineExercises).values(
    exList.map((e) => ({
      routineId: routine.id,
      exerciseId: e.exerciseId,
      sets: e.sets,
      reps: e.reps,
      repsConfig: serializeRepsConfig(e.repsConfig),
      weightKg: e.weightKg ?? null,
      orderIndex: e.orderIndex,
    }))
  )

  return c.json({ ...routine, exerciseCount: exList.length }, 201)
})

// Reemplazar una rutina existente (nombre + ejercicios)
app.put('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  if (!Number.isInteger(id) || id < 1) return c.json({ error: 'Rutina inválida' }, 400)

  const { name, exercises: exList } = await c.req.json<{ name: string; exercises: RoutineExerciseInput[] }>()

  const nameTrimmed = String(name ?? '').trim()
  const validationError = validateRoutineBody(nameTrimmed, exList)
  if (validationError) return c.json({ error: validationError }, 400)

  const db = getDb(c.env.DB)

  const existing = await db.select().from(routines).where(and(eq(routines.id, id), eq(routines.userId, userId)))
  if (!existing[0]) return c.json({ error: 'Rutina no encontrada' }, 404)

  if (!(await allExercisesAllowed(db, userId, exList))) {
    return c.json({ error: 'Algún ejercicio no existe o no te pertenece' }, 404)
  }

  const updated = await db.update(routines).set({ name: nameTrimmed }).where(eq(routines.id, id)).returning()

  await db.delete(routineExercises).where(eq(routineExercises.routineId, id))
  await db.insert(routineExercises).values(
    exList.map((e) => ({
      routineId: id,
      exerciseId: e.exerciseId,
      sets: e.sets,
      reps: e.reps,
      repsConfig: serializeRepsConfig(e.repsConfig),
      weightKg: e.weightKg ?? null,
      orderIndex: e.orderIndex,
    }))
  )

  return c.json({ ...updated[0], exerciseCount: exList.length })
})

// Eliminar rutina
app.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const db = getDb(c.env.DB)

  await db.delete(routines).where(and(eq(routines.id, id), eq(routines.userId, userId)))
  return c.json({ ok: true })
})

// Aplicar rutina a un día de una semana específica (reemplaza los ejercicios del día)
app.post('/:id/apply', async (c) => {
  const userId = c.get('userId')
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

  // Nombres de ejercicios en una sola consulta para devolver PlanEntry completo
  const exIds = [...new Set(inserted.map(e => e.exerciseId))]
  const exRows = await db
    .select({ id: exercises.id, name: exercises.name, muscleGroup: exercises.muscleGroup })
    .from(exercises)
    .where(inArray(exercises.id, exIds))
  const exMap = new Map(exRows.map(e => [e.id, e]))

  const result = inserted.map((entry) => ({
    ...entry,
    repsConfig: parseRepsConfig(entry.repsConfig),
    exerciseName: exMap.get(entry.exerciseId)?.name ?? '',
    muscleGroup: exMap.get(entry.exerciseId)?.muscleGroup ?? '',
  }))

  return c.json(result)
})

export default app
