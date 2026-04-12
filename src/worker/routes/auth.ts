import { Hono } from 'hono'
import { SignJWT } from 'jose'
import { eq } from 'drizzle-orm'
import { getDb, users, emailVerificationTokens, passwordResetTokens } from '../db'
import { hashPassword, verifyPassword } from '../lib/crypto'
import { verifyTurnstile } from '../lib/turnstile'
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email'
import type { Env } from '../index'

async function sendVerificationEmail(apiKey: string, to: string, verifyUrl: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'RepTracker <noreply@reptracker.amurpo.icu>',
      to,
      subject: 'Confirma tu cuenta en RepTracker',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f172a;color:#f1f5f9;border-radius:16px;">
          <img src="https://reptracker.amurpo.icu/logo-transparency.png" alt="RepTracker" style="display:block;width:80px;margin:0 auto 24px;" />
          <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;">Confirma tu cuenta</h1>
          <p style="color:#94a3b8;margin:0 0 28px;">Haz clic en el botón para verificar tu email y empezar a usar RepTracker.</p>
          <a href="${verifyUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;">
            Verificar email
          </a>
          <p style="color:#475569;font-size:13px;margin:28px 0 0;">El enlace expira en 24 horas. Si no creaste esta cuenta, ignora este mensaje.</p>
        </div>
      `,
    }),
  })
}


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
      .where(eq(users.email, email.toLowerCase()))

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
        await sendVerificationEmail(c.env.RESEND_API_KEY, email.toLowerCase(), `${origin}/verify?token=${token}`)
      } catch { /* silent */ }
      return c.json({ message: 'Te reenviamos el email de confirmación.' })
    }

    const passwordHash = await hashPassword(password)
    const inserted = await db.insert(users).values({
      email: email.toLowerCase(),
      passwordHash,
    }).returning({ id: users.id, email: users.email })

    const user = inserted[0]

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await db.insert(emailVerificationTokens).values({ userId: user.id, token, expiresAt })

    const origin = new URL(c.req.url).origin
    try {
      await sendVerificationEmail(c.env.RESEND_API_KEY, user.email, `${origin}/verify?token=${token}`)
    } catch {
      // El registro fue exitoso aunque el email falle
    }

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
  const token = await new SignJWT({ sub: String(user.id) })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret)

  return c.json({ token, user: { id: user.id, email: user.email } })
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
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString() // 1 hora
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
