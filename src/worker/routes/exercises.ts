import { Hono } from 'hono'
import { eq, and, or, isNull } from 'drizzle-orm'
import { getDb, exercises } from '../db'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../index'

type Variables = { userId: number }

const VALID_MUSCLE_GROUPS = [
  'abdominales', 'abductores', 'aductores', 'bíceps', 'pantorrillas',
  'pecho', 'antebrazos', 'glúteos', 'isquiotibiales', 'dorsales',
  'lumbar', 'espalda media', 'cuello', 'cuádriceps', 'hombros',
  'trapecios', 'tríceps',
]

function validateExerciseFields(name: string, muscleGroup: string) {
  const n = String(name ?? '').trim()
  if (!n || n.length > 50) return 'El nombre debe tener entre 1 y 50 caracteres'
  if (!VALID_MUSCLE_GROUPS.includes(muscleGroup)) return 'Grupo muscular inválido'
  return null
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', authMiddleware)

// GET / — catálogo global + ejercicios custom del usuario (no eliminados)
app.get('/', async (c) => {
  const userId = c.get('userId')
  const db = getDb(c.env.DB)

  const list = await db
    .select()
    .from(exercises)
    .where(
      and(
        eq(exercises.isDeleted, 0),
        or(
          isNull(exercises.userId),
          and(eq(exercises.userId, userId), eq(exercises.isCustom, 1))
        )
      )
    )

  return c.json(list)
})

// POST / — crear ejercicio custom (máx 20)
app.post('/', async (c) => {
  const userId = c.get('userId')
  const { name, muscleGroup } = await c.req.json<{ name: string; muscleGroup: string }>()
  const err = validateExerciseFields(name, muscleGroup)
  if (err) return c.json({ error: err }, 400)

  const db = getDb(c.env.DB)

  const existing = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(
      and(
        eq(exercises.userId, userId),
        eq(exercises.isCustom, 1),
        eq(exercises.isDeleted, 0)
      )
    )

  if (existing.length >= 20) {
    return c.json({ error: 'Límite de 20 ejercicios personalizados alcanzado' }, 403)
  }

  const inserted = await db
    .insert(exercises)
    .values({ userId, name: name.trim(), muscleGroup, isCustom: 1 })
    .returning()

  return c.json(inserted[0], 201)
})

// PATCH /:id — editar nombre y grupo muscular (solo ejercicios custom propios)
app.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const { name, muscleGroup } = await c.req.json<{ name: string; muscleGroup: string }>()
  const err = validateExerciseFields(name, muscleGroup)
  if (err) return c.json({ error: err }, 400)

  const db = getDb(c.env.DB)

  const target = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.id, id), eq(exercises.userId, userId), eq(exercises.isCustom, 1)))

  if (target.length === 0) {
    return c.json({ error: 'Ejercicio no encontrado' }, 404)
  }

  const updated = await db
    .update(exercises)
    .set({ name: name.trim(), muscleGroup })
    .where(eq(exercises.id, id))
    .returning()

  return c.json(updated[0])
})

// GET /:id/image — obtener imagen custom
app.get('/:id/image', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const image = await c.env.EXERCISE_IMAGES.get(`ex:${userId}:${id}`)
  return c.json({ image: image ?? null })
})

// PUT /:id/image — subir imagen custom (solo ejercicios propios, máx 200KB)
app.put('/:id/image', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const { image } = await c.req.json<{ image: string }>()

  if (!image || !image.startsWith('data:image/')) {
    return c.json({ error: 'Imagen inválida' }, 400)
  }
  if (image.length > 200_000) {
    return c.json({ error: 'La imagen no puede superar 200 KB' }, 400)
  }

  const db = getDb(c.env.DB)
  const target = await db.select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.id, id), eq(exercises.userId, userId), eq(exercises.isCustom, 1)))

  if (target.length === 0) return c.json({ error: 'Ejercicio no encontrado' }, 404)

  await c.env.EXERCISE_IMAGES.put(`ex:${userId}:${id}`, image)
  // Guardar referencia en la DB para que el GET /exercises la devuelva
  const updated = await db.update(exercises)
    .set({ imageUrl: `kv:${userId}:${id}` })
    .where(eq(exercises.id, id))
    .returning()

  return c.json({ ok: true, imageUrl: updated[0].imageUrl })
})

// DELETE /:id/image — eliminar imagen custom
app.delete('/:id/image', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))

  const db = getDb(c.env.DB)
  const target = await db.select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.id, id), eq(exercises.userId, userId), eq(exercises.isCustom, 1)))

  if (target.length === 0) return c.json({ error: 'Ejercicio no encontrado' }, 404)

  await c.env.EXERCISE_IMAGES.delete(`ex:${userId}:${id}`)
  await db.update(exercises).set({ imageUrl: null }).where(eq(exercises.id, id))
  return c.json({ ok: true })
})

// DELETE /:id — soft delete (solo ejercicios custom propios)
app.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const db = getDb(c.env.DB)

  const target = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(
      and(
        eq(exercises.id, id),
        eq(exercises.userId, userId),
        eq(exercises.isCustom, 1)
      )
    )

  if (target.length === 0) {
    return c.json({ error: 'Ejercicio no encontrado' }, 404)
  }

  await db
    .update(exercises)
    .set({ isDeleted: 1 })
    .where(eq(exercises.id, id))

  return c.json({ ok: true })
})

export default app
