import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { jwtVerify } from 'jose'
import { eq } from 'drizzle-orm'
import { getDb, users } from '../db'
import type { Env } from '../index'

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: { userId: number } }>, next: Next) {
  const token = getCookie(c, 'session')
  if (!token) {
    return c.json({ error: 'No autorizado' }, 401)
  }

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    const userId = parseInt(payload.sub as string)

    // Verificar que la sesión no haya sido revocada (cambio o restablecimiento de contraseña).
    const db = getDb(c.env.DB)
    const rows = await db
      .select({ tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, userId))

    if (!rows[0]) return c.json({ error: 'No autorizado' }, 401)

    const tokenVer = typeof payload.ver === 'number' ? payload.ver : 0
    if (tokenVer !== rows[0].tokenVersion) {
      return c.json({ error: 'Sesión expirada' }, 401)
    }

    c.set('userId', userId)
    await next()
  } catch {
    return c.json({ error: 'Token inválido' }, 401)
  }
}
