import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { jwtVerify } from 'jose'
import type { Env } from '../index'

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: { userId: string } }>, next: Next) {
  const token = getCookie(c, 'session')
  if (!token) {
    return c.json({ error: 'No autorizado' }, 401)
  }

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    c.set('userId', payload.sub as string)
    await next()
  } catch {
    return c.json({ error: 'Token inválido' }, 401)
  }
}
