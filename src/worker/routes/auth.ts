import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { SignJWT } from 'jose'
import { eq } from 'drizzle-orm'
import { getDb, users, emailVerificationTokens, passwordResetTokens } from '../db'
import { hashPassword, verifyPassword } from '../lib/crypto'
import { verifyTurnstile } from '../lib/turnstile'
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email'
import type { Env } from '../index'

const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 días en segundos

const auth = new Hono<{ Bindings: Env }>()

auth.post('/register', async (c) => {
  try {
    const body = await c.req.json<{ email: string; password: string; turnstileToken: string }>()
    const { email, password, turnstileToken } = body

    const turnstileOk = await verifyTurnstile(c.env.TURNSTILE_SECRET, turnstileToken ?? '', c.req.header('CF-Connecting-IP'))
    if (!turnstileOk) return c.json({ error: 'Verificación de seguridad fallida. Inténtalo de nuevo.' }, 400)

    const emailTrimmed = String(email ?? '').trim().toLowerCase()
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed) && emailTrimmed.length <= 254
    if (!emailValid || !password || password.length < 8 || password.length > 72) {
      return c.json({ error: 'Email inválido o contraseña fuera de rango (8-72 caracteres)' }, 400)
    }

    const db = getDb(c.env.DB)
    const existing = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, emailTrimmed))

    if (existing.length > 0) {
      if (existing[0].emailVerified) {
        return c.json({ error: 'El email ya está registrado' }, 409)
      }
      // No verificado: actualizar contraseña y reenviar link
      const newHash = await hashPassword(password)
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, existing[0].id))
      await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, existing[0].id))
      const token = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      await db.insert(emailVerificationTokens).values({ userId: existing[0].id, token, expiresAt })
      const origin = new URL(c.req.url).origin
      try {
        await sendVerificationEmail(c.env.RESEND_API_KEY, emailTrimmed, `${origin}/verify?token=${token}`)
      } catch { /* silent */ }
      return c.json({ message: 'Te reenviamos el email de confirmación.' })
    }

    const passwordHash = await hashPassword(password)
    const inserted = await db.insert(users).values({
      email: emailTrimmed,
      passwordHash,
    }).returning({ id: users.id, email: users.email })

    const user = inserted[0]
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await db.insert(emailVerificationTokens).values({ userId: user.id, token, expiresAt })

    const origin = new URL(c.req.url).origin
    try {
      await sendVerificationEmail(c.env.RESEND_API_KEY, user.email, `${origin}/verify?token=${token}`)
    } catch { /* silent */ }

    return c.json({ message: 'Te enviamos un email para confirmar tu cuenta.' })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

auth.post('/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string; turnstileToken: string }>()
  const { email, password, turnstileToken } = body

  const turnstileOk = await verifyTurnstile(c.env.TURNSTILE_SECRET, turnstileToken ?? '', c.req.header('CF-Connecting-IP'))
  if (!turnstileOk) return c.json({ error: 'Verificación de seguridad fallida. Inténtalo de nuevo.' }, 400)

  if (!email || !password) {
    return c.json({ error: 'Email y contraseña requeridos' }, 400)
  }

  const db = getDb(c.env.DB)
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase()))
  const user = rows[0]

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return c.json({ error: 'Credenciales incorrectas' }, 401)
  }

  if (!user.emailVerified) {
    return c.json({ error: 'email_not_verified' }, 403)
  }

  const secret = new TextEncoder().encode(c.env.JWT_SECRET)
  const jwt = await new SignJWT({ sub: String(user.id) })
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

  return c.json({ user: { id: user.id, email: user.email } })
})

auth.post('/logout', async (c) => {
  deleteCookie(c, 'session', { path: '/' })
  return c.json({ ok: true })
})

auth.get('/verify/:token', async (c) => {
  const token = c.req.param('token')
  const db = getDb(c.env.DB)

  const rows = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, token))

  const record = rows[0]
  if (!record) return c.json({ error: 'Enlace inválido o ya utilizado' }, 400)

  if (new Date(record.expiresAt) < new Date()) {
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.token, token))
    return c.json({ error: 'El enlace ha expirado' }, 400)
  }

  await db.update(users).set({ emailVerified: 1 }).where(eq(users.id, record.userId))
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.token, token))

  return c.json({ ok: true })
})

auth.post('/forgot-password', async (c) => {
  try {
    const { email, turnstileToken } = await c.req.json<{ email: string; turnstileToken: string }>()
    if (!email) return c.json({ error: 'Email requerido' }, 400)

    const turnstileOk = await verifyTurnstile(c.env.TURNSTILE_SECRET, turnstileToken ?? '', c.req.header('CF-Connecting-IP'))
    if (!turnstileOk) return c.json({ error: 'Verificación de seguridad fallida. Inténtalo de nuevo.' }, 400)

    const db = getDb(c.env.DB)
    const rows = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email.toLowerCase()))

    // Siempre responder igual para no revelar si el email existe
    if (rows[0]) {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, rows[0].id))
      const token = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString()
      await db.insert(passwordResetTokens).values({ userId: rows[0].id, token, expiresAt })

      const origin = new URL(c.req.url).origin
      try {
        await sendPasswordResetEmail(c.env.RESEND_API_KEY, rows[0].email, `${origin}/reset-password?token=${token}`)
      } catch { /* silent */ }
    }

    return c.json({ message: 'Si ese email está registrado, recibirás un enlace en breve.' })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

auth.post('/reset-password', async (c) => {
  const { token, password } = await c.req.json<{ token: string; password: string }>()
  if (!token || !password || password.length < 8 || password.length > 72) {
    return c.json({ error: 'La contraseña debe tener entre 8 y 72 caracteres' }, 400)
  }

  const db = getDb(c.env.DB)
  const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token))
  const record = rows[0]

  if (!record) return c.json({ error: 'Enlace inválido o ya utilizado' }, 400)
  if (new Date(record.expiresAt) < new Date()) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token))
    return c.json({ error: 'El enlace ha expirado' }, 400)
  }

  const newHash = await hashPassword(password)
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, record.userId))
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token))

  return c.json({ ok: true })
})

export default auth
