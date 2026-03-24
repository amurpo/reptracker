import type { Context, Next } from 'hono'
import { jwtVerify } from 'jose'
import type { Env } from '../index'

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: { userId: string } }>, next: Next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'No autorizado' }, 401)
  }

  const token = authHeader.slice(7)
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    c.set('userId', payload.sub as string)
    await next()
  } catch {
    return c.json({ error: 'Token inválido' }, 401)
  }
}
