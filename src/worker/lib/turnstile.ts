import type { Context } from 'hono'
import type { Env } from '../index'

export async function verifyTurnstile(secret: string, token: string, ip?: string): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set('remoteip', ip)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  })
  const data = await res.json<{ success: boolean }>()
  return data.success
}

// Valida el token de Turnstile. Devuelve una respuesta 400 si falla, o null si es válido.
export async function requireTurnstile(c: Context<{ Bindings: Env }>, token: string): Promise<Response | null> {
  const ok = await verifyTurnstile(c.env.TURNSTILE_SECRET, token ?? '', c.req.header('CF-Connecting-IP'))
  if (!ok) return c.json({ error: 'Verificación de seguridad fallida. Inténtalo de nuevo.' }, 400)
  return null
}
