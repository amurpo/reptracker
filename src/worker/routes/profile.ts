import { Hono } from 'hono'
import { eq, asc, sql } from 'drizzle-orm'
import { getDb, users, weightLog } from '../db'
import { authMiddleware } from '../middleware/auth'
import { hashPassword, verifyPassword } from '../lib/crypto'
import { issueSession } from '../lib/session'
import type { Env } from '../index'

const profile = new Hono<{ Bindings: Env; Variables: { userId: number } }>()

profile.use('/*', authMiddleware)

const userFields = {
  id: users.id,
  email: users.email,
  name: users.name,
  age: users.age,
  weightKg: users.weightKg,
  heightCm: users.heightCm,
  sex: users.sex,
  dateFormat: users.dateFormat,
  timeFormat: users.timeFormat,
  weekStart: users.weekStart,
  theme: users.theme,
  restTimerSeconds: users.restTimerSeconds,
  restTimerSound: users.restTimerSound,
  restTimerRepeat: users.restTimerRepeat,
}

profile.get('/', async (c) => {
  const userId = c.get('userId')
  const db = getDb(c.env.DB)
  const rows = await db.select(userFields).from(users).where(eq(users.id, userId))
  if (!rows[0]) return c.json({ error: 'Usuario no encontrado' }, 404)
  return c.json(rows[0])
})

const VALID_DATE_FORMATS = ['dd-mm-yyyy', 'mm-dd-yyyy', 'yyyy-mm-dd']
const VALID_TIME_FORMATS = ['24h', '12h']
const VALID_WEEK_STARTS = [0, 1]
const VALID_THEMES = ['indigo', 'violet', 'emerald', 'sky', 'rose', 'amber']
const VALID_TIMER_SECONDS = [0, 15, 30, 45, 60, 90, 120, 180]
const VALID_TIMER_SOUNDS = ['bell', 'beep', 'chime', 'airhorn', 'rooster', 'bear']
const VALID_TIMER_REPEATS = [1, 2, 3, 4, 5]

profile.put('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{
    name?: string
    age?: number
    weightKg?: number
    heightCm?: number
    sex?: string
    dateFormat?: string
    timeFormat?: string
    weekStart?: number
    theme?: string
    restTimerSeconds?: number
    restTimerSound?: string
    restTimerRepeat?: number
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
  if (body.heightCm !== undefined) {
    const h = Number(body.heightCm)
    if (!Number.isInteger(h) || h < 50 || h > 300) return c.json({ error: 'Altura inválida (50-300 cm)' }, 400)
    body.heightCm = h
  }
  if (body.sex !== undefined && !['male', 'female', 'other'].includes(body.sex))
    return c.json({ error: 'Sexo inválido' }, 400)
  if (body.dateFormat !== undefined && !VALID_DATE_FORMATS.includes(body.dateFormat))
    return c.json({ error: 'Formato de fecha inválido' }, 400)
  if (body.timeFormat !== undefined && !VALID_TIME_FORMATS.includes(body.timeFormat))
    return c.json({ error: 'Formato de hora inválido' }, 400)
  if (body.weekStart !== undefined && !VALID_WEEK_STARTS.includes(body.weekStart))
    return c.json({ error: 'Inicio de semana inválido' }, 400)
  if (body.theme !== undefined && !VALID_THEMES.includes(body.theme))
    return c.json({ error: 'Tema inválido' }, 400)
  if (body.restTimerSeconds !== undefined && !VALID_TIMER_SECONDS.includes(body.restTimerSeconds))
    return c.json({ error: 'Duración de timer inválida' }, 400)
  if (body.restTimerSound !== undefined && !VALID_TIMER_SOUNDS.includes(body.restTimerSound))
    return c.json({ error: 'Sonido de timer inválido' }, 400)
  if (body.restTimerRepeat !== undefined && !VALID_TIMER_REPEATS.includes(body.restTimerRepeat))
    return c.json({ error: 'Repeticiones de timer inválidas' }, 400)

  const db = getDb(c.env.DB)
  const updated = await db
    .update(users)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.age !== undefined && { age: body.age }),
      ...(body.weightKg !== undefined && { weightKg: body.weightKg }),
      ...(body.heightCm !== undefined && { heightCm: body.heightCm }),
      ...(body.sex !== undefined && { sex: body.sex }),
      ...(body.dateFormat !== undefined && { dateFormat: body.dateFormat }),
      ...(body.timeFormat !== undefined && { timeFormat: body.timeFormat }),
      ...(body.weekStart !== undefined && { weekStart: body.weekStart }),
      ...(body.theme !== undefined && { theme: body.theme }),
      ...(body.restTimerSeconds !== undefined && { restTimerSeconds: body.restTimerSeconds }),
      ...(body.restTimerSound !== undefined && { restTimerSound: body.restTimerSound }),
      ...(body.restTimerRepeat !== undefined && { restTimerRepeat: body.restTimerRepeat }),
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

profile.get('/weight-log', async (c) => {
  const userId = c.get('userId')
  const db = getDb(c.env.DB)
  const rows = await db
    .select({ date: weightLog.date, weightKg: weightLog.weightKg })
    .from(weightLog)
    .where(eq(weightLog.userId, userId))
    .orderBy(asc(weightLog.date))
    .limit(90)
  return c.json(rows)
})

profile.post('/weight-log', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{ date: string; weightKg: number }>()
  const { date, weightKg } = body

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return c.json({ error: 'Fecha inválida (yyyy-mm-dd)' }, 400)
  const w = Number(weightKg)
  if (isNaN(w) || w < 1 || w > 500)
    return c.json({ error: 'Peso inválido (1-500 kg)' }, 400)
  const rounded = Math.round(w * 10) / 10

  const db = getDb(c.env.DB)
  await db
    .insert(weightLog)
    .values({ userId, date, weightKg: rounded })
    .onConflictDoUpdate({ target: [weightLog.userId, weightLog.date], set: { weightKg: rounded } })

  return c.json({ ok: true })
})

profile.put('/password', async (c) => {
  const userId = c.get('userId')
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
  const updated = await db
    .update(users)
    .set({ passwordHash: newHash, tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ tokenVersion: users.tokenVersion })

  // Invalida las demás sesiones y renueva la cookie actual para no desconectar al usuario.
  await issueSession(c, c.env.JWT_SECRET, userId, updated[0].tokenVersion)

  return c.json({ ok: true })
})

export default profile
