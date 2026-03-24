import { Hono } from 'hono'
import { SignJWT } from 'jose'
import { eq } from 'drizzle-orm'
import { getDb, users } from '../db'
import type { Env } from '../index'

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256
  )
  const saltB64 = btoa(String.fromCharCode(...new Uint8Array(salt)))
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
  return `${saltB64}:${hashB64}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(':')
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256
  )
  return btoa(String.fromCharCode(...new Uint8Array(hash))) === hashB64
}

const auth = new Hono<{ Bindings: Env }>()

auth.post('/register', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>()
  const { email, password } = body

  if (!email || !password || password.length < 8) {
    return c.json({ error: 'Email y contraseña (mín. 8 caracteres) requeridos' }, 400)
  }

  const db = getDb(c.env.DB)
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase()))
  if (existing.length > 0) {
    return c.json({ error: 'El email ya está registrado' }, 409)
  }

  const passwordHash = await hashPassword(password)
  const inserted = await db.insert(users).values({
    email: email.toLowerCase(),
    passwordHash,
  }).returning({ id: users.id, email: users.email })

  const user = inserted[0]
  const secret = new TextEncoder().encode(c.env.JWT_SECRET)
  const token = await new SignJWT({ sub: String(user.id) })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret)

  return c.json({ token, user: { id: user.id, email: user.email } })
})

auth.post('/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>()
  const { email, password } = body

  if (!email || !password) {
    return c.json({ error: 'Email y contraseña requeridos' }, 400)
  }

  const db = getDb(c.env.DB)
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase()))
  const user = rows[0]

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return c.json({ error: 'Credenciales incorrectas' }, 401)
  }

  const secret = new TextEncoder().encode(c.env.JWT_SECRET)
  const token = await new SignJWT({ sub: String(user.id) })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret)

  return c.json({ token, user: { id: user.id, email: user.email } })
})

export default auth
