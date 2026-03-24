import type { Context, Next } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb, users } from '../db'
import type { Env } from '../index'

export async function supersuMiddleware(
  c: Context<{ Bindings: Env; Variables: { userId: string } }>,
  next: Next
) {
  const userId = parseInt(c.get('userId'))
  const db = getDb(c.env.DB)

  const rows = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))

  if (rows[0]?.role !== 'supersu') {
    return c.json({ error: 'Acceso denegado' }, 403)
  }

  await next()
}
