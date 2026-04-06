import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb, users } from '../db'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../index'

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256)
  return `${btoa(String.fromCharCode(...new Uint8Array(salt)))}:${btoa(String.fromCharCode(...new Uint8Array(hash)))}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(':')
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256)
  return btoa(String.fromCharCode(...new Uint8Array(hash))) === hashB64
}

const profile = new Hono<{ Bindings: Env; Variables: { userId: string } }>()

profile.use('/*', authMiddleware)

const userFields = {
  id: users.id,
  email: users.email,
  name: users.name,
  age: users.age,
  weightKg: users.weightKg,
  dateFormat: users.dateFormat,
  timeFormat: users.timeFormat,
  weekStart: users.weekStart,
  theme: users.theme,
}

profile.get('/', async (c) => {
  const userId = parseInt(c.get('userId'))
  const db = getDb(c.env.DB)
  const rows = await db.select(userFields).from(users).where(eq(users.id, userId))
  if (!rows[0]) return c.json({ error: 'Usuario no encontrado' }, 404)
  return c.json(rows[0])
})

const VALID_DATE_FORMATS = ['dd-mm-yyyy', 'mm-dd-yyyy', 'yyyy-mm-dd']
const VALID_TIME_FORMATS = ['24h', '12h']
const VALID_WEEK_STARTS = [0, 1]
const VALID_THEMES = ['indigo', 'violet', 'emerald', 'sky', 'rose', 'amber']

profile.put('/', async (c) => {
  const userId = parseInt(c.get('userId'))
  const body = await c.req.json<{
    name?: string
    age?: number
    weightKg?: number
    dateFormat?: string
    timeFormat?: string
    weekStart?: number
    theme?: string
  }>()

  // Validar campos
  if (body.name !== undefined) {
    const n = String(body.name).trim()
    if (n.length > 50) return c.json({ error: 'El nombre no puede superar 50 caracteres' }, 400)
    body.name = n
  }
  if (body.age !== undefined) {
    const a = Number(body.age)
    if (!Number.isInteger(a) || a < 1 || a > 120) return c.json({ error: 'Edad inválida (1-120)' }, 400)
    body.age = a
  }
  if (body.weightKg !== undefined) {
    const w = Number(body.weightKg)
    if (isNaN(w) || w < 1 || w > 500) return c.json({ error: 'Peso inválido (1-500 kg)' }, 400)
    body.weightKg = Math.round(w * 10) / 10
  }
  if (body.dateFormat !== undefined && !VALID_DATE_FORMATS.includes(body.dateFormat))
    return c.json({ error: 'Formato de fecha inválido' }, 400)
  if (body.timeFormat !== undefined && !VALID_TIME_FORMATS.includes(body.timeFormat))
    return c.json({ error: 'Formato de hora inválido' }, 400)
  if (body.weekStart !== undefined && !VALID_WEEK_STARTS.includes(body.weekStart))
    return c.json({ error: 'Inicio de semana inválido' }, 400)
  if (body.theme !== undefined && !VALID_THEMES.includes(body.theme))
    return c.json({ error: 'Tema inválido' }, 400)

  const db = getDb(c.env.DB)
  const updated = await db
    .update(users)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.age !== undefined && { age: body.age }),
      ...(body.weightKg !== undefined && { weightKg: body.weightKg }),
      ...(body.dateFormat !== undefined && { dateFormat: body.dateFormat }),
      ...(body.timeFormat !== undefined && { timeFormat: body.timeFormat }),
      ...(body.weekStart !== undefined && { weekStart: body.weekStart }),
      ...(body.theme !== undefined && { theme: body.theme }),
    })
    .where(eq(users.id, userId))
    .returning(userFields)

  return c.json(updated[0])
})

profile.get('/avatar', async (c) => {
  const userId = c.get('userId')
  const avatar = await c.env.AVATARS.get(`avatar:${userId}`)
  return c.json({ avatar: avatar ?? null })
})

profile.put('/avatar', async (c) => {
  const userId = c.get('userId')
  const { avatar } = await c.req.json<{ avatar: string }>()
  if (!avatar || !avatar.startsWith('data:image/')) {
    return c.json({ error: 'Imagen inválida' }, 400)
  }
  if (avatar.length > 150_000) {
    return c.json({ error: 'Imagen demasiado grande' }, 400)
  }
  await c.env.AVATARS.put(`avatar:${userId}`, avatar)
  return c.json({ ok: true })
})

profile.put('/password', async (c) => {
  const userId = parseInt(c.get('userId'))
  const body = await c.req.json<{ currentPassword: string; newPassword: string }>()
  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return c.json({ error: 'La nueva contraseña debe tener mínimo 8 caracteres' }, 400)
  }

  const db = getDb(c.env.DB)
  const rows = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId))
  if (!rows[0]) return c.json({ error: 'Usuario no encontrado' }, 404)

  if (!(await verifyPassword(currentPassword, rows[0].passwordHash))) {
    return c.json({ error: 'La contraseña actual es incorrecta' }, 401)
  }

  const newHash = await hashPassword(newPassword)
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId))

  return c.json({ ok: true })
})

export default profile
