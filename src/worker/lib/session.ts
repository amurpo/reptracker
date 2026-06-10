import type { Context } from 'hono'
import { setCookie } from 'hono/cookie'
import { SignJWT } from 'jose'

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 días en segundos

// Firma un JWT de sesión y lo guarda en la cookie httpOnly.
// `tokenVersion` se incrusta en el token para poder revocar sesiones (ver authMiddleware).
export async function issueSession(c: Context, jwtSecret: string, userId: number, tokenVersion: number) {
  const secret = new TextEncoder().encode(jwtSecret)
  const jwt = await new SignJWT({ sub: String(userId), ver: tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret)

  const isSecure = new URL(c.req.url).protocol === 'https:'
  setCookie(c, 'session', jwt, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}
