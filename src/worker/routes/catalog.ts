import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb, exerciseCatalog, exercises } from '../db'
import { authMiddleware } from '../middleware/auth'
import { supersuMiddleware } from '../middleware/supersu'
import type { Env } from '../index'

type Variables = { userId: string }

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', authMiddleware)
app.use('*', supersuMiddleware)

// PATCH /:id/image — actualizar imagen en catalog + ejercicios globales derivados
app.patch('/:id/image', async (c) => {
  const id = parseInt(c.req.param('id'))
  const { imageUrl } = await c.req.json<{ imageUrl: string }>()

  if (!imageUrl?.trim()) {
    return c.json({ error: 'imageUrl requerida' }, 400)
  }

  const db = getDb(c.env.DB)

  const target = await db
    .select({ id: exerciseCatalog.id })
    .from(exerciseCatalog)
    .where(eq(exerciseCatalog.id, id))

  if (target.length === 0) {
    return c.json({ error: 'Ejercicio no encontrado en el catálogo' }, 404)
  }

  // Actualizar en ambas tablas
  await db
    .update(exerciseCatalog)
    .set({ imageUrl })
    .where(eq(exerciseCatalog.id, id))

  await db
    .update(exercises)
    .set({ imageUrl })
    .where(eq(exercises.catalogId, id))

  return c.json({ ok: true })
})

export default app
