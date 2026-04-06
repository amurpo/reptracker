/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import authRoutes from './routes/auth'
import exercisesRoutes from './routes/exercises'
import planRoutes from './routes/plan'
import sessionsRoutes from './routes/sessions'
import profileRoutes from './routes/profile'
import routinesRoutes from './routes/routines'

export type Env = {
  DB: D1Database
  JWT_SECRET: string
  RESEND_API_KEY: string
  AVATARS: KVNamespace
  EXERCISE_IMAGES: KVNamespace
}

const app = new Hono<{ Bindings: Env }>()

// Security headers
app.use('*', async (c, next) => {
  await next()
  c.res.headers.set('X-Content-Type-Options', 'nosniff')
  c.res.headers.set('Referrer-Policy', 'no-referrer')
  c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  c.res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; base-uri 'self'; object-src 'none'"
  )
})

// CORS for local dev (Vite runs on 5173, worker on 8787)
app.use(
  '/api/*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
)

app.route('/api/auth', authRoutes)
app.route('/api/exercises', exercisesRoutes)
app.route('/api/plan', planRoutes)
app.route('/api/sessions', sessionsRoutes)
app.route('/api/profile', profileRoutes)
app.route('/api/routines', routinesRoutes)

export default app
