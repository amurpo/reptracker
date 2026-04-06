import { Hono } from 'hono'
import { eq, and, or, isNull } from 'drizzle-orm'
import { getDb, exercises } from '../db'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../index'

type Variables = { userId: string }

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', authMiddleware)

// GET / — catálogo global + ejercicios custom del usuario (no eliminados)
app.get('/', async (c) => {
  const userId = parseInt(c.get('userId'))
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
  const userId = parseInt(c.get('userId'))
  const { name, muscleGroup } = await c.req.json<{ name: string; muscleGroup: string }>()

  if (!name?.trim() || !muscleGroup) {
    return c.json({ error: 'Nombre y grupo muscular requeridos' }, 400)
  }

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
  const userId = parseInt(c.get('userId'))
  const id = parseInt(c.req.param('id'))
  const { name, muscleGroup } = await c.req.json<{ name: string; muscleGroup: string }>()

  if (!name?.trim() || !muscleGroup) {
    return c.json({ error: 'Nombre y grupo muscular requeridos' }, 400)
  }

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

// DELETE /:id — soft delete (solo ejercicios custom propios)
app.delete('/:id', async (c) => {
  const userId = parseInt(c.get('userId'))
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
